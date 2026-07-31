import type { PptxSaveFormat, TextSegment } from 'pptx-viewer-core';
import type {
	PresentationPointerTool,
	PresentationSnapshot,
	ViewerQuickAccessOptions,
	ViewerTheme,
} from 'pptx-viewer-shared';
import { isPresentationAdvanceClick } from 'pptx-viewer-shared';

import { buildChromeCallbacks } from './chrome-callbacks';
import type { ChromeCallbackDeps } from './chrome-callbacks';
import type { EditActions } from './editor';
import type { FindReplaceActions } from './editor/editor-find-replace-actions';
import type { Translator } from './i18n';
import { isSwipeAdvanceBlocked } from './presentation-advance-gate';
import { attachAutoAdvance } from './presentation-auto-advance';
import type { RenderController } from './render-controller';
import type { DrawTool, Store, ViewerState } from './state';
import { applyThemeVars } from './theme-apply';
import type { PptxViewerOptions } from './types';
import type { PresentationController, ViewerChrome } from './ui';
import {
	attachKeyboardNavigation,
	attachTouchGestures,
	buildViewerChrome,
	createPresentationController,
} from './ui';
import type { CommandSearchCommand } from './ui/command-search';

/** The mutable pieces `PptxViewer` owns for one chrome mount lifecycle. */
export interface ChromeLifecycle {
	chrome: ViewerChrome;
	presentation: PresentationController;
	detachKeyboard: () => void;
	detachTouchGestures: () => void;
	/** Remove the presenting click-to-advance listener. */
	detachPresentationClick: () => void;
	resizeObserver: ResizeObserver | null;
	appliedThemeVars: string[];
}

export interface MountChromeDeps extends ChromeCallbackDeps {
	doc: Document;
	container: HTMLElement;
	t: Translator;
	options: PptxViewerOptions;
	store: Store<ViewerState>;
	renderer: RenderController;
	/**
	 * The theme to apply on mount: the viewer's live `currentTheme` (tracks
	 * `setTheme` calls), not the static constructor `options.theme`. Falling
	 * back to `options.theme` keeps direct `MountChromeDeps` construction (e.g.
	 * tests) working without this field.
	 */
	initialTheme?: ViewerTheme;
	goToFirstSlide(): void;
	goToLastSlide(): void;
	exitPresentation(): void;
	/** Select a slide-show pointer tool (Ctrl+L / Ctrl+P / Ctrl+A / Ctrl+E). */
	setPresentationPointerTool?(tool: PresentationPointerTool): void;
	/** Erase the show's ink annotations (E). */
	erasePresentationAnnotations?(): void;
	/** Show or hide ink markup (Ctrl+M). */
	togglePresentationInkMarkup?(): void;
	/** Blank the screen black or white (B / W, or `.` / `,`). */
	togglePresentationBlank?(value: 'black' | 'white'): void;
	/** Live File > Options > Quick Access Toolbar group driving the strip. */
	getQuickAccessOptions(): ViewerQuickAccessOptions;
	/** ScreenTip-styled tooltip for a strip button (undefined suppresses it). */
	quickAccessScreenTip(label: string): string | undefined;
}

/**
 * Map a Quick Access catalog id onto the chrome's existing handlers.
 *
 * Save/Undo/Redo are handled by the title bar itself (they carry the
 * `hiddenActions` gate and the enabled state), so only the remaining
 * options-configured commands reach here.
 */
function buildQuickAccessRunner(deps: MountChromeDeps): (id: string) => void {
	const handlers: Record<string, () => void> = {
		presentFromStart: () => deps.startPresentationFromBeginning(),
		print: () => void deps.print(),
		exportPdf: () => void deps.exportPdf(),
		newSlide: () => deps.getEditActions().addSlide(),
		spellCheck: () => deps.getEditActions().toggleSpellCheck(),
		zoomIn: () => deps.zoomIn(),
		zoomOut: () => deps.zoomOut(),
	};
	return (id) => handlers[id]?.();
}

/**
 * Build the chrome DOM, wire keyboard nav + the Fullscreen presentation
 * controller + a fit-zoom resize observer, and mount it into `container`.
 * Extracted from `PptxViewer` so the class stays under the file-size budget;
 * pure aside from the DOM/observer side effects the chrome itself requires.
 */
