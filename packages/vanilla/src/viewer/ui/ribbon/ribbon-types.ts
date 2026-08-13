import type {
	PptxElementAnimation,
	PptxLayoutPreview,
	PptxPresentationProperties,
} from 'pptx-viewer-core';
import type { RibbonTransitionDraft, ViewerTheme } from 'pptx-viewer-shared';

import type { EditActions } from '../../editor/editor-edit-ops';
import type { FindReplaceActions } from '../../editor/editor-find-replace-actions';
import type { DrawTool } from '../../state';

/** Ribbon tab identifiers this wave implements (see `ribbon-tabs.ts` for the full future roster). */
export type RibbonTabId =
	| 'file'
	| 'home'
	| 'insert'
	| 'draw'
	| 'design'
	| 'transitions'
	| 'animations'
	| 'slideShow'
	| 'record'
	| 'review'
	| 'view'
	| 'help';

/** Nav-row handlers: always-visible (both edit and read-only chrome). */
export interface RibbonNavHandlers {
	prev(): void;
	next(): void;
	zoomIn(): void;
	zoomOut(): void;
	zoomToFit(): void;
	togglePresentation(): void;
	/** Return to the normal editing view: exit presentation + close the slide sorter. */
	normalView(): void;
	toggleNotes(): void;
	openAccessibility(): void;
	openSettings(tab?: 'general' | 'shortcuts'): void;
	openHeaderFooter(): void;
	openCompare(): void;
	openSelectionPane(): void;
	openSlideSorter(): void;
	/** Open PowerPoint's Reading View (windowed deck, not the slide show). */
	openReadingView(): void;
	/** Open PowerPoint's Outline view (the deck as editable indented text). */
	openOutlineView(): void;
	openComments(): void;
	openHyperlink(): void;
	toggleTemplateEditing?(): void;
	toggleMasterView?(): void;
	/** Show/hide the right-hand property inspector (React's panel toggle). */
	toggleInspector?(): void;
	/**
	 * Drop the current selection. Design > Slide Size needs it: the slide-size
	 * fields live on the inspector's DECK panel, which only renders when nothing
	 * is selected.
	 */
	clearSelection?(): void;
	toggleViewOption(
		option: 'showGrid' | 'showRulers' | 'showGuides' | 'snapToGrid' | 'snapToShape',
	): void;
	addGuide(axis: 'h' | 'v'): void;
	activateEyedropper(): void;
	toggleSpellCheck(): void;
}

/** Primary-row handlers: quick-access undo/redo/save (editing only). */
export interface RibbonPrimaryHandlers {
	undo(): void;
	redo(): void;
	save(): void;
}

/** File tab handlers: save + export actions already implemented by the viewer's export lifecycle. */
export interface RibbonFileHandlers {
	openFile(): void;
	openRecentFile(key: string): void;
	createPresentation(templateId: string): void;
	openSettings(): void;
	openShare(): void;
	openDocumentProperties(): void;
	openFontEmbedding(): void;
	openDigitalSignatures(): void;
	openPasswordProtection(): void;
	openVersionHistory(): void;
	save(): void;
	saveAsPpsx(): void;
	saveAsPptm(): void;
	packageForSharing(): void;
	exportPng(): void;
	copySlideAsImage(): void;
	exportPdf(): void;
	exportGif(): void;
	exportVideo(): void;
	exportJson(): void;
	print(): void;
}

/** Slide Show actions already supported by the viewer and collaboration UI. */
export interface RibbonSlideShowHandlers {
	startFromBeginning(): void;
	startFromCurrent(): void;
	openPresenterView(): void;
	openBroadcast(): void;
	openSetUp(): void;
	/**
	 * PowerPoint's Hide Slide: toggle the ACTIVE slide's `hidden` flag, which
	 * makes the show skip it while it stays in the deck, the thumbnail rail and
	 * the sorter.
	 */
	toggleHideSlide(): void;
	startRehearsal(): void;
	openCustomShows(): void;
	toggleSubtitles(): void;
	openSubtitleSettings(): void;
	/**
	 * The deck's show settings, for the Options cluster's checkbox state (shared
	 * `readSlideShowOption` turns them into ticks).
	 */
	showOptions(): PptxPresentationProperties;
	/**
	 * Commit an Options-cluster change onto the deck's show settings. Routes to
	 * the same history-integrated `updatePresentationProperties` path the Set Up
	 * Show dialog uses, so unticking Use Timings really does stop the show
	 * auto-advancing.
	 */
	updateShowOptions(patch: Partial<PptxPresentationProperties>): void;
}

/**
 * Transitions tab handlers, expressed in the shared `ribbon-transitions`
 * vocabulary: what the controls should show for the active slide, and what a
 * change to any of them commits.
 *
 * The read is deliberately NOT an `EditActions` method: the ribbon is built
 * before the editor controller exists (see `createLazyActions`), and the tab
 * reads its initial state while it is being constructed. Reading the store
 * directly is the only thing available that early.
 */
