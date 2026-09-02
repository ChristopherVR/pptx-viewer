import type { PptxSaveFormat, TextSegment } from 'pptx-viewer-core';
import { readRibbonTransitionDraft, safeOpenUrl, toggleBlackboard } from 'pptx-viewer-shared';
import type {
	PresentationPointerState,
	PresentationPointerTool,
	PresentationSnapshot,
	ViewerQuickAccessOptions,
	ViewerTheme,
} from 'pptx-viewer-shared';

import { buildChromeCallbacks } from './chrome-callbacks';
import type { ChromeCallbackDeps } from './chrome-callbacks';
import type { EditActions } from './editor';
import type { FindReplaceActions } from './editor/editor-find-replace-actions';
import type { Translator } from './i18n';
import { buildPresentationActionRunner } from './presentation-action-runner';
import { isSwipeAdvanceBlocked, resolvePresentationStageClick } from './presentation-advance-gate';
import { attachAutoAdvance } from './presentation-auto-advance';
import { attachShowVisibilityPause } from './presentation-visibility';
import { createCustomShowRunner } from './presenter/presentation-custom-show-runner';
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
	mountPresentationContextMenu,
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
	/**
	 * The title-bar AutoSave switch state: the user's preference inside the
	 * host's `autosave` ceiling. Omitted (direct construction in tests) falls
	 * back to the ceiling itself, which is on unless the host said `false`.
	 */
	isAutosaveSwitchOn?(): boolean;
	/** Whether that switch can change anything (`autosave: false` makes it inert). */
	isAutosaveToggleAvailable?(): boolean;
	goToFirstSlide(): void;
	goToLastSlide(): void;
	/** "Present From Beginning"'s target deck index (skips a hidden slide 1 / honours the authored range). */
	firstShowSlideIndex(): number;
	exitPresentation(): void;
	/** Select a slide-show pointer tool (Ctrl+L / Ctrl+P / Ctrl+A / Ctrl+E). */
	setPresentationPointerTool?(tool: PresentationPointerTool): void;
	/** Set the slide-show pointer/ink colour (show toolbar's colour palettes). */
	setPresentationPointerColor?(color: string): void;
	/** Open or close the presenter console + audience display (show toolbar). */
	togglePresenterView?(): void;
	/** Raise the presenter console's "See All Slides" navigator (Ctrl+S). */
	showPresentationAllSlides?(): void;
	/** File > Options > Advanced > "Show menu on right mouse click". */
	shouldShowPresentationContextMenu?(): boolean;
	/**
	 * Say what a fullscreen exit seen while the show is running actually meant.
	 *
	 * Opening the audience display is a `window.open`, and every engine drops
	 * the opener out of fullscreen when the popup takes focus. That arrives as
	 * an ordinary `fullscreenchange`, indistinguishable from the presenter
	 * pressing Escape unless the code that opened the popup says so, which is
	 * what `render/presenter-show-lifecycle`'s latch is for. Without this hook
	 * the console mounted and the show underneath it was torn down.
	 */
	classifyPresentationExit?(): 'end-show' | 'restore-show';
	/** Erase the show's ink annotations (E). */
	erasePresentationAnnotations?(): void;
	/** Show or hide ink markup (Ctrl+M). */
	togglePresentationInkMarkup?(): void;
	/** Blank the screen black or white (B / W, or `.` / `,`). */
	togglePresentationBlank?(value: 'black' | 'white'): void;
	/** One-click blackboard: arm/disarm the black screen + pen (show toolbar). */
	togglePresentationBlackboard?(): void;
	/** Live File > Options > Quick Access Toolbar group driving the strip. */
	getQuickAccessOptions(): ViewerQuickAccessOptions;
	/** ScreenTip-styled tooltip for a strip button (undefined suppresses it). */
	quickAccessScreenTip(label: string): string | undefined;
	/** Trust Center > Protected View's "Enable Editing" banner button. */
	enableEditingFromProtectedView(): void;
	/** The read-only recommendation banner's "Edit anyway" button. */
	editAnywayFromReadOnlyRecommendation(): void;
	/** The read-only recommendation banner's plain close button. */
	dismissReadOnlyBanner(): void;
	/** One compatibility toast's own dismiss button. */
	dismissCompatToast(id: string): void;
	/** The compatibility toast stack's "Dismiss all" button. */
	dismissAllCompatToasts(): void;
	/**
	 * Trust Center > "Confirm before opening external hyperlinks": shows the
	 * confirm prompt when the option applies to `url` and reports whether the
	 * navigation may proceed. Omitted (direct construction in tests) opens
	 * unconditionally, matching the pre-existing behavior for a binding that
	 * has not wired the gate.
	 */
	confirmExternalHyperlink?(url: string): boolean;
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
			// The host option is a policy CEILING, not the preference: it only
			// forces the switch off (and inert) when it is explicitly `false`.
			autosaveEnabled: deps.isAutosaveSwitchOn?.() ?? options.autosave !== false,
			autosaveToggleAvailable: deps.isAutosaveToggleAvailable?.() ?? options.autosave !== false,
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
		// The show toolbar's annotation controls have no ribbon equivalent, so
		// they are wired straight to the presenter-snapshot mutators the keyboard
		// shortcuts already use; both surfaces then drive one source of truth.
		presentationToolbarHandlers: {
			setTool: (tool) => deps.setPresentationPointerTool?.(tool),
			setColor: (color) => deps.setPresentationPointerColor?.(color),
			toggleBlackboard: () => deps.togglePresentationBlackboard?.(),
			clearAnnotations: () => deps.erasePresentationAnnotations?.(),
			togglePresenterView: () => deps.togglePresenterView?.(),
		},
		onEnableEditing: () => deps.enableEditingFromProtectedView(),
		onEditAnywayFromReadOnly: () => deps.editAnywayFromReadOnlyRecommendation(),
		onDismissReadOnlyBanner: () => deps.dismissReadOnlyBanner(),
		onDismissCompatToast: (id) => deps.dismissCompatToast(id),
		onDismissAllCompatToasts: () => deps.dismissAllCompatToasts(),
		...buildChromeCallbacks(deps),
	});
	const appliedThemeVars = applyThemeVars(chrome.root, deps.initialTheme ?? options.theme, []);
	container.appendChild(chrome.root);
	chrome.statusBar?.setNotesExpanded(store.get().notesExpanded);
	chrome.statusBar?.setDirty(store.get().dirty);
	chrome.mobileActionSheets?.setNotesExpanded(store.get().notesExpanded);
	chrome.titleBar?.setDirty(store.get().dirty);
	chrome.setProtectedView(store.get().protectedView);
	chrome.setReadOnlyRecommendation(
		store.get().readOnlyRecommendation,
		store.get().readOnlyBannerDismissed,
	);
	chrome.setCompatToasts(store.get().compatToasts);

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
		// PowerPoint's bare `J` during a show. The ribbon's Subtitles command
		// writes the same presentation property, so the key and the button cannot
		// disagree about whether captions are up.
		toggleSubtitles: deps.toggleSubtitles,
		// PowerPoint's Ctrl+H. Driven straight at the bar's own visibility flag,
		// the one auto-hide writes, so the shortcut and the countdown cannot
		// disagree; a second flag here would fight the next mouse move.
		toggleChrome: () => chrome.presentationToolbar.toggleVisible(),
		// PowerPoint's Ctrl+S ("See All Slides"). Vanilla builds the navigator
		// inside the presenter console, so the host raises the console with the
		// grid already up rather than this module rebuilding a second copy.
		showAllSlides: deps.showPresentationAllSlides,
	});
	const detachTouchGestures = attachTouchGestures(chrome.root, {
		getScale: () => renderer.effectiveScale(),
		// Routed through the controls, not written to the store directly: the
		// zoom model (and its bounds) lives in the shared zoom store now, and a
		// raw store write would bypass it - which is how the pinch gesture ended
		// up as the one zoom entry point with no clamping at all.
		onPinchZoom: (zoom) => deps.setZoom(zoom),
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

	// `ppaction://hlinkshowjump?jump=lastslideviewed`: the deck index the show
	// was on immediately before the current one. Tracked here (not derived from
	// `viewer-controls`' show order) because "last viewed" is genuinely the
	// previous slide the audience SAW, including a jump made by a different
	// action or a custom show, not "the previous slide in show order".
	let previousPresentedSlide: number | null = null;
	const detachLastViewedTracker = store.subscribe((state, previous) => {
		if (state.presenting && state.currentSlide !== previous.currentSlide) {
			previousPresentedSlide = previous.currentSlide;
		}
		if (previous.presenting && !state.presenting) {
			previousPresentedSlide = null;
		}
	});
	const customShowRunner = createCustomShowRunner(store, (index) => deps.goToSlide(index));
	const presentationActionRunner = buildPresentationActionRunner({
		goToSlide: (index) => deps.goToSlide(index),
		next: () => deps.next(),
		prev: () => deps.prev(),
		exitPresentation: () => deps.exitPresentation(),
		confirmExternalHyperlink: deps.confirmExternalHyperlink,
		getStageRoot: () => chrome.stageWrap,
		getPreviousPresentedSlide: () => previousPresentedSlide,
		getCurrentSlide: () => {
			const state = store.get();
			return state.slides[state.currentSlide];
		},
		customShowRunner,
	});

	const onPresentationClick = (event: MouseEvent): void => {
		const state = store.get();
		if (!state.presenting || !(event.target instanceof Element)) {
			return;
		}
		if (!event.target.closest('.pptxv-stage')) {
			return;
		}
		// PowerPoint's precedence (an on-slide Action Setting under the pointer,
		// then live content that owns its click, then the show's own advance)
		// lives in `presentation-advance-gate` so it can be unit-tested without
		// standing up the whole chrome.
		const shouldAdvance = resolvePresentationStageClick({
			target: event.target,
			presenting: state.presenting,
			animationBuildsComplete: renderer.presentationPlayback.isComplete(),
			currentSlide: state.slides[state.currentSlide],
			slideCount: state.slides.length,
			runner: presentationActionRunner,
		});
		if (!shouldAdvance) {
			return;
		}
		deps.next();
	};
	chrome.root.addEventListener('click', onPresentationClick);

	/**
	 * A run-level text hyperlink (`<a class="pptxv-link" href>`, see
	 * `render/elements/text-block.ts`) is a real anchor with `target="_blank"`:
	 * left un-intercepted, the browser navigates on its own before any Trust
	 * Center gate gets a look-in, in both editing/view and presentation mode.
	 * `resolveHyperlinkHref` already keeps internal `ppaction://` jumps from
	 * ever becoming one of these, so every match here is a genuine external
	 * navigation candidate.
	 */
	const onHyperlinkClick = (event: MouseEvent): void => {
		if (!(event.target instanceof Element)) {
			return;
		}
		const anchor = event.target.closest('a.pptxv-link');
		const href = anchor?.getAttribute('href');
		if (!anchor || !href) {
			return;
		}
		event.preventDefault();
		if (deps.confirmExternalHyperlink?.(href) ?? true) {
			safeOpenUrl(href);
		}
	};
	chrome.root.addEventListener('click', onHyperlinkClick);

	// PowerPoint's "Advance slide: After <n>". Without it a deck whose slide also
	// sets "on mouse click" OFF has no way forward at all: the gate above
	// swallows every click and tap, and the show sits there for ever.
	const autoAdvance = attachAutoAdvance({
		getState: () => store.get(),
		subscribe: (listener) => store.subscribe(listener),
		next: () => deps.next(),
	});

	// A hidden tab is a paused show (media + auto-advance), and the end of the
	// show is the end of its cross-slide persistent audio. See
	// `presentation-visibility.ts`.
	const detachShowVisibility = attachShowVisibilityPause({
		getPresenting: () => store.get().presenting,
		subscribe: (listener) => store.subscribe(listener),
		root: chrome.root,
		cancelAutoAdvance: autoAdvance.cancel,
		rearmAutoAdvance: autoAdvance.rearm,
	});

	// Options > Advanced > "Show menu on right mouse click": right-click opens
	// a minimal Next/Previous/End Show menu (plus pointer tools, See All
	// Slides, presenter view and the black/white blank screen); off swallows
	// the click entirely (no browser menu either), matching every other
	// binding. Gated on `store.get().presenting` internally, so it never
	// interferes with the editor's own `element-context-menu`.
	const presentationContextMenu = mountPresentationContextMenu({
		doc,
		store,
		root: chrome.root,
		getTranslator: () => deps.t,
		shouldShow: () => deps.shouldShowPresentationContextMenu?.() ?? true,
		next: () => deps.next(),
		prev: () => deps.prev(),
		exitPresentation: () => deps.exitPresentation(),
		showAllSlides: () => deps.showPresentationAllSlides?.(),
		togglePresenterView: () => deps.togglePresenterView?.(),
		setPointerTool: (tool) => deps.setPresentationPointerTool?.(tool),
		eraseAnnotations: () => deps.erasePresentationAnnotations?.(),
		toggleBlank: (value) => deps.togglePresentationBlank?.(value),
	});

	const detachPresentationClick = (): void => {
		chrome.root.removeEventListener('click', onPresentationClick);
		chrome.root.removeEventListener('click', onHyperlinkClick);
		autoAdvance.detach();
		detachShowVisibility();
		detachEndScreen();
		detachLastViewedTracker();
		customShowRunner.dispose();
		endScreen.remove();
		presentationContextMenu.destroy();
	};
	// The callback needs the controller it is being passed to, so it reads it
	// back through this box rather than closing over an uninitialised binding:
	// a fullscreen exit caused by the audience popup is answered by re-entering
	// the show, not by ending it.
	const presentationRef: { current: PresentationController | undefined } = { current: undefined };
	const presentation = createPresentationController(chrome.root, (presenting) => {
		if (!presenting && store.get().presenting) {
			if (deps.classifyPresentationExit?.() === 'restore-show') {
				// Keep `presenting` true and take fullscreen back. Re-entering is
				// still inside the click's transient activation, and if the request
				// is refused the controller falls back to its CSS-only show, so the
				// presenter never lands back in the editor either way.
				void presentationRef.current?.enter();
				return;
			}
		}
		store.set({ presenting });
	});
	presentationRef.current = presentation;

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
	/** Set an ABSOLUTE stage scale (the pinch gesture's units). */
	setZoom(zoom: number): void;
	zoomIn(): void;
	zoomOut(): void;
	zoomToFit(): void;
	undo(): void;
	redo(): void;
	/** Live File > Options > Quick Access Toolbar group driving the strip. */
	getQuickAccessOptions(): ViewerQuickAccessOptions;
	/** ScreenTip-styled tooltip for a strip button (undefined suppresses it). */
	quickAccessScreenTip(label: string): string | undefined;
	/** Trust Center > Protected View's "Enable Editing" banner button. */
	enableEditingFromProtectedView(): void;
	/** The read-only recommendation banner's "Edit anyway" button. */
	editAnywayFromReadOnlyRecommendation(): void;
	/** The read-only recommendation banner's plain close button. */
	dismissReadOnlyBanner(): void;
	/** One compatibility toast's own dismiss button. */
	dismissCompatToast(id: string): void;
	/** The compatibility toast stack's "Dismiss all" button. */
	dismissAllCompatToasts(): void;
	/** Trust Center > "Confirm before opening external hyperlinks" gate + prompt. */
	confirmExternalHyperlink(url: string): boolean;
	toggleAutosave(): boolean;
	/** The AutoSave switch's state (the user preference within the host ceiling). */
	isAutosaveSwitchOn(): boolean;
	/** Whether the host permits that switch to change anything. */
	isAutosaveToggleAvailable(): boolean;
	downloadPptx(): Promise<void>;
	downloadAs(format: PptxSaveFormat): Promise<void>;
	toggleNotes(): void;
	goToSlide(index: number): void;
	/** Home: the show's first slide (skips a hidden slide 1 while presenting). */
	goToFirstSlide(): void;
	/** End: the show's last slide (skips trailing hidden slides while presenting). */
	goToLastSlide(): void;
	/**
	 * The deck index "Present From Beginning" should land on (skips a hidden
	 * slide 1 and honours the authored `p:showPr/p:sldRg` range / custom show),
	 * unconditionally unlike {@link goToFirstSlide}.
	 */
	firstShowSlideIndex(): number;
	getSlideCount(): number;
	enterPresentation(): Promise<void>;
	openPresenterView(): void;
	/** Open the presenter console when closed, close it when open. */
	togglePresenterView(): void;
	/** Raise the console's "See All Slides" navigator (Ctrl+S during a show). */
	showPresentationAllSlides(): void;
	/**
	 * File > Options > Advanced > "Show menu on right mouse click", read fresh
	 * on every right-click during a show.
	 */
	shouldShowPresentationContextMenu(): boolean;
	/** See {@link MountChromeDeps.classifyPresentationExit}. */
	classifyPresentationExit(): 'end-show' | 'restore-show';
	exitPresentation(): Promise<void>;
	getPresenterSnapshot(): PresentationSnapshot;
	updatePresenterSnapshot(patch: Partial<PresentationSnapshot>): void;
	/** Discard the show's ink strokes (E, and the show toolbar's Clear button). */
	clearPresentationAnnotations(): void;
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
	/**
	 * File > Options > Advanced > "Properties follow chart data point for
	 * current workbook", read fresh on every chart category removal.
	 */
	getChartFollowDataPoint(): boolean;
	/**
	 * File > Options > Advanced > "Quickly access this number of Recent
	 * Documents" (0-50), read fresh whenever the Recent list loads.
	 */
	getRecentPresentationsCount(): number;
	toggleTemplateEditing(): void;
	toggleMasterNavigation(): void;
	selectElements(ids: string[]): void;
	exportSlidePng(): Promise<void>;
	copySlideAsImage(): Promise<void>;
	exportPdf(): Promise<void>;
	exportGif(): Promise<void>;
	exportVideo(): Promise<void>;
	exportJson(): void;
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
		setZoom: (zoom: number) => host.setZoom(zoom),
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
		isAutosaveSwitchOn: () => host.isAutosaveSwitchOn(),
		isAutosaveToggleAvailable: () => host.isAutosaveToggleAvailable(),
		startPresentationFromBeginning: () => {
			host.goToSlide(host.firstShowSlideIndex());
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
		getChartFollowDataPoint: () => host.getChartFollowDataPoint(),
		getRecentPresentationsCount: () => host.getRecentPresentationsCount(),
		toggleTemplateEditing: () => host.toggleTemplateEditing(),
		toggleMasterNavigation: () => host.toggleMasterNavigation(),
		toggleInspector: () => host.store.set({ inspectorOpen: !host.store.get().inspectorOpen }),
		selectElement: (id) => host.selectElements([id]),
		clearSelection: () => host.selectElements([]),
		// Plain store reads: the ribbon builds (and first reads) before the editor
		// controller exists, so these cannot go through `getEditActions`.
		readTransitionDraft: () => {
			const state = host.store.get();
			return readRibbonTransitionDraft(state.slides[state.currentSlide]);
		},
		readTransition: () => {
			const state = host.store.get();
			return state.slides[state.currentSlide]?.transition;
		},
		presentationProperties: () => host.store.get().presentationProperties,
		save: () => void host.downloadPptx(),
		downloadAs: (format) => host.downloadAs(format),
		toggleNotes: () => host.toggleNotes(),
		goToSlide: (index) => host.goToSlide(index),
		goToFirstSlide: () => host.goToFirstSlide(),
		goToLastSlide: () => host.goToLastSlide(),
		firstShowSlideIndex: () => host.firstShowSlideIndex(),
		exitPresentation: () => void host.exitPresentation(),
		setPresentationPointerTool: (tool) => {
			const pointer: PresentationPointerState = host.getPresenterSnapshot().pointer ?? {
				x: 0.5,
				y: 0.5,
				color: '#ef4444',
				tool: 'none',
			};
			// PowerPoint's tool buttons are radio-like but re-clicking the active
			// one puts the pointer back to the arrow, which is the only way to stop
			// drawing without reaching for the keyboard. Matches React, whose
			// `setPresentationTool` toggles at the same (shared) level.
			host.updatePresenterSnapshot({
				pointer: { ...pointer, tool: pointer.tool === tool ? 'none' : tool },
			});
		},
		setPresentationPointerColor: (color) => {
			const pointer = host.getPresenterSnapshot().pointer ?? { x: 0.5, y: 0.5, tool: 'none' };
			host.updatePresenterSnapshot({ pointer: { ...pointer, color } });
		},
		togglePresenterView: () => host.togglePresenterView(),
		showPresentationAllSlides: () => host.showPresentationAllSlides(),
		shouldShowPresentationContextMenu: () => host.shouldShowPresentationContextMenu(),
		classifyPresentationExit: () => host.classifyPresentationExit(),
		erasePresentationAnnotations: () => host.clearPresentationAnnotations(),
		togglePresentationInkMarkup: () =>
			host.updatePresenterSnapshot({
				inkMarkupVisible: host.getPresenterSnapshot().inkMarkupVisible === false,
			}),
		togglePresentationBlank: (value) =>
			host.updatePresenterSnapshot({
				blackout: host.getPresenterSnapshot().blackout === value ? 'none' : value,
			}),
		togglePresentationBlackboard: () => {
			const snapshot = host.getPresenterSnapshot();
			const pointer: PresentationPointerState = snapshot.pointer ?? {
				x: 0.5,
				y: 0.5,
				color: '#ef4444',
				tool: 'none',
			};
			// The shared rule decides both halves atomically: black screen + pen on,
			// or both off. Applied through the same snapshot path the pen button
			// uses, so the toolbar, keyboard and presenter console stay in sync.
			const next = toggleBlackboard(snapshot.blackout, pointer.tool);
			host.updatePresenterSnapshot({
				blackout: next.blackout,
				pointer: { ...pointer, tool: next.tool },
			});
		},
		commitNotes: (notes, notesSegments) => host.editor.commitNotes(notes, notesSegments),
		exportSlidePng: () => host.exportSlidePng(),
		copySlideAsImage: () => host.copySlideAsImage(),
		exportPdf: () => host.exportPdf(),
		exportGif: () => host.exportGif(),
		exportVideo: () => host.exportVideo(),
		exportJson: () => host.exportJson(),
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
		enableEditingFromProtectedView: () => host.enableEditingFromProtectedView(),
		editAnywayFromReadOnlyRecommendation: () => host.editAnywayFromReadOnlyRecommendation(),
		dismissReadOnlyBanner: () => host.dismissReadOnlyBanner(),
		dismissCompatToast: (id) => host.dismissCompatToast(id),
		dismissAllCompatToasts: () => host.dismissAllCompatToasts(),
		confirmExternalHyperlink: (url) => host.confirmExternalHyperlink(url),
	};
}