export function mountChrome(deps: MountChromeDeps): ChromeLifecycle {
	const { doc, container, t, options, store, renderer } = deps;
	const chrome = buildViewerChrome(doc, t, {
		showToolbar: options.showToolbar ?? true,
		showThumbnails: options.showThumbnails ?? true,
		showFormatToolbar: options.showFormatToolbar ?? true,
		showInspector: options.showInspector ?? true,
		editable: options.editable ?? false,
		hiddenActions: options.hiddenActions,
		titleBar: {
			fileName: options.fileName,
			autosaveEnabled: options.autosave ?? false,
			onToggleAutosave: () => deps.toggleAutosave(),
			save: () => deps.save(),
			undo: () => deps.undo(),
			redo: () => deps.redo(),
			commands: buildTitleBarCommands(deps),
			hiddenActions: options.hiddenActions,
			// Without this the strip fell back to a hardcoded Save/Undo/Redo trio
			// and ignored File > Options entirely.
			quickAccess: {
				getState: () => deps.getQuickAccessOptions(),
				run: buildQuickAccessRunner(deps),
				screenTip: (label) => deps.quickAccessScreenTip(label),
			},
		},
		accountAuth: options.accountAuth,
		...buildChromeCallbacks(deps),
	});
	const appliedThemeVars = applyThemeVars(chrome.root, deps.initialTheme ?? options.theme, []);
	container.appendChild(chrome.root);
	chrome.statusBar?.setNotesExpanded(store.get().notesExpanded);
	chrome.statusBar?.setDirty(store.get().dirty);
	chrome.mobileActionSheets?.setNotesExpanded(store.get().notesExpanded);
	chrome.titleBar?.setDirty(store.get().dirty);

	const detachKeyboard = attachKeyboardNavigation(chrome.root, {
		next: deps.next,
		prev: deps.prev,
		first: deps.goToFirstSlide,
		last: deps.goToLastSlide,
		escape: deps.exitPresentation,
		isPresenting: () => store.get().presenting,
		goToSlide: deps.goToSlide,
		getSlideCount: () => store.get().slides.length,
		setPointerTool: deps.setPresentationPointerTool,
		eraseAnnotations: deps.erasePresentationAnnotations,
		toggleInkMarkup: deps.togglePresentationInkMarkup,
		toggleBlank: deps.togglePresentationBlank,
	});
	const detachTouchGestures = attachTouchGestures(chrome.root, {
		getScale: () => renderer.effectiveScale(),
		onPinchZoom: (zoom) => store.set({ zoom }),
		isSwipeEnabled: () => {
			const state = store.get();
			return state.presenting || !state.editable;
		},
		onNext: () => {
			// A swipe/tap on the slide is PowerPoint's "on mouse click" advance, so
			// it is gated by the current slide's advanceOnClick transition flag.
			// Keyboard and the on-screen next button call deps.next() directly and
			// are never gated.
			const state = store.get();
			if (
				isSwipeAdvanceBlocked({
					presenting: state.presenting,
					animationBuildsComplete: renderer.presentationPlayback.isComplete(),
					currentSlide: state.slides[state.currentSlide],
				})
			) {
				return;
			}
			deps.next();
		},
		onPrevious: () => deps.prev(),
	});

	/**
	 * Mouse click-to-advance while presenting. Touch already advances on tap
	 * (above); a mouse click did nothing, so a show driven from the presenter
	 * console could only be moved with the keyboard or the console's buttons.
	 * Gated exactly like the tap path (`advanceOnClick` + pending builds) and
	 * only for clicks that land on the slide itself, so the console strip,
	 * toolbars and dialogs keep owning their own clicks.
	 */
	/**
	 * The black "End of slide show" screen. Kept as a single node toggled by the
	 * store rather than re-rendered with the stage, so it survives the stage
	 * rebuild that every navigation performs.
	 */
	const endScreen = doc.createElement('button');
	endScreen.type = 'button';
	endScreen.setAttribute('data-pptx-end-of-show', '');
	endScreen.className = 'pptxv-presentation-end';
	Object.assign(endScreen.style, {
		position: 'absolute',
		inset: '0',
		zIndex: '90',
		display: 'flex',
		alignItems: 'flex-start',
		border: '0',
		padding: '0',
		background: '#000',
		textAlign: 'left',
		cursor: 'default',
	});
	const endLabel = doc.createElement('span');
	Object.assign(endLabel.style, {
		padding: '12px 16px',
		color: 'rgba(255,255,255,0.7)',
		fontSize: '12px',
	});
	endLabel.textContent = t('pptx.presentation.endOfSlideShow');
	endScreen.appendChild(endLabel);
	// A click on the end screen ends the show, like PowerPoint's "click to exit".
	endScreen.addEventListener('click', (event: MouseEvent) => {
		event.stopPropagation();
		deps.next();
	});
	const syncEndScreen = (): void => {
		const state = store.get();
		const shouldShow = state.presenting && state.endOfShow;
		if (shouldShow && endScreen.parentElement !== chrome.root) {
			chrome.root.appendChild(endScreen);
		} else if (!shouldShow && endScreen.parentElement) {
			endScreen.remove();
		}
	};
	const detachEndScreen = store.subscribe(syncEndScreen);
	syncEndScreen();

	const onPresentationClick = (event: MouseEvent): void => {
		const state = store.get();
		if (!state.presenting || !(event.target instanceof Element)) {
			return;
		}
		// Live slide content and show chrome own their own clicks; the shared
		// rule keeps every binding advancing on exactly the same targets.
		if (!isPresentationAdvanceClick(event.target)) {
			return;
		}
		if (!event.target.closest('.pptxv-stage')) {
			return;
		}
		if (
			isSwipeAdvanceBlocked({
				presenting: state.presenting,
				animationBuildsComplete: renderer.presentationPlayback.isComplete(),
				currentSlide: state.slides[state.currentSlide],
			})
		) {
			return;
		}
		deps.next();
	};
	chrome.root.addEventListener('click', onPresentationClick);

	// PowerPoint's "Advance slide: After <n>". Without it a deck whose slide also
	// sets "on mouse click" OFF has no way forward at all: the gate above
	// swallows every click and tap, and the show sits there for ever.
	const detachAutoAdvance = attachAutoAdvance({
		getState: () => store.get(),
		subscribe: (listener) => store.subscribe(listener),
		next: () => deps.next(),
	});

	const detachPresentationClick = (): void => {
		chrome.root.removeEventListener('click', onPresentationClick);
		detachAutoAdvance();
		detachEndScreen();
		endScreen.remove();
	};
	const presentation = createPresentationController(chrome.root, (presenting) => {
		store.set({ presenting });
	});

	let resizeObserver: ResizeObserver | null = null;
	if (typeof ResizeObserver !== 'undefined') {
		resizeObserver = new ResizeObserver(() => {
			if (store.get().zoom === 'fit') {
				renderer.renderStage();
			}
		});
		resizeObserver.observe(chrome.viewport);
	}

	return {
		chrome,
		presentation,
		detachKeyboard,
		detachTouchGestures,
		detachPresentationClick,
		resizeObserver,
		appliedThemeVars,
	};
}

