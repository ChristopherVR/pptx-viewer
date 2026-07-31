import { cloneSlide, setSmartArtNodeStyle, updateSmartArtNodeText } from 'pptx-viewer-core';
import type {
	PptxElement,
	PptxHandler,
	PptxSaveFormat,
	PptxSlide,
	PptxTheme,
} from 'pptx-viewer-core';
import type {
	PresentationSnapshot,
	ThemeCatalogEntry,
	ViewerMode,
	ViewerQuickAccessOptions,
	ViewerTheme,
} from 'pptx-viewer-shared';
import {
	buildPresentationAudienceUrl,
	buildUserFontFaceStyles,
	clearPresentationDeck,
	collectAccessibilityIssues,
	createPresentationSessionId,
	endAudienceDisplay,
	isPresentationSessionMessage,
	loadPresentationDeck,
	mayLeaveSlideShow,
	parsePresentationSessionId,
	placeAudienceWindow,
	PRESENTATION_CHANNEL_NAME,
	PRESENTATION_MESSAGE_ORIGIN,
	readStoredViewerPrefs,
	resolveAudienceScreenPlacement,
	shouldCommitSmartArtNodeText,
	storePresentationDeck,
	createInitialPresentationSnapshot,
	createBlankSlide,
	createBackstagePresentation,
	DEFAULT_VIEWER_OPTIONS,
	deleteAutosaveSnapshot,
	listAutosaveSnapshots,
	readBackstageRecentFile,
	makeSlideId,
	mergePresentationSnapshot,
	openPptxFile,
	THEME_CATALOG,
	writeStoredViewerPrefs,
} from 'pptx-viewer-shared';
import type { LocaleCatalogEntry } from 'pptx-viewer-shared/i18n';

