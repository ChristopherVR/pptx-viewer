import { cloneSlide, setSmartArtNodeStyle, updateSmartArtNodeText } from 'pptx-viewer-core';
import type { PptxElement, PptxHandler, PptxSaveFormat, PptxSlide } from 'pptx-viewer-core';
import type { PresentationSnapshot, ViewerMode, ViewerTheme } from 'pptx-viewer-shared';
import {
	buildPresentationAudienceUrl,
	buildUserFontFaceStyles,
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
	shouldCommitSmartArtNodeText,
	storePresentationDeck,
	createInitialPresentationSnapshot,
	createBlankSlide,
	makeSlideId,
	mergePresentationSnapshot,
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
import { mountPresenterConsole, renderAudienceEffects } from './presenter-console';
import type { ElementRendererRegistry } from './render';
import { createDefaultRegistry } from './render';
import type { RenderController } from './render-controller';
import { createRenderController } from './render-controller';
import type { SessionControllers } from './session-controllers';
import { createSessionControllers } from './session-controllers';
import type { Store, ViewerState } from './state';
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
import { openDocumentPropertiesDialog } from './ui/document-properties-dialog';
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
	private presenterSnapshot = createInitialPresentationSnapshot();
	private disposePresenterConsole: (() => void) | null = null;
	private userFontsStyle: HTMLStyleElement | null = null;

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
			onSectionToggle: (sectionId) =>
				this.editor?.getEditActions().sections.toggleSection(sectionId),
			onSectionRename: (sectionId, name) =>
				this.editor?.getEditActions().sections.renameSection(sectionId, name),
			onSectionDelete: (sectionId) =>
				this.editor?.getEditActions().sections.deleteSection(sectionId),
			onSectionMove: (sectionId, direction) =>
				this.editor?.getEditActions().sections.moveSection(sectionId, direction),
			onZoomClick: (targetSlideIndex) => this.controls.goToSlide(targetSlideIndex),
			onSmartArtNodeTextChange: (element, nodeId, text) => {
				if (
					element.type !== 'smartArt' ||
					!element.smartArtData ||
					!shouldCommitSmartArtNodeText(element.smartArtData, nodeId, text)
				) {
					return;
				}
				this.editor?.applyElementPatch(element.id, {
					smartArtData: updateSmartArtNodeText(element.smartArtData, nodeId, text),
				});
			},
			onSmartArtNodeFillChange: (element, nodeId, fill) => {
				if (element.type !== 'smartArt' || !element.smartArtData) {
					return;
				}
				const next = setSmartArtNodeStyle(element.smartArtData, nodeId, { fillColor: fill });
				if (next !== element.smartArtData) {
					this.editor?.applyElementPatch(element.id, { smartArtData: next });
				}
			},
			onStageRendered: () => this.editor?.onStageRendered(),
		});
		this.controls = createViewerControls(this.store, this.renderer);

		ensureViewerStyles(this.doc);
		const userFontCss = buildUserFontFaceStyles(options.fonts ?? []);
		if (userFontCss) {
			this.userFontsStyle = this.doc.createElement('style');
			this.userFontsStyle.dataset.pptxUserFonts = 'vanilla';
			this.userFontsStyle.textContent = userFontCss;
			this.doc.head.appendChild(this.userFontsStyle);
		}
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

	setZoom(zoom: number): void {
		this.controls.setZoom(zoom);
	}

	zoomIn = (): void => this.controls.zoomIn();
	zoomOut = (): void => this.controls.zoomOut();
	zoomToFit = (): void => this.controls.zoomToFit();
	zoomReset = (): void => this.controls.setZoom(1);
	goTo = (index: number): void => this.goToSlide(index);
	goPrev = (): void => this.prev();
	goNext = (): void => this.next();
	getContent = (): Promise<Uint8Array> => this.save();
	getMode = (): ViewerMode => {
		const state = this.store.get();
		return state.masterViewTarget
			? 'master'
			: state.presenting
				? 'present'
				: state.editable
					? 'edit'
					: 'preview';
	};
	setMode = (mode: ViewerMode): void => {
		if (mode === 'present') {
			void this.enterPresentation();
			return;
		}
		if (this.store.get().presenting) {
			void this.exitPresentation();
		}
		this.setEditable(mode === 'edit' || mode === 'master');
		if (mode === 'master' && !this.store.get().masterViewTarget) {
			this.toggleMasterNavigation();
		}
		if (mode !== 'master' && this.store.get().masterViewTarget) {
			this.toggleMasterNavigation();
		}
	};
	getActiveSlideIndex = (): number => this.getCurrentSlide();
	setActiveSlideIndex = (index: number): void => this.goToSlide(index);
	isDirty = (): boolean => this.store.get().dirty;
	getSlides = (): readonly PptxSlide[] => this.store.get().slides;
	getSlide = (index: number): PptxSlide | undefined => this.store.get().slides[index];
	getActiveSlide = (): PptxSlide | undefined => this.getSlide(this.getCurrentSlide());
	getElements = (index = this.getCurrentSlide()): readonly PptxElement[] =>
		this.getSlide(index)?.elements ?? [];
	getElementById = (id: string, index = this.getCurrentSlide()): PptxElement | undefined =>
		this.getElements(index).find((element) => element.id === id);
	updateElement = (id: string, updates: Partial<PptxElement>): void =>
		this.editor.applyElementPatch(id, updates);
	deleteElements = (ids: string[]): void => {
		this.editor.selectElements(ids);
		this.editor.deleteSelected();
	};
	duplicateElement = (id: string): string | undefined => {
		this.editor.selectElements([id]);
		return this.editor.duplicateSelected() ?? undefined;
	};
	getSelectedElementIds = (): string[] => [...this.store.get().selectedElementIds];
	selectElements = (ids: string[]): void => this.editor.selectElements(ids);
	clearSelection = (): void => this.editor.selectElements([]);
	addSlide = (afterIndex = this.store.get().slides.length - 1): void => {
		const next = [...this.store.get().slides];
		const index = Math.min(Math.max(afterIndex + 1, 0), next.length);
		next.splice(index, 0, createBlankSlide(index + 1, makeSlideId));
		this.editor.commitSlides(this.renumber(next), index);
	};
	deleteSlides = (indexes: number[]): void => {
		const remove = new Set(indexes);
		const next = this.store.get().slides.filter((_, index) => !remove.has(index));
		if (next.length > 0) {
			this.editor.commitSlides(this.renumber(next));
		}
	};
	duplicateSlides = (indexes: number[]): void => {
		const selected = new Set(indexes);
		const next = this.store
			.get()
			.slides.flatMap((slide, index) =>
				selected.has(index) ? [slide, { ...cloneSlide(slide), id: makeSlideId() }] : [slide],
			);
		this.editor.commitSlides(this.renumber(next));
	};
	moveSlide = (fromIndex: number, toIndex: number): void => {
		const next = [...this.store.get().slides];
		if (!next[fromIndex] || toIndex < 0 || toIndex >= next.length || fromIndex === toIndex) {
			return;
		}
		const [slide] = next.splice(fromIndex, 1);
		next.splice(toIndex, 0, slide);
		this.editor.commitSlides(this.renumber(next), toIndex);
	};
	toggleHideSlides = (indexes: number[]): void => {
		const selected = new Set(indexes);
		this.editor.commitSlides(
			this.store
				.get()
				.slides.map((slide, index) =>
					selected.has(index) ? { ...slide, hidden: !slide.hidden } : slide,
				),
		);
	};
	private renumber(slides: PptxSlide[]): PptxSlide[] {
		return slides.map((slide, index) => ({ ...slide, slideNumber: index + 1 }));
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

	/** Run the shared WCAG checks against the live deck and show the results. */
	openAccessibility(): void {
		this.lifecycle.chrome.accessibility.open(collectAccessibilityIssues(this.store.get().slides));
	}

	/** Open the document metadata editor backed by the current loaded deck. */
	openDocumentProperties(): void {
		const state = this.store.get();
		openDocumentPropertiesDialog(this.doc, this.t, {
			slides: state.slides,
			core: state.coreProperties,
			app: state.appProperties,
			custom: state.customProperties,
			editable: state.editable,
			onSave: (core, app, custom) => this.editor.updateDocumentProperties(core, app, custom),
		});
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
		this.disposePresenterConsole?.();
		this.disposePresenterConsole = mountPresenterConsole({
			container: this.container,
			getSnapshot: () => this.presenterSnapshot,
			getSlides: () => this.store.get().slides,
			getCurrent: () => this.getCurrentSlide(),
			update: (patch) => this.updatePresenterSnapshot(patch),
			navigate: (index) => this.goToSlide(index),
			toggleAudience: () =>
				this.isAudienceWindowOpen() ? this.closeAudienceWindow() : this.openPresenterView(),
			end: () => {
				this.closeAudienceWindow();
				void this.exitPresentation();
			},
		});
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

	private isAudienceWindowOpen(): boolean {
		return Boolean(this.audienceWindow && !this.audienceWindow.closed);
	}

	private syncAudience(slideIndex = this.getCurrentSlide()): void {
		if (!this.presenterSessionId) {
			return;
		}
		this.getPresenterChannel()?.postMessage({
			origin: PRESENTATION_MESSAGE_ORIGIN,
			type: 'presenter-state',
			sessionId: this.presenterSessionId,
			snapshot: { ...this.presenterSnapshot, slideIndex, sequence: ++this.presenterSequence },
		});
	}

	private updatePresenterSnapshot(patch: Partial<PresentationSnapshot>): void {
		this.presenterSnapshot = mergePresentationSnapshot(this.presenterSnapshot, patch);
		renderAudienceEffects(this.container, this.presenterSnapshot);
		this.syncAudience(this.presenterSnapshot.slideIndex);
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
					this.presenterSnapshot = message.snapshot;
					renderAudienceEffects(this.container, message.snapshot);
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
		this.disposePresenterConsole?.();
		this.disposePresenterConsole = null;
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

	async save(format: PptxSaveFormat = 'pptx'): Promise<Uint8Array> {
		return this.editor.save(format);
	}

	async downloadAs(format: PptxSaveFormat, fileName?: string): Promise<void> {
		return this.editor.downloadAs(format, fileName);
	}

	async downloadPptx(fileName?: string): Promise<void> {
		return this.editor.downloadPptx(fileName);
	}

	async packageForSharing(fileName?: string): Promise<void> {
		return this.editor.packageForSharing(fileName);
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
		this.userFontsStyle?.remove();
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