/** The local command palette mirrors React's most useful quick actions. */
function buildTitleBarCommands(deps: MountChromeDeps): readonly CommandSearchCommand[] {
	return [
		{ labelKey: 'pptx.titleBar.save', run: () => deps.save() },
		{ labelKey: 'pptx.toolbar.undo', run: () => deps.undo() },
		{ labelKey: 'pptx.toolbar.redo', run: () => deps.redo() },
	];
}

/** Tear down everything `mountChrome` set up, in reverse order. */
export function unmountChrome(lifecycle: ChromeLifecycle, detachEditorChrome: () => void): void {
	detachEditorChrome();
	lifecycle.detachKeyboard();
	lifecycle.detachPresentationClick();
	lifecycle.detachTouchGestures();
	lifecycle.resizeObserver?.disconnect();
	lifecycle.presentation.dispose();
	lifecycle.chrome.root.remove();
}

/** The subset of `PptxViewer` needed to build its `MountChromeDeps`. */
export interface ChromeHost {
	doc: Document;
	container: HTMLElement;
	t: Translator;
	options: PptxViewerOptions;
	store: Store<ViewerState>;
	renderer: RenderController;
	lifecycle: ChromeLifecycle;
	/** The viewer's live theme (kept in sync by `setTheme`); read on mount/remount instead of the static `options.theme`. */
	currentTheme: ViewerTheme | undefined;
	editor: {
		commitNotes(notes: string, notesSegments?: TextSegment[]): void;
		getEditActions(): EditActions;
		getFindReplaceActions(): FindReplaceActions;
		setDrawTool(tool: DrawTool): void;
		setDrawColor(color: string): void;
		setDrawWidth(width: number): void;
	};
	prev(): void;
	next(): void;
	zoomIn(): void;
	zoomOut(): void;
	zoomToFit(): void;
	undo(): void;
	redo(): void;
	/** Live File > Options > Quick Access Toolbar group driving the strip. */
	getQuickAccessOptions(): ViewerQuickAccessOptions;
	/** ScreenTip-styled tooltip for a strip button (undefined suppresses it). */
	quickAccessScreenTip(label: string): string | undefined;
	toggleAutosave(): boolean;
	downloadPptx(): Promise<void>;
	downloadAs(format: PptxSaveFormat): Promise<void>;
	packageForSharing(): Promise<void>;
	toggleNotes(): void;
	goToSlide(index: number): void;
	/** Home: the show's first slide (skips a hidden slide 1 while presenting). */
	goToFirstSlide(): void;
	/** End: the show's last slide (skips trailing hidden slides while presenting). */
	goToLastSlide(): void;
	getSlideCount(): number;
	enterPresentation(): Promise<void>;
	openPresenterView(): void;
	exitPresentation(): Promise<void>;
	getPresenterSnapshot(): PresentationSnapshot;
	updatePresenterSnapshot(patch: Partial<PresentationSnapshot>): void;
	openBroadcast(): void;
	openShare(): void;
	openAccessibility(): void;
	openSettings(tab?: 'general' | 'shortcuts'): void;
	openHeaderFooter(): void;
	openCompare(): void;
	openSetUpSlideShow(): void;
	/** PowerPoint's Hide Slide: toggle the active slide's skip-in-show flag. */
	toggleHideCurrentSlide(): void;
	startRehearsal(): void;
	toggleSubtitles(): void;
	openSelectionPane(): void;
	openSlideSorter(): void;
	openReadingView(): void;
	openOutlineView(): void;
	openComments(): void;
	openHyperlink(): void;
	openCustomShows(): void;
	openDocumentProperties(): void;
	openFontEmbedding(): void;
	openDigitalSignatures(): void;
	openPasswordProtection(): void;
	openVersionHistory(): void;
	toggleTemplateEditing(): void;
	toggleMasterNavigation(): void;
	selectElements(ids: string[]): void;
	exportSlidePng(): Promise<void>;
	copySlideAsImage(): Promise<void>;
	exportPdf(): Promise<void>;
	exportGif(): Promise<void>;
	exportVideo(): Promise<void>;
	print(): Promise<boolean>;
	openPrintDialog(): void;
	openFile(): void;
	openRecentFile(key: string): void;
	createPresentation(templateId: string): void;
	setTheme(theme: ViewerTheme | undefined): void;
	applyPresentationTheme(presetId: string): void;
}

