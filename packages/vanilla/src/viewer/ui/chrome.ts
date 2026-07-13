import type { TextSegment } from 'pptx-viewer-core';

import type { Translator } from '../i18n';
import { createEl } from '../render';
import type { AccessibilityPanel } from './accessibility-panel';
import { createAccessibilityPanel } from './accessibility-panel';
import type { Inspector, InspectorHandlers } from './inspector';
import { createInspector } from './inspector';
import type { MobileActionSheets } from './mobile-action-sheets';
import { createMobileActionSheets } from './mobile-action-sheets';
import type { MobileNavigation } from './mobile-navigation';
import { createMobileNavigation } from './mobile-navigation';
import type { NotesPanel } from './notes-panel';
import { createNotesPanel } from './notes-panel';
import type { PresentationTouchControls } from './presentation-touch-controls';
import { createPresentationTouchControls } from './presentation-touch-controls';
import type { Ribbon } from './ribbon/ribbon';
import { createRibbon } from './ribbon/ribbon';
import type { RibbonHandlers } from './ribbon/ribbon-types';
import type { StatusBar } from './status-bar';
import { createStatusBar } from './status-bar';
import type { ThumbnailRail } from './thumbnails';
import { createThumbnailRail } from './thumbnails';
import type { TitleBar, TitleBarDeps } from './title-bar';
import { createTitleBar } from './title-bar';

export interface ChromeOptions {
	showToolbar: boolean;
	showThumbnails: boolean;
	/** Show the ribbon's editing surface (tab bar + Home/Insert/View content); default true. */
	showFormatToolbar: boolean;
	/** Build the property inspector panel (default true; shown only when editable). */
	showInspector: boolean;
	/** Whether editing is initially enabled (gates ribbon tab content/inspector visibility). */
	editable: boolean;
	/** Every ribbon handler (nav/primary/file/insert/edit/findReplace). */
	ribbonHandlers: RibbonHandlers;
	/** Inspector actions (geometry + shape fill/stroke). */
	inspectorHandlers: InspectorHandlers;
	/** PowerPoint-style top chrome, built when the toolbar is visible. */
	titleBar: TitleBarDeps;
	onSelectSlide(index: number): void;
	/** Header click on the notes panel; shares the ribbon Notes button's handler. */
	onToggleNotes(): void;
	/** Fired when the notes textarea commits (change/blur) in editable mode. */
	onCommitNotes(notes: string, notesSegments?: TextSegment[]): void;
}

/** The viewer's static DOM skeleton plus the mutable overlay controls. */
export interface ViewerChrome {
	/** `.pptxv` root (focusable; keyboard navigation attaches here). */
	root: HTMLElement;
	/** The tabbed ribbon (primary row, nav row, tab bar + File/Home/Insert/View content); null when disabled. */
	ribbon: Ribbon | null;
	/** Top document title and quick-access row; null when the toolbar is hidden. */
	titleBar: TitleBar | null;
	/** Property inspector panel; null when disabled. */
	inspector: Inspector | null;
	/** Cross-slide accessibility checker results, opened from the View ribbon. */
	accessibility: AccessibilityPanel;
	thumbnails: ThumbnailRail | null;
	/** Scrollable centring viewport around the stage. */
	viewport: HTMLElement;
	/** Box sized to `canvasSize * scale`; the rendered stage goes inside. */
	stageWrap: HTMLElement;
	/** Collapsible speaker-notes panel docked below the slide area. */
	notes: NotesPanel;
	/** Bottom navigation and zoom bar, matching React's status-bar placement. */
	statusBar: StatusBar | null;
	/** Compact navigation dock, visible only below the mobile breakpoint. */
	mobileNavigation: MobileNavigation | null;
	mobileActionSheets: MobileActionSheets | null;
	/** Persistent exit and navigation affordances for touch slide shows. */
	presentationTouchControls: PresentationTouchControls;
	setLoading(loading: boolean): void;
	setError(message: string | null): void;
	setEmpty(empty: boolean): void;
	setPresenting(presenting: boolean): void;
}

/**
 * Build the viewer chrome: ribbon (optional), thumbnail rail (optional),
 * viewport + stage host, and the loading/error/empty overlays. Pure DOM
 * assembly; all behaviour is wired by the caller through the handlers.
 */
