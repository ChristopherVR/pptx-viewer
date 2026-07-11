import type { PptxHandler } from 'pptx-viewer-core';
import type { ViewerTheme } from 'pptx-viewer-shared';

import type { ChromeHost, ChromeLifecycle } from './chrome-lifecycle';
import { buildMountChromeDeps, mountChrome, unmountChrome } from './chrome-lifecycle';
import type { EditorController } from './editor';
import { createEditorController } from './editor';
import type { ExportLifecycle } from './export-lifecycle';
import { createExportLifecycle, ViewerExportHost } from './export-lifecycle';
import type { Translator } from './i18n';
import { createTranslator } from './i18n';
import type { LoadingController } from './loading-controller';
import { createLoadingController } from './loading-controller';
import type { ElementRendererRegistry } from './render';
import { createDefaultRegistry } from './render';
import type { RenderController } from './render-controller';
import { createRenderController } from './render-controller';
import type { SessionControllers } from './session-controllers';
import { createSessionControllers } from './session-controllers';
import type { Store, ViewerState, ZoomLevel } from './state';
import { createInitialViewerState, createStore } from './state';
import { createStateSync } from './state-sync';
import { ensureViewerStyles } from './styles';
import { applyThemeVars } from './theme-apply';
import type {
	CollaborationConfig,
	ConnectionStatus,
	PptxViewerInstance,
	PptxViewerOptions,
} from './types';
import type { ViewerControls } from './viewer-controls';
import { createViewerControls } from './viewer-controls';

/**
 * The zero-framework PowerPoint viewer. Construct via {@link createPptxViewer}:
 * builds chrome inside `container`, loads `options.source` when given, and
 * re-renders through a tiny reactive store.
 */
export class PptxViewer extends ViewerExportHost implements PptxViewerInstance, ChromeHost {
	// Not `private`: `ChromeHost` (structurally implemented by this class, see
	// `buildMountChromeDeps(this)` below) needs these readable from outside the
	// class body's own methods.
	readonly container: HTMLElement;
	readonly doc: Document;
	readonly options: PptxViewerOptions;
	readonly store: Store<ViewerState>;
	readonly renderer: RenderController;
	t: Translator;
	lifecycle!: ChromeLifecycle;
	editor!: EditorController;
	protected readonly exporter: ExportLifecycle;
	private readonly loading: LoadingController;
	private readonly registry: ElementRendererRegistry;
	private readonly sessions: SessionControllers;
	private readonly controls: ViewerControls;
	private destroyed = false;

	constructor(container: HTMLElement, options: PptxViewerOptions = {}) {
		super();
		this.container = container;
		this.doc = container.ownerDocument;
		this.options = options;
		this.t = createTranslator(options.locale ?? 'en', options.messages);
		this.registry = options.registry ?? createDefaultRegistry();
		this.store = createStore(createInitialViewerState());
		this.loading = createLoadingController({
			options,
			store: this.store,
			getTranslator: () => this.t,
			getEditor: () => this.editor,
		});
		this.renderer = createRenderController({
			doc: this.doc,
			store: this.store,
			registry: this.registry,
			getChrome: () => this.lifecycle.chrome,
			getTranslator: () => this.t,
			smartArt3D: options.smartArt3D ?? false,
			onStageRendered: () => this.editor?.onStageRendered(),
		});
		this.controls = createViewerControls(this.store, this.renderer);

		ensureViewerStyles(this.doc);
		this.lifecycle = mountChrome(buildMountChromeDeps(this));
		this.editor = createEditorController({
			doc: this.doc,
			store: this.store,
			getChrome: () => this.lifecycle.chrome,
			getTranslator: () => this.t,
			getScale: () => this.renderer.effectiveScale(),
			getHandler: () => this.loading.getHandler(),
			onChange: options.onChange,
			onCursorMove: (x, y) => this.sessions.setCollaborationCursor(x, y),
		});
		this.editor.attachChrome();
		this.exporter = createExportLifecycle({
			doc: this.doc,
			container: this.container,
			store: this.store,
			registry: this.registry,
			getTranslator: () => this.t,
			smartArt3D: options.smartArt3D ?? false,
		});
		if (options.editable) {
			this.store.set({ editable: true });
			this.editor.setEditable(true);
		}
		this.store.subscribe(
			createStateSync({
				getChrome: () => this.lifecycle.chrome,
				renderer: this.renderer,
				callbacks: options,
			}),
		);
		this.sessions = createSessionControllers({
			doc: this.doc,
			store: this.store,
			options,
			getHandler: () => this.loading.getHandler(),
			getChrome: () => this.lifecycle.chrome,
			getTranslator: () => this.t,
			getScale: () => this.renderer.effectiveScale(),
			setEditable: (editable) => this.setEditable(editable),
			goToSlide: (index) => this.controls.goToSlide(index),
		});
		this.renderer.renderAll();

		if (options.source !== undefined) {
			void this.loading.load(options.source);
		}
	}