import type { AiChatMount, AiFocusController } from './ai';
import { createAiFocusController, createVanillaAiBridge, mountAiChat } from './ai';
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
import type { ParityWorkflowHost, ParityWorkflows } from './parity-workflows';
import { createParityWorkflows } from './parity-workflows';
import type { PresentationAnnotationsHost } from './presentation-annotations-host';
import { createPresentationAnnotationsHost } from './presentation-annotations-host';
import { applyPresentationThemePreset } from './presentation-theme-controller';
import { mountPresenterConsole, renderAudienceEffects } from './presenter-console';
import type { ElementRendererRegistry } from './render';
import { createDefaultRegistry } from './render';
import type { RenderController } from './render-controller';
import { createRenderController } from './render-controller';
import type { RulerController } from './ruler-controller';
import { createRulerController } from './ruler-controller';
import type { SessionControllers } from './session-controllers';
import { createSessionControllers } from './session-controllers';
import type { Store, ViewerState } from './state';
import { createInitialViewerState, createStore } from './state';
import { createStateSync } from './state-sync';
import { ensureViewerStyles } from './styles';
import { toggleMasterView } from './template-view-control';
import { applyThemeVars } from './theme-apply';
import {
	findThemeCatalogKey,
	resolveAvailableLocales,
	resolveInitialLocale,
	resolveInitialThemeState,
} from './theme-locale-prefs';
import type {
	CollaborationConfig,
	ConnectionStatus,
	PptxViewerInstance,
	PptxViewerOptions,
} from './types';
import { openDigitalSignaturesDialog } from './ui/digital-signatures-dialog';
import { openDocumentPropertiesDialog } from './ui/document-properties-dialog';
import type { ElementContextMenu } from './ui/element-context-menu';
import { mountElementContextMenu } from './ui/element-context-menu';
import { openFontEmbeddingDialog } from './ui/font-embedding-dialog';
import { openPasswordProtectionDialog } from './ui/password-protection-dialog';
import { openSignatureStrippedDialog } from './ui/signature-stripped-dialog';
import { openVersionHistoryPanel } from './ui/version-history-panel';
import type { ViewerControls } from './viewer-controls';
import { createViewerControls } from './viewer-controls';
import type { ViewerOptionsController } from './viewer-options-controller';
import { createViewerOptionsController } from './viewer-options-controller';

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
	/** The viewer's live theme (kept in sync by `setTheme`); read by `ChromeHost` on mount/remount. */
	currentTheme: ViewerTheme | undefined;
	private readonly availableThemes: readonly ThemeCatalogEntry[];
	private readonly availableLocales: readonly LocaleCatalogEntry[];
	private currentThemeKey: string;
	private currentLocale: string;
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
	private embedFontsEnabled = false;
	private signatureWarningAcknowledged = false;
	private detachSignatureWarning: (() => void) | null = null;
	private annotations!: PresentationAnnotationsHost;
	private parityWorkflows!: ParityWorkflows;
	private aiChat: AiChatMount | null = null;
	/** Live AI focus controller while `ai` is configured; the canvas menu's AI entries route to it. */
	private aiFocus: AiFocusController | null = null;
	private contextMenu: ElementContextMenu | null = null;
	/** View > Rulers strips (ticks, labels, drag-out guides) around the stage. */
	private rulers: RulerController | null = null;
	/** File > Options store + option-driven behavior (undo depth, ribbon, etc.). */
	private optionsController!: ViewerOptionsController;

	constructor(container: HTMLElement, options: PptxViewerOptions = {}) {
		super();
		this.container = container;
		this.doc = container.ownerDocument;
		this.options = options;
		const storedPrefs = readStoredViewerPrefs();
		this.availableThemes = options.availableThemes ?? THEME_CATALOG;
		this.availableLocales = resolveAvailableLocales(options);
		const themeState = resolveInitialThemeState(
			options,
			storedPrefs.themeKey,
			this.availableThemes,
		);
		this.currentThemeKey = themeState.key;
		this.currentTheme = themeState.theme;
		this.currentLocale = resolveInitialLocale(
			options,
			storedPrefs.localeCode,
			this.availableLocales,
		);
		this.t = createTranslator(this.currentLocale, options.messages);
		this.registry = options.registry ?? createDefaultRegistry();
		this.store = createStore(createInitialViewerState());
		this.loading = createLoadingController({
			options,
			store: this.store,
			getTranslator: () => this.t,
			getEditor: () => this.editor,
			// Late-joiner bootstrap protection: bracket the load commit so an
			// active collaboration session can suppress publishing the parsed
			// deck and instead re-adopt the room's slides when the shared doc
			// already has content (`this.sessions` is constructed later, hence
			// the lazy optional access).
			onContentApplying: () => this.sessions?.beginCollaborationContentLoad(),
			onContentApplied: () => this.sessions?.notifyCollaborationContentLoaded(),
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
			onStageRendered: () => {
				this.editor?.onStageRendered();
				// The stage wrap's children are replaced on every stage render, so
				// the ruler strips have to be re-attached here.
				this.rulers?.sync();
				this.annotations?.sync(this.presenterSnapshot);
			},
		});
		this.controls = createViewerControls(
			this.store,
			this.renderer,
			() => {
				void this.exitPresentation();
			},
			// Read lazily: the options controller is constructed further down.
			() => this.optionsController?.getOptions().advanced.slideShowEndWithBlackSlide,
		);

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
			onInlineTextInput: (elementId, text) =>
				this.sessions.publishCollaborationInlineText(elementId, text),
			flushInlineTextInput: () => this.sessions.flushCollaborationLivePatch(),
		});
		this.editor.attachChrome();
		this.rulers = createRulerController({
			doc: this.doc,
			store: this.store,
			getStageWrap: () => this.lifecycle?.chrome.stageWrap ?? null,
			getScale: () => this.renderer.effectiveScale(),
			getUnit: () => options.rulerUnit ?? 'inches',
			onCreateGuide: (axis, position) => this.editor?.getEditActions().addGuide(axis, position),
		});
		this.annotations = createPresentationAnnotationsHost({
			doc: this.doc,
			t: this.t,
			store: this.store,
			editor: this.editor,
			getChrome: () => this.lifecycle.chrome,
			getSnapshot: () => this.presenterSnapshot,
			updateSnapshot: (patch) => this.updatePresenterSnapshot(patch),
		});
		this.exporter = createExportLifecycle({
			doc: this.doc,
			container: this.container,
			store: this.store,
			registry: this.registry,
			getTranslator: () => this.t,
			smartArt3D: options.smartArt3D ?? false,
		});
		// File > Options controller: owns the persisted options store and turns
		// option values into behavior. Created before the parity workflows (which
		// open the Options dialog against its store) and the chrome; its host
		// methods read `this.*` lazily and are only exercised by `applyAll()`
		// after every subsystem below exists.
		this.optionsController = createViewerOptionsController(
			{
				store: this.store,
				root: () => this.lifecycle?.chrome.root ?? null,
				isAutosaveEnabled: () => this.sessions?.isAutosaveEnabled() ?? false,
				setAutosaveEnabled: (enabled) => this.sessions?.setAutosaveEnabled(enabled),
				setAutosaveIntervalMs: () => {
					// The recovery autosave interval is fixed at construction in the
					// session controllers; a runtime change is a no-op for now.
				},
				setHistoryDepth: (depth) => this.editor?.setHistoryDepth(depth),
				setRibbonHiddenTabs: (tabIds) => this.lifecycle?.chrome.ribbon?.setHiddenOptionTabs(tabIds),
				refreshQuickAccess: () => this.lifecycle?.chrome.titleBar?.refreshQuickAccess(),
				applyScreenTips: () =>
					this.lifecycle?.chrome.ribbon?.applyScreenTips((label) =>
						this.optionsController.screenTip(label),
					),
			},
			// Seed autosave from the constructor option so persisted values (if any)
			// override it, and the default does not force autosave (+ IndexedDB) on.
			{ initial: { save: { autoSave: options.autosave ?? false } } },
		);
		const parityWorkflowHost: ParityWorkflowHost = {
			doc: this.doc,
			t: this.t,
			store: this.store,
			editor: this.editor,
			optionsStore: this.optionsController.optionsStore,
			clearOptionsCache: () => this.clearOptionsCache(),
			aiEnabled: options.ai !== undefined,
			root: () => this.lifecycle.chrome.root,
			setAutosaveEnabled: (enabled) => this.setAutosaveEnabled(enabled),
			print: (printOptions) => this.print(printOptions),
			goToSlide: (index) => this.goToSlide(index),
			renderSlideNode: (slide, scale) => this.renderer.renderSlideNode(slide, scale),
			enterPresentation: () => this.enterPresentation(),
			setTheme: (theme) => this.setTheme(theme),
			setLocale: (locale) => this.setLocale(locale),
			getThemeState: () => ({ key: this.currentThemeKey, catalog: this.availableThemes }),
			getLocaleState: () => ({ code: this.currentLocale, catalog: this.availableLocales }),
		};
		// `t` needs to be a live getter (not the value copy above): `setLocale`
		// reassigns `this.t` on every language switch, and parityWorkflows'
		// dialogs (including Options itself) must read the current translator
		// each time they open, not whatever was active when this host was built.
		Object.defineProperty(parityWorkflowHost, 't', { get: () => this.t });
		this.parityWorkflows = createParityWorkflows(parityWorkflowHost);
		this.setupContextMenu();
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
		this.store.subscribe((state, previous) => {
			if (this.presenterSessionId) {
				this.syncAudience(state.currentSlide);
			}
			this.annotations.sync(this.presenterSnapshot);
			if (previous.presenting && !state.presenting) {
				void this.annotations.finish();
			}
		});
		this.detachSignatureWarning = this.store.subscribe((state, previous) => {
			if (
				state.dirty &&
				!previous.dirty &&
				state.hasDigitalSignatures &&
				!this.signatureWarningAcknowledged
			) {
				this.signatureWarningAcknowledged = true;
				openSignatureStrippedDialog(this.doc, this.t, state.digitalSignatureCount);
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
		// Every subsystem the options controller drives now exists: apply the
		// persisted File > Options values (undo depth, ribbon visibility, root
		// classes, ScreenTips, etc.) for the first time.
		this.optionsController.applyAll();
		this.renderer.renderAll();
		this.setupAiChat();

		if (options.source !== undefined) {
			void this.loading.load(options.source);
		}
		this.connectAudienceRole();
	}

	/**
	 * Mount the optional AI assistant (toggle button + lazy chat panel) when the
	 * host supplied an {@link PptxViewerOptions.ai} config. Re-callable: tears down
	 * a prior mount first, so it can re-attach after a locale-driven chrome
	 * remount. No-op (and never touches the `ai` SDK) when `ai` is absent.
	 */
	/**
	 * Mount the canvas right-click menu against the current chrome. Re-callable:
	 * the chrome (and with it `chrome.viewport`, which owns the `contextmenu`
	 * listener) is rebuilt on every locale switch, so the menu must be re-bound
	 * to the new viewport or right-clicking stops opening anything.
	 */
	private setupContextMenu(): void {
		this.contextMenu?.destroy();
		this.contextMenu = mountElementContextMenu({
			doc: this.doc,
			store: this.store,
			getTranslator: () => this.t,
			viewport: this.lifecycle.chrome.viewport,
			getStageRoot: () =>
				this.lifecycle.chrome.stageWrap.querySelector<HTMLElement>('.pptxv-stage'),
			getEditActions: () => this.editor.getEditActions(),
			selectElement: (id) => this.editor.selectElements([id]),
			openComments: () => this.parityWorkflows.openComments(),
			openHyperlink: () => this.parityWorkflows.openHyperlink(),
			getAi: () => this.aiFocus,
		});
	}

	private setupAiChat(): void {
		const config = this.options.ai;
		if (!config) {
			return;
		}
		this.aiChat?.destroy();
		const controller = createAiFocusController({
			store: this.store,
			requestOpen: () => this.aiChat?.open(),
		});
		// Published so the canvas context menu can offer "Ask AI" / "Fix with AI"
		// as two of its own entries instead of opening a second, AI-only menu.
		this.aiFocus = controller;
		const bridge = createVanillaAiBridge({
			store: this.store,
			editor: this.editor,
			goToSlide: (index) => this.controls.goToSlide(index),
			ensureEditable: () => {
				if (!this.store.get().editable) {
					this.setEditable(true);
				}
			},
			getHandler: () => this.loading.getHandler(),
			applyThemeUpdates: (updates) => this.applyAiThemeUpdates(updates),
			getFocusedTargets: () => controller.getEffectiveTargets(),
		});
		this.aiChat = mountAiChat({
			doc: this.doc,
			chrome: this.lifecycle.chrome,
			t: this.t,
			bridge,
			config,
			store: this.store,
			controller,
			goToSlide: (index) => this.controls.goToSlide(index),
		});
	}

	/**
	 * Merge AI-proposed theme scheme updates into the live deck and re-render.
	 * Theme scheme state sits outside the slides history snapshot, so this is a
	 * best-effort apply (not a strictly undoable step, unlike slide edits).
	 */
	private applyAiThemeUpdates(updates: Partial<PptxTheme>): void {
		if (!updates.colorScheme) {
			return;
		}
		this.store.set({
			colorScheme: { ...(this.store.get().colorScheme ?? {}), ...updates.colorScheme },
		});
		this.renderer.renderAll();
	}

	async loadFile(file: Blob | ArrayBuffer | Uint8Array): Promise<void> {
		this.signatureWarningAcknowledged = false;
		await this.loading.load(file);
	}

	openFile(): void {
		void (async () => {
			const picked = await openPptxFile();
			if (picked) {
				await this.loadFile(picked.buffer);
			}
		})();
	}

	openRecentFile(key: string): void {
		void (async () => {
			const bytes = await readBackstageRecentFile(key);
			if (bytes) {
				await this.loadFile(bytes);
			}
		})();
	}

	createPresentation(templateId: string): void {
		this.editor.commitSlides(createBackstagePresentation(templateId), 0);
	}

	async loadUrl(url: string): Promise<void> {
		this.signatureWarningAcknowledged = false;
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

	/**
	 * Apply a viewer chrome theme (pass `undefined` to reset to defaults).
	 * When `theme` matches a catalog entry's `theme` by reference (the shared
	 * `THEME_CATALOG` presets, or a host's own `availableThemes`), the match
	 * also updates `currentThemeKey` and persists the choice: to
	 * `options.onThemeChange` when the host supplied one, otherwise to
	 * `localStorage` via `writeStoredViewerPrefs`. A theme with no catalog
	 * match (an ad hoc `ViewerTheme` a host passes directly) still applies but
	 * isn't tracked as a "choice", matching how the Design tab's own gallery
	 * already calls this method.
	 */
	setTheme(theme: ViewerTheme | undefined): void {
		this.lifecycle.appliedThemeVars = applyThemeVars(
			this.lifecycle.chrome.root,
			theme,
			this.lifecycle.appliedThemeVars,
		);
		this.currentTheme = theme;
		const key = findThemeCatalogKey(theme, this.availableThemes);
		if (key === undefined) {
			return;
		}
		this.currentThemeKey = key;
		if (this.options.onThemeChange) {
			this.options.onThemeChange(key);
		} else {
			writeStoredViewerPrefs({ themeKey: key });
		}
	}

	applyPresentationTheme(presetId: string): void {
		void applyPresentationThemePreset({
			presetId,
			loading: this.loading,
			store: this.store,
			editor: this.editor,
		});
	}

	/** Run the shared WCAG checks against the live deck and show the results. */
	openAccessibility(): void {
		this.lifecycle.chrome.accessibility.open(collectAccessibilityIssues(this.store.get().slides));
	}

	openSettings(tab: 'general' | 'shortcuts' = 'general'): void {
		this.parityWorkflows.openSettings(tab);
	}

	openSetUpSlideShow(): void {
		this.parityWorkflows.openSetUpSlideShow();
	}

	toggleSubtitles(): void {
		const presentationProperties = this.store.get().presentationProperties;
		this.editor.updatePresentationProperties({
			...presentationProperties,
			showSubtitles: !presentationProperties.showSubtitles,
		});
	}

	openHeaderFooter(): void {
		this.parityWorkflows.openHeaderFooter();
	}

	openCompare(): void {
		this.parityWorkflows.openCompare();
	}

	openPrintDialog(): void {
		this.parityWorkflows.openPrintDialog();
	}

	startRehearsal(): void {
		this.parityWorkflows.startRehearsal();
	}

	openSelectionPane(): void {
		this.parityWorkflows.openSelectionPane();
	}

	openSlideSorter(): void {
		this.parityWorkflows.openSlideSorter();
	}

	/**
	 * PowerPoint's Reading View: the deck at full window size with the chrome
	 * reduced to a nav bar. Not a slide show, so no Fullscreen API is involved.
	 */
	openReadingView(): void {
		this.parityWorkflows.openReadingView();
	}

	/**
	 * PowerPoint's Outline view: the deck as an editable indented text document.
	 * Edits route through the normal whole-deck commit, so they undo like any
	 * other structural change.
	 */
	openOutlineView(): void {
		this.parityWorkflows.openOutlineView();
	}

	openComments(): void {
		this.parityWorkflows.openComments();
	}

	openHyperlink(): void {
		this.parityWorkflows.openHyperlink();
	}

	openCustomShows(): void {
		this.parityWorkflows.openCustomShows();
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

	openFontEmbedding(): void {
		const state = this.store.get();
		openFontEmbeddingDialog(this.doc, this.t, {
			slides: state.slides,
			embeddedFonts: state.embeddedFonts,
			enabled: this.embedFontsEnabled,
			onToggle: (enabled) => (this.embedFontsEnabled = enabled),
		});
	}

	openDigitalSignatures(): void {
		const state = this.store.get();
		openDigitalSignaturesDialog(
			this.doc,
			this.t,
			state.hasDigitalSignatures,
			state.digitalSignatureCount,
		);
	}

	openPasswordProtection(): void {
		openPasswordProtectionDialog(this.doc, this.t, {
			protected: this.store.get().isPasswordProtected,
			onSet: () => {
				this.store.set({ isPasswordProtected: true });
			},
			onRemove: () => {
				this.store.set({ isPasswordProtected: false });
			},
		});
	}

	openVersionHistory(): void {
		openVersionHistoryPanel(this.doc, this.lifecycle.chrome.root, this.t, {
			filePath: this.options.autosaveFilePath ?? 'presentation.pptx',
			onRestore: (bytes) => this.loadFile(bytes),
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

		// The presenter's own screen must be IN the show, not an editor with a
		// console strip laid over it: without this `presenting` stayed false, so
		// the slide stayed editable and neither click-to-advance nor the
		// presentation keymap reached it. This runs AFTER the popup is opened
		// because opening a popup cancels an in-flight fullscreen request.
		if (!this.store.get().presenting) {
			void this.enterPresentation();
		}
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

	/** Current presenter snapshot (pointer tool, blackout, ink, captions). */
	getPresenterSnapshot(): PresentationSnapshot {
		return this.presenterSnapshot;
	}

	updatePresenterSnapshot(patch: Partial<PresentationSnapshot>): void {
		this.presenterSnapshot = mergePresentationSnapshot(this.presenterSnapshot, patch);
		renderAudienceEffects(this.container, this.presenterSnapshot);
		this.syncAudience(this.presenterSnapshot.slideIndex);
		this.annotations.sync(this.presenterSnapshot);
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
					// Close this tab; when the browser refuses, raise the black
					// end-of-slide-show screen. Leaving presentation mode would drop
					// the room into the editor.
					if (endAudienceDisplay(window)) {
						this.store.set({ endOfShow: true });
					}
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

	/**
	 * Switch the UI locale (rebuilds the chrome labels). Persists the choice
	 * the same way {@link setTheme} does: `options.onLocaleChange` when the
	 * host supplied one, otherwise `localStorage` via `writeStoredViewerPrefs`.
	 */
	setLocale(locale: string): void {
		this.t = createTranslator(locale, this.options.messages);
		this.currentLocale = locale;
		// Chrome labels are baked at build time; rebuild it under the new locale.
		this.remountChrome();
		this.editor.attachChrome();
		this.setupContextMenu();
		this.setupAiChat();
		this.renderer.renderAll();
		if (this.options.onLocaleChange) {
			this.options.onLocaleChange(locale);
		} else {
			writeStoredViewerPrefs({ localeCode: locale });
		}
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

	/**
	 * Live Quick Access Toolbar options for the title-bar strip.
	 *
	 * The chrome is mounted BEFORE the options controller is constructed, so the
	 * very first strip render falls back to the shared defaults; the controller's
	 * `applyAll()` re-renders it from the persisted options moments later.
	 */
	getQuickAccessOptions(): ViewerQuickAccessOptions {
		const controller = this.optionsController as ViewerOptionsController | undefined;
		return controller?.getOptions().quickAccess ?? DEFAULT_VIEWER_OPTIONS.quickAccess;
	}

	/** ScreenTip-styled tooltip for a Quick Access button; see above for timing. */
	quickAccessScreenTip(label: string): string | undefined {
		const controller = this.optionsController as ViewerOptionsController | undefined;
		return controller?.screenTip(label) ?? label;
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
		// An audience display mirrors the presenter's screen: Escape, leaving
		// fullscreen and the advance past the end screen must never hand the room
		// the editing chrome.
		if (!mayLeaveSlideShow()) {
			return;
		}
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

	openShare(): void {
		this.sessions.openShare();
	}

	destroy(): void {
		if (this.destroyed) {
			return;
		}
		this.destroyed = true;
		this.aiChat?.destroy();
		this.aiChat = null;
		this.aiFocus = null;
		this.contextMenu?.destroy();
		this.contextMenu = null;
		this.rulers?.destroy();
		this.rulers = null;
		this.parityWorkflows.closeReadingView();
		this.parityWorkflows.closeOutlineView();
		this.closeAudienceWindow();
		this.presenterChannel?.close();
		this.sessions.destroy();
		this.optionsController.dispose();
		this.detachSignatureWarning?.();
		this.loading.invalidate();
		this.editor.destroy();
		this.annotations.dispose();
		this.exporter.destroy();
		this.userFontsStyle?.remove();
		unmountChrome(this.lifecycle, () => this.editor?.detachChrome());
		this.loading.releaseLoaded();
	}

	/** File > Options > Save > "Delete cached files": drop recovery snapshots. */
	private clearOptionsCache(): void {
		void (async () => {
			const snapshots = await listAutosaveSnapshots();
			await Promise.all(snapshots.map((entry) => deleteAutosaveSnapshot(entry.key)));
		})();
	}

	private remountChrome(): void {
		unmountChrome(this.lifecycle, () => this.editor?.detachChrome());
		this.lifecycle = mountChrome(buildMountChromeDeps(this));
		// Re-apply option-driven chrome behavior (ribbon visibility, ScreenTips,
		// quick access) against the freshly mounted chrome.
		this.optionsController.applyAll();
	}
}

/** Create a PowerPoint viewer inside `container` (see {@link PptxViewerOptions}). */
export function createPptxViewer(
	container: HTMLElement,
	options: PptxViewerOptions = {},
): PptxViewerInstance {
	return new PptxViewer(container, options);
}
