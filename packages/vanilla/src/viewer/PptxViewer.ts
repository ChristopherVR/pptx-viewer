import type { PptxHandler } from 'pptx-viewer-core';
import type { ViewerTheme } from 'pptx-viewer-shared';
import {
	buildPresentationAudienceUrl,
	clearPresentationDeck,
	collectAccessibilityIssues,
	createPresentationSessionId,
	isPresentationSessionMessage,
	loadPresentationDeck,
	parsePresentationSessionId,
	placeAudienceWindow,
	PRESENTATION_CHANNEL_NAME,
	PRESENTATION_MESSAGE_ORIGIN,
	resolveAudienceScreenPlacement,
	storePresentationDeck,
} from 'pptx-viewer-shared';

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
import { toggleMasterView } from './template-view-control';
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
	private presenterChannel: BroadcastChannel | null = null;
	private audienceWindow: Window | null = null;
	private presenterSessionId = '';
	private presenterSequence = 0;

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
			onHandoutSlidesPerPageChange: (count) => this.editor?.setHandoutSlidesPerPage(count),
			onMasterBackgroundColorChange: (color) =>
				this.editor?.getEditActions().setSlideBackgroundColor(color),
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
		this.store.subscribe((state) => {
			if (this.presenterSessionId) {
				this.syncAudience(state.currentSlide);
			}
		});
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
		this.connectAudienceRole();
	}

	async loadFile(file: Blob | ArrayBuffer | Uint8Array): Promise<void> {
		await this.loading.load(file);
	}

	async loadUrl(url: string): Promise<void> {
		await this.loading.load(url);
	}

	next = (): void => this.controls.next();
	prev = (): void => this.controls.prev();
	goToSlide = (index: number): void => this.controls.goToSlide(index);
	getSlideCount = (): number => this.controls.slideCount();
	getCurrentSlide = (): number => this.controls.currentSlide();
	getZoom = (): number => this.controls.zoom();

	setZoom(zoom: ZoomLevel): void {
		this.controls.setZoom(zoom);
	}

	zoomIn = (): void => this.controls.zoomIn();
	zoomOut = (): void => this.controls.zoomOut();
	zoomToFit = (): void => this.controls.zoomToFit();

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

	/** Run the shared WCAG checks against the live deck and show the results. */
	openAccessibility(): void {
		this.lifecycle.chrome.accessibility.open(collectAccessibilityIssues(this.store.get().slides));
	}

	/** Open a clean audience display while retaining this editor as the presenter surface. */
	openPresenterView(): void {
		this.closeAudienceWindow();
		const popup = window.open(
			'about:blank',
			'pptx-viewer-audience',
			'popup=yes,width=1280,height=720',
		);
		if (!popup) {
			return;
		}
		this.audienceWindow = popup;
		this.presenterSessionId = createPresentationSessionId();
		this.store.set({ notesExpanded: true });
		const sessionId = this.presenterSessionId;
		const url = buildPresentationAudienceUrl(window.location.href, sessionId);
		void resolveAudienceScreenPlacement(window).then((placement) => {
			if (placement && this.audienceWindow === popup && !popup.closed) {
				placeAudienceWindow(popup, placement);
			}
			return undefined;
		});
		const handler = this.loading.getHandler();
		if (!handler) {
			this.closeAudienceWindow();
			return;
		}
		void handler
			.save(this.store.get().slides)
			.then((bytes) => storePresentationDeck(sessionId, bytes))
			.then(() => popup.location.replace(url))
			.catch(() => this.closeAudienceWindow());
	}

	private getPresenterChannel(): BroadcastChannel | null {
		try {
			this.presenterChannel ??= new BroadcastChannel(PRESENTATION_CHANNEL_NAME);
			return this.presenterChannel;
		} catch {
			return null;
		}
	}

	private syncAudience(slideIndex = this.getCurrentSlide()): void {
		if (!this.presenterSessionId) {
			return;
		}
		this.getPresenterChannel()?.postMessage({
			origin: PRESENTATION_MESSAGE_ORIGIN,
			type: 'presenter-state',
			sessionId: this.presenterSessionId,
			snapshot: {
				slideIndex,
				buildStep: 0,
				sequence: ++this.presenterSequence,
				blackout: 'none',
				paused: false,
				elapsedMs: 0,
			},
		});
	}

	private connectAudienceRole(): void {
		const audienceSession = parsePresentationSessionId(window.location.hash);
		const channel = this.getPresenterChannel();
		if (!channel) {
			return;
		}
		channel.addEventListener('message', (event: MessageEvent) => {
			const message = event.data;
			if (!isPresentationSessionMessage(message)) {
				return;
			}
			if (audienceSession && message.sessionId === audienceSession) {
				if (message.type === 'presenter-state') {
					this.goToSlide(message.snapshot.slideIndex);
				}
				if (message.type === 'presenter-slide-change') {
					this.goToSlide(message.slideIndex);
				}
				if (message.type === 'presenter-exit') {
					void this.exitPresentation();
				}
			} else if (
				message.type === 'audience-ready' &&
				message.sessionId === this.presenterSessionId
			) {
				this.syncAudience();
			}
		});
		if (!audienceSession) {
			return;
		}
		channel.postMessage({
			origin: PRESENTATION_MESSAGE_ORIGIN,
			type: 'audience-ready',
			sessionId: audienceSession,
		});
		if (this.options.source === undefined) {
			void loadPresentationDeck(audienceSession).then(async (bytes) => {
				if (!bytes) {
					return undefined;
				}
				await this.loading.load(bytes);
				await this.enterPresentation();
				return undefined;
			});
		}
	}

	private closeAudienceWindow(): void {
		const sessionId = this.presenterSessionId;
		if (sessionId) {
			this.getPresenterChannel()?.postMessage({
				origin: PRESENTATION_MESSAGE_ORIGIN,
				type: 'presenter-exit',
				sessionId,
			});
			void clearPresentationDeck(sessionId);
		}
		try {
			this.audienceWindow?.close();
		} catch {
			/* ignore */
		}
		this.audienceWindow = null;
		this.presenterSessionId = '';
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

	setEditTemplateMode(enabled: boolean): void {
		const state = this.store.get();
		if (!state.editable || state.editTemplateMode === enabled) {
			return;
		}
		this.store.set({
			editTemplateMode: enabled,
			selectedElementId: null,
			selectedElementIds: [],
		});
	}

	toggleTemplateEditing(): void {
		this.setEditTemplateMode(!this.store.get().editTemplateMode);
	}

	toggleMasterNavigation(): void {
		const patch = toggleMasterView(this.store.get());
		if (patch) {
			this.store.set(patch);
		}
	}

	undo = (): void => this.editor.undo();
	redo = (): void => this.editor.redo();

	toggleAutosave(): boolean {
		const enabled = !this.sessions.isAutosaveEnabled();
		this.setAutosaveEnabled(enabled);
		return enabled;
	}

	canUndo = (): boolean => this.editor.canUndo();
	canRedo = (): boolean => this.editor.canRedo();

	async save(): Promise<Uint8Array> {
		return this.editor.save();
	}

	async downloadPptx(fileName?: string): Promise<void> {
		return this.editor.downloadPptx(fileName);
	}

	deleteSelected = (): void => this.editor.deleteSelected();

	// exportSlidePng / exportPdf / exportGif / exportVideo / print are
	// inherited from ViewerExportHost (see export-lifecycle.ts).

	getSelectedElementId = (): string | null => this.editor.getSelectedElementId();

	async enterPresentation(): Promise<void> {
		await this.lifecycle.presentation.enter();
	}

	async exitPresentation(): Promise<void> {
		await this.lifecycle.presentation.exit();
	}

	getRegistry = (): ElementRendererRegistry => this.registry;
	getHandler = (): PptxHandler | null => this.loading.getHandler();

	startCollaboration(config: CollaborationConfig): Promise<void> {
		return this.sessions.startCollaboration(config);
	}

	stopCollaboration = (): void => this.sessions.stopCollaboration();
	getCollaborationStatus = (): ConnectionStatus => this.sessions.getCollaborationStatus();

	autosaveNow(): Promise<void> {
		return this.sessions.autosaveNow();
	}

	setAutosaveEnabled(enabled: boolean): void {
		this.sessions.setAutosaveEnabled(enabled);
		this.lifecycle.chrome.titleBar?.setAutosaveEnabled(enabled);
	}

	isAutosaveEnabled = (): boolean => this.sessions.isAutosaveEnabled();

	openBroadcast(): void {
		this.sessions.openBroadcast();
	}

	destroy(): void {
		if (this.destroyed) {
			return;
		}
		this.destroyed = true;
		this.closeAudienceWindow();
		this.presenterChannel?.close();
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