export interface RibbonTransitionHandlers {
	/** The draft the tab's controls should show for the ACTIVE slide. */
	readDraft(): RibbonTransitionDraft;
	/** Commit the tab's whole draft, onto the active slide or every slide. */
	applyDraft(draft: RibbonTransitionDraft, applyToAll: boolean): void;
}

/**
 * Design tab handler: swap the viewer chrome's `ViewerTheme` (the shared
 * light/dark "vermilion" presets, see `theme/presets.ts`), the same mechanism
 * `PptxViewer.setTheme` already exposes on the public API. This is UI-chrome
 * styling, not presentation content, so unlike `EditActions` it isn't
 * history-integrated (same class as the always-available zoom/present nav
 * actions).
 */
export interface RibbonDesignHandlers {
	setTheme(theme: ViewerTheme | undefined): void;
	applyPresentationTheme(presetId: string): void;
}

/**
 * Draw tab handlers: switch the active ink tool and the pen/highlighter
 * stroke colour/width. Plain UI state (like the Design tab's theme swap),
 * not history-integrated; the ink stroke itself only enters history once a
 * gesture commits an `InkPptxElement` (see `EditActions.commitStroke`, from
 * `editor-ink-actions.ts`, wired to the stage in `editor-draw-gestures.ts`).
 */
export interface RibbonDrawHandlers {
	setTool(tool: DrawTool): void;
	setColor(color: string): void;
	setWidth(width: number): void;
}

/** Draw tab state to reflect (current tool/colour/width). */
export interface RibbonDrawState {
	tool: DrawTool;
	color: string;
	width: number;
}

/** Insert tab handler: build + insert an element of the given kind/shape preset. */
export interface RibbonInsertHandlers {
	insert: EditActions['insert'];
	insertImage: EditActions['insertImage'];
	insertMedia: EditActions['insertMedia'];
	insertChart: EditActions['insertChart'];
	insertSmartArt: EditActions['insertSmartArt'];
	insertEquation: EditActions['insertEquation'];
	insertActionButton: EditActions['insertActionButton'];
	insertField: EditActions['insertField'];
}

/** Every handler the ribbon dispatches, grouped by concern. */
export interface RibbonHandlers {
	nav: RibbonNavHandlers;
	primary: RibbonPrimaryHandlers;
	file: RibbonFileHandlers;
	slideShow: RibbonSlideShowHandlers;
	insert: RibbonInsertHandlers;
	/** Home tab (clipboard/slides/font/paragraph/arrange/editing) + shape actions. */
	edit: EditActions;
	findReplace: FindReplaceActions;
	/** Design tab's viewer-chrome theme swap (Format Background routes through `edit`). */
	design: RibbonDesignHandlers;
	/** Transitions tab's draft read/commit pair. */
	transitions: RibbonTransitionHandlers;
	/** Draw tab's tool/colour/width switches (the stroke commit itself routes through `edit`). */
	draw: RibbonDrawHandlers;
}

/** Nav-row state (prev/next/counter/zoom label). */
export interface RibbonNavState {
	current: number;
	total: number;
	zoomPercent: number;
}

/** Primary-row + tab-bar visibility state. */
export interface RibbonEditState {
	editable: boolean;
	canUndo: boolean;
	canRedo: boolean;
}

/** A slide layout the Home > Slides group offers for New Slide / Layout. */
export interface LayoutOption {
	/** Archive path of the layout part (e.g. `ppt/slideLayouts/slideLayout2.xml`). */
	path: string;
	/** Human-readable layout name shown in the dropdown. */
	name: string;
}

/** Selection-derived state the Home tab's Font/Paragraph/Arrange groups reflect. */
export interface RibbonSelectionState {
	hasClipboard: boolean;
	slideCount: number;
	selectedCount?: number;
	formatPainterActive?: boolean;
	selectedElementId?: string;
	animations?: readonly PptxElementAnimation[];
	/** Available slide layouts for the Slides group's New Slide / Layout menus. */
	layouts?: readonly LayoutOption[];
	/** Artwork for the layout gallery thumbnails, keyed by layout path. */
	layoutPreviews?: ReadonlyMap<string, PptxLayoutPreview>;
	/** `layoutPath` of the active slide, marking the current gallery tile. */
	currentLayoutPath?: string;
	/** Theme major/minor latin faces, leading the font dropdown. */
	themeFonts?: { heading?: string; body?: string };
	/** Families the deck embeds, offered as their own dropdown group. */
	embeddedFontFamilies?: readonly string[];
	/** Families registered this session via File > Options > Fonts. */
	customFontFamilies?: readonly string[];
}