export function buildViewerChrome(
	doc: Document,
	t: Translator,
	options: ChromeOptions,
): ViewerChrome {
	const root = createEl(doc, 'div', 'pptxv');
	root.tabIndex = 0;
	root.setAttribute('role', 'application');

	let titleBar: TitleBar | null = null;
	let ribbon: Ribbon | null = null;
	if (options.showToolbar) {
		titleBar = createTitleBar(doc, t, options.titleBar);
		root.appendChild(titleBar.el);
		ribbon = createRibbon(doc, t, options.ribbonHandlers);
		if (!options.showFormatToolbar) {
			ribbon.setEditable(false);
		}
		root.appendChild(ribbon.el);
	}

	const body = createEl(doc, 'div', 'pptxv-body');
	root.appendChild(body);
	const accessibility = createAccessibilityPanel(doc, t, options.onSelectSlide);
	root.appendChild(accessibility.el);

	let thumbnails: ThumbnailRail | null = null;
	if (options.showThumbnails) {
		thumbnails = createThumbnailRail(doc, t, options.onSelectSlide);
		body.appendChild(thumbnails.el);
	}

	const viewport = createEl(doc, 'div', 'pptxv-viewport');
	viewport.setAttribute('data-pptx-viewport', '');
	body.appendChild(viewport);

	let inspector: Inspector | null = null;
	if (options.showInspector) {
		inspector = createInspector(doc, t, options.inspectorHandlers);
		inspector.setEditable(options.editable);
		body.appendChild(inspector.el);
	}

	const stageWrap = createEl(doc, 'div', 'pptxv-stage-wrap');
	viewport.appendChild(stageWrap);

	const emptyMessage = createEl(doc, 'div', 'pptxv-empty');
	emptyMessage.textContent = t('pptx.statusBar.noSlides');
	emptyMessage.hidden = true;
	viewport.appendChild(emptyMessage);

	// Docked below the slide area (thumbnails + viewport), spanning the full
	// chrome width, so it stays visible regardless of the thumbnail rail.
	const notes = createNotesPanel(doc, t, options.onToggleNotes, options.onCommitNotes);
	root.appendChild(notes.el);

	const statusBar = options.showToolbar
		? createStatusBar(doc, t, {
				prev: options.ribbonHandlers.nav.prev,
				next: options.ribbonHandlers.nav.next,
				toggleNotes: options.ribbonHandlers.nav.toggleNotes,
				togglePresentation: options.ribbonHandlers.nav.togglePresentation,
				zoomIn: options.ribbonHandlers.nav.zoomIn,
				zoomOut: options.ribbonHandlers.nav.zoomOut,
				zoomToFit: options.ribbonHandlers.nav.zoomToFit,
			})
		: null;
	if (statusBar) {
		root.appendChild(statusBar.el);
	}
	const mobileNavigation = options.showToolbar
		? createMobileNavigation(doc, t, {
				prev: options.ribbonHandlers.nav.prev,
				next: options.ribbonHandlers.nav.next,
				toggleNotes: options.ribbonHandlers.nav.toggleNotes,
				togglePresentation: options.ribbonHandlers.nav.togglePresentation,
				zoomIn: options.ribbonHandlers.nav.zoomIn,
				zoomOut: options.ribbonHandlers.nav.zoomOut,
			})
		: null;
	if (mobileNavigation) {
		root.appendChild(mobileNavigation.el);
	}
	const mobileActionSheets =
		options.showToolbar && options.editable
			? createMobileActionSheets(
					doc,
					t,
					options.ribbonHandlers,
					options.onSelectSlide,
					inspector?.el ?? null,
				)
			: null;
	if (mobileActionSheets) {
		root.appendChild(mobileActionSheets.el);
	}
	const presentationTouchControls = createPresentationTouchControls(doc, t, {
		previous: options.ribbonHandlers.nav.prev,
		next: options.ribbonHandlers.nav.next,
		exit: options.ribbonHandlers.nav.togglePresentation,
	});
	presentationTouchControls.update(0, 0);
	root.appendChild(presentationTouchControls.el);

	const loadingOverlay = createEl(doc, 'div', 'pptxv-overlay pptxv-loading');
	loadingOverlay.textContent = t('common.loading');
	loadingOverlay.hidden = true;
	root.appendChild(loadingOverlay);

	const errorOverlay = createEl(doc, 'div', 'pptxv-overlay pptxv-error');
	errorOverlay.setAttribute('role', 'alert');
	const errorMessage = createEl(doc, 'div', 'pptxv-error-message');
	errorOverlay.appendChild(errorMessage);
	errorOverlay.hidden = true;
	root.appendChild(errorOverlay);

	return {
		root,
		ribbon,
		titleBar,
		inspector,
		accessibility,
		thumbnails,
		viewport,
		stageWrap,
		notes,
		statusBar,
		mobileNavigation,
		mobileActionSheets,
		presentationTouchControls,
		setLoading(loading) {
			loadingOverlay.hidden = !loading;
		},
		setError(message) {
			errorOverlay.hidden = message === null;
			errorMessage.textContent = message ?? '';
		},
		setEmpty(empty) {
			emptyMessage.hidden = !empty;
			stageWrap.hidden = empty;
		},
		setPresenting(presenting) {
			root.classList.toggle('pptxv-presenting', presenting);
		},
	};
}