/** Build `mountChrome`'s deps from the live viewer instance. */
export function buildMountChromeDeps(host: ChromeHost): MountChromeDeps {
	return {
		doc: host.doc,
		container: host.container,
		t: host.t,
		options: host.options,
		store: host.store,
		renderer: host.renderer,
		initialTheme: host.currentTheme,
		prev: () => host.prev(),
		next: () => host.next(),
		zoomIn: () => host.zoomIn(),
		zoomOut: () => host.zoomOut(),
		zoomToFit: () => host.zoomToFit(),
		togglePresentation: () =>
			void (host.lifecycle.presentation.isActive()
				? host.exitPresentation()
				: host.enterPresentation()),
		returnToNormalView: () => {
			// Return to the normal editing view: leave presentation if it is
			// running and dismiss the (modal) slide-sorter overlay if it is open.
			if (host.store.get().presenting) {
				void host.exitPresentation();
			}
			host.container.querySelector('[data-pptx-slide-sorter]')?.remove();
		},
		undo: () => host.undo(),
		redo: () => host.redo(),
		toggleAutosave: () => host.toggleAutosave(),
		startPresentationFromBeginning: () => {
			host.goToSlide(0);
			void host.enterPresentation();
		},
		startPresentationFromCurrent: () => void host.enterPresentation(),
		openPresenterView: () => host.openPresenterView(),
		openBroadcast: () => host.openBroadcast(),
		openShare: () => host.openShare(),
		openAccessibility: () => host.openAccessibility(),
		openSettings: (tab) => host.openSettings(tab),
		openHeaderFooter: () => host.openHeaderFooter(),
		openCompare: () => host.openCompare(),
		openSetUpSlideShow: () => host.openSetUpSlideShow(),
		toggleHideCurrentSlide: () => host.toggleHideCurrentSlide(),
		startRehearsal: () => host.startRehearsal(),
		toggleSubtitles: () => host.toggleSubtitles(),
		openSelectionPane: () => host.openSelectionPane(),
		openSlideSorter: () => host.openSlideSorter(),
		openReadingView: () => host.openReadingView(),
		openOutlineView: () => host.openOutlineView(),
		openComments: () => host.openComments(),
		openHyperlink: () => host.openHyperlink(),
		openCustomShows: () => host.openCustomShows(),
		openDocumentProperties: () => host.openDocumentProperties(),
		openFontEmbedding: () => host.openFontEmbedding(),
		openDigitalSignatures: () => host.openDigitalSignatures(),
		openPasswordProtection: () => host.openPasswordProtection(),
		openVersionHistory: () => host.openVersionHistory(),
		toggleTemplateEditing: () => host.toggleTemplateEditing(),
		toggleMasterNavigation: () => host.toggleMasterNavigation(),
		toggleInspector: () => host.store.set({ inspectorOpen: !host.store.get().inspectorOpen }),
		selectElement: (id) => host.selectElements([id]),
		save: () => void host.downloadPptx(),
		downloadAs: (format) => host.downloadAs(format),
		packageForSharing: () => host.packageForSharing(),
		toggleNotes: () => host.toggleNotes(),
		goToSlide: (index) => host.goToSlide(index),
		goToFirstSlide: () => host.goToFirstSlide(),
		goToLastSlide: () => host.goToLastSlide(),
		exitPresentation: () => void host.exitPresentation(),
		setPresentationPointerTool: (tool) => {
			const pointer = host.getPresenterSnapshot().pointer ?? { x: 0.5, y: 0.5, color: '#ef4444' };
			host.updatePresenterSnapshot({ pointer: { ...pointer, tool } });
		},
		erasePresentationAnnotations: () => host.updatePresenterSnapshot({ inkStrokes: [] }),
		togglePresentationInkMarkup: () =>
			host.updatePresenterSnapshot({
				inkMarkupVisible: host.getPresenterSnapshot().inkMarkupVisible === false,
			}),
		togglePresentationBlank: (value) =>
			host.updatePresenterSnapshot({
				blackout: host.getPresenterSnapshot().blackout === value ? 'none' : value,
			}),
		commitNotes: (notes, notesSegments) => host.editor.commitNotes(notes, notesSegments),
		exportSlidePng: () => host.exportSlidePng(),
		copySlideAsImage: () => host.copySlideAsImage(),
		exportPdf: () => host.exportPdf(),
		exportGif: () => host.exportGif(),
		exportVideo: () => host.exportVideo(),
		print: () => Promise.resolve((host.openPrintDialog(), true)),
		openFile: () => host.openFile(),
		openRecentFile: (key) => host.openRecentFile(key),
		createPresentation: (templateId) => host.createPresentation(templateId),
		getEditActions: () => host.editor.getEditActions(),
		getFindReplaceActions: () => host.editor.getFindReplaceActions(),
		setTheme: (theme) => host.setTheme(theme),
		applyPresentationTheme: (presetId) => host.applyPresentationTheme(presetId),
		setDrawTool: (tool) => host.editor.setDrawTool(tool),
		setDrawColor: (color) => host.editor.setDrawColor(color),
		setDrawWidth: (width) => host.editor.setDrawWidth(width),
		getQuickAccessOptions: () => host.getQuickAccessOptions(),
		quickAccessScreenTip: (label) => host.quickAccessScreenTip(label),
	};
}
