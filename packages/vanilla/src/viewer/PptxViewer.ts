import type { PptxHandler } from 'pptx-viewer-core';
import { EncryptedFileError } from 'pptx-viewer-core';
import type { ViewerTheme } from 'pptx-viewer-shared';

import type { ChromeHost, ChromeLifecycle } from './chrome-lifecycle';
import { buildMountChromeDeps, mountChrome, unmountChrome } from './chrome-lifecycle';
import type { EditorController } from './editor';
import { createEditorController } from './editor';
import type { Translator } from './i18n';
import { createTranslator } from './i18n';
import type { PptxViewerSource } from './load';
import { loadPresentation, resolveSourceToBuffer, revokeBlobUrls } from './load';
import type { ElementRendererRegistry } from './render';
import { createDefaultRegistry } from './render';
import type { RenderController } from './render-controller';
import { createRenderController } from './render-controller';
import type { Store, ViewerState, ZoomLevel } from './state';
import { clampSlideIndex, createInitialViewerState, createStore } from './state';
import { createStateSync } from './state-sync';
import { ensureViewerStyles } from './styles';
import { applyThemeVars } from './theme-apply';
import type { PptxViewerInstance, PptxViewerOptions } from './types';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;
const ZOOM_STEP = 1.25;

/**
 * The zero-framework PowerPoint viewer. Construct via {@link createPptxViewer}
 * (or `new PptxViewer(container, options)`): builds its chrome inside
 * `container`, loads `options.source` when given, and re-renders through a
 * tiny reactive store. All parsing lives in `pptx-viewer-core`; all pure
 * render logic in `pptx-viewer-shared`.
 */
export class PptxViewer implements PptxViewerInstance, ChromeHost {
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
	private readonly registry: ElementRendererRegistry;
	private handler: PptxHandler | null = null;
	private blobUrls: string[] = [];
	private loadToken = 0;
	private destroyed = false;

	constructor(container: HTMLElement, options: PptxViewerOptions = {}) {
		this.container = container;
		this.doc = container.ownerDocument;
		this.options = options;
		this.t = createTranslator(options.locale ?? 'en', options.messages);
		this.registry = options.registry ?? createDefaultRegistry();
		this.store = createStore(createInitialViewerState());
		this.renderer = createRenderController({
			doc: this.doc,
			store: this.store,
			registry: this.registry,
			getChrome: () => this.lifecycle.chrome,
			getTranslator: () => this.t,
			smartArt3D: options.smartArt3D ?? false,
			onStageRendered: () => this.editor?.onStageRendered(),
		});

		ensureViewerStyles(this.doc);
		this.lifecycle = mountChrome(buildMountChromeDeps(this));
		this.editor = createEditorController({
			doc: this.doc,
			store: this.store,
			getChrome: () => this.lifecycle.chrome,
			getTranslator: () => this.t,
			getScale: () => this.renderer.effectiveScale(),
			getHandler: () => this.handler,
			onChange: options.onChange,
		});
		this.editor.attachChrome();
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
		this.renderer.renderAll();

		if (options.source !== undefined) {
			void this.load(options.source);
		}
	}

	// ── Loading ────────────────────────────────────────────────────────────

	async loadFile(file: Blob | ArrayBuffer | Uint8Array): Promise<void> {
		await this.load(file);
	}

	async loadUrl(url: string): Promise<void> {
		await this.load(url);
	}

	private async load(source: PptxViewerSource): Promise<void> {
		const token = ++this.loadToken;
		this.editor?.reset();
		this.store.set({ loading: true, error: null });
		try {
			const buffer = await resolveSourceToBuffer(source);
			const loaded = await loadPresentation(buffer);
			if (token !== this.loadToken) {
				revokeBlobUrls(loaded.blobUrls);
				loaded.handler.dispose();
				return;
			}
			this.releaseLoaded();
			this.handler = loaded.handler;
			this.blobUrls = loaded.blobUrls;
			this.store.set({
				slides: loaded.slides,
				canvasSize: loaded.canvasSize,
				mediaDataUrls: loaded.mediaDataUrls,
				currentSlide: clampSlideIndex(this.options.initialSlide ?? 0, loaded.slides.length),
				loading: false,
			});
			this.options.onLoad?.({ slideCount: loaded.slides.length, canvasSize: loaded.canvasSize });
		} catch (error) {
			if (token !== this.loadToken) {
				return;
			}
			const message =
				error instanceof EncryptedFileError
					? this.t('pptx.security.currentlyProtected')
					: error instanceof Error
						? error.message
						: String(error);
			this.store.set({ loading: false, error: message });
			this.options.onError?.(message, error);
		}
	}