	async loadFile(file: Blob | ArrayBuffer | Uint8Array): Promise<void> {
		await this.loading.load(file);
	}

	async loadUrl(url: string): Promise<void> {
		await this.loading.load(url);
	}

	next(): void {
		this.controls.next();
	}

	prev(): void {
		this.controls.prev();
	}

	goToSlide(index: number): void {
		this.controls.goToSlide(index);
	}

	getSlideCount(): number {
		return this.controls.slideCount();
	}

	getCurrentSlide(): number {
		return this.controls.currentSlide();
	}

	getZoom(): number {
		return this.controls.zoom();
	}

	setZoom(zoom: ZoomLevel): void {
		this.controls.setZoom(zoom);
	}

	zoomIn(): void {
		this.controls.zoomIn();
	}

	zoomOut(): void {
		this.controls.zoomOut();
	}

	zoomToFit(): void {
		this.controls.zoomToFit();
	}

	/** Expand/collapse the speaker-notes panel; persists for the instance's life. */
	toggleNotes(): void {
		this.store.set({ notesExpanded: !this.store.get().notesExpanded });
	}

	setTheme(theme: ViewerTheme | undefined): void {
		this.lifecycle.appliedThemeVars = applyThemeVars(
			this.lifecycle.chrome.root,
			theme,
			this.lifecycle.appliedThemeVars,
		);
	}

	setLocale(locale: string): void {
		this.t = createTranslator(locale, this.options.messages);
		// Chrome labels are baked at build time; rebuild it under the new locale.
		this.remountChrome();
		this.editor.attachChrome();
		this.renderer.renderAll();
	}

	setEditable(editable: boolean): void {
		this.store.set({ editable });
		this.editor.setEditable(editable);
	}

	undo(): void {
		this.editor.undo();
	}

	redo(): void {
		this.editor.redo();
	}

	canUndo(): boolean {
		return this.editor.canUndo();
	}

	canRedo(): boolean {
		return this.editor.canRedo();
	}

	async save(): Promise<Uint8Array> {
		return this.editor.save();
	}

	async downloadPptx(fileName?: string): Promise<void> {
		return this.editor.downloadPptx(fileName);
	}

	deleteSelected(): void {
		this.editor.deleteSelected();
	}

	// exportSlidePng / exportPdf / exportGif / exportVideo / print are
	// inherited from ViewerExportHost (see export-lifecycle.ts).

	getSelectedElementId(): string | null {
		return this.editor.getSelectedElementId();
	}

	async enterPresentation(): Promise<void> {
		await this.lifecycle.presentation.enter();
	}

	async exitPresentation(): Promise<void> {
		await this.lifecycle.presentation.exit();
	}

	getRegistry(): ElementRendererRegistry {
		return this.registry;
	}

	getHandler(): PptxHandler | null {
		return this.loading.getHandler();
	}

	startCollaboration(config: CollaborationConfig): Promise<void> {
		return this.sessions.startCollaboration(config);
	}

	stopCollaboration(): void {
		this.sessions.stopCollaboration();
	}

	getCollaborationStatus(): ConnectionStatus {
		return this.sessions.getCollaborationStatus();
	}

	autosaveNow(): Promise<void> {
		return this.sessions.autosaveNow();
	}

	destroy(): void {
		if (this.destroyed) {
			return;
		}
		this.destroyed = true;
		this.sessions.destroy();
		this.loading.invalidate();
		this.editor.destroy();
		this.exporter.destroy();
		unmountChrome(this.lifecycle, () => this.editor?.detachChrome());
		this.loading.releaseLoaded();
	}

	private remountChrome(): void {
		unmountChrome(this.lifecycle, () => this.editor?.detachChrome());
		this.lifecycle = mountChrome(buildMountChromeDeps(this));
	}
}

/** Create a PowerPoint viewer inside `container` (see {@link PptxViewerOptions}). */
export function createPptxViewer(
	container: HTMLElement,
	options: PptxViewerOptions = {},
): PptxViewerInstance {
	return new PptxViewer(container, options);
}