	/** Dispose the previous handler + Blob URLs (before replacing or on destroy). */
	private releaseLoaded(): void {
		revokeBlobUrls(this.blobUrls);
		revokeBlobUrls(this.store.get().mediaDataUrls.values());
		this.blobUrls = [];
		this.handler?.dispose();
		this.handler = null;
	}

	// ── Navigation / zoom ──────────────────────────────────────────────────

	next(): void {
		this.goToSlide(this.store.get().currentSlide + 1);
	}

	prev(): void {
		this.goToSlide(this.store.get().currentSlide - 1);
	}

	goToSlide(index: number): void {
		this.store.set({ currentSlide: clampSlideIndex(index, this.store.get().slides.length) });
	}

	getSlideCount(): number {
		return this.store.get().slides.length;
	}

	getCurrentSlide(): number {
		return this.store.get().currentSlide;
	}

	getZoom(): number {
		return this.renderer.effectiveScale();
	}

	setZoom(zoom: ZoomLevel): void {
		this.store.set({
			zoom: zoom === 'fit' ? 'fit' : Math.min(Math.max(zoom, MIN_ZOOM), MAX_ZOOM),
		});
	}

	zoomIn(): void {
		this.setZoom(this.renderer.effectiveScale() * ZOOM_STEP);
	}

	zoomOut(): void {
		this.setZoom(this.renderer.effectiveScale() / ZOOM_STEP);
	}

	zoomToFit(): void {
		this.setZoom('fit');
	}

	// ── Notes panel ────────────────────────────────────────────────────────

	/** Expand/collapse the speaker-notes panel; persists for the instance's life. */
	toggleNotes(): void {
		this.store.set({ notesExpanded: !this.store.get().notesExpanded });
	}

	// ── Theme / locale ─────────────────────────────────────────────────────

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

	// ── Editor ────────────────────────────────────────────────────────────

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

	getSelectedElementId(): string | null {
		return this.editor.getSelectedElementId();
	}

	// ── Presentation mode ──────────────────────────────────────────────────

	async enterPresentation(): Promise<void> {
		await this.lifecycle.presentation.enter();
	}

	async exitPresentation(): Promise<void> {
		await this.lifecycle.presentation.exit();
	}

	// ── Escape hatches / teardown ──────────────────────────────────────────

	getRegistry(): ElementRendererRegistry {
		return this.registry;
	}

	getHandler(): PptxHandler | null {
		return this.handler;
	}

	destroy(): void {
		if (this.destroyed) {
			return;
		}
		this.destroyed = true;
		this.loadToken++;
		this.editor.destroy();
		unmountChrome(this.lifecycle, () => this.editor?.detachChrome());
		this.releaseLoaded();
	}

	// ── Chrome lifecycle ───────────────────────────────────────────────────

	private remountChrome(): void {
		unmountChrome(this.lifecycle, () => this.editor?.detachChrome());
		this.lifecycle = mountChrome(buildMountChromeDeps(this));
	}
}

/**
 * Create a PowerPoint viewer inside `container`.
 *
 * ```ts
 * import { createPptxViewer } from 'pptx-vanilla-viewer';
 * const viewer = createPptxViewer(document.querySelector('#host')!, {
 * 	source: '/deck.pptx',
 * 	onSlideChange: (i) => console.log('slide', i + 1),
 * });
 * ```
 */
export function createPptxViewer(
	container: HTMLElement,
	options: PptxViewerOptions = {},
): PptxViewerInstance {
	return new PptxViewer(container, options);
}
