import type { ViewerTheme } from 'pptx-viewer-shared';

import type { EditActions } from '../../editor/editor-edit-ops';
import type { FindReplaceActions } from '../../editor/editor-find-replace-actions';

/** Ribbon tab identifiers this wave implements (see `ribbon-tabs.ts` for the full future roster). */
export type RibbonTabId =
	| 'file'
	| 'home'
	| 'insert'
	| 'design'
	| 'transitions'
	| 'animations'
	| 'view';

/** Nav-row handlers: always-visible (both edit and read-only chrome). */
export interface RibbonNavHandlers {
	prev(): void;
	next(): void;
	zoomIn(): void;
	zoomOut(): void;
	zoomToFit(): void;
	togglePresentation(): void;
	toggleNotes(): void;
}

/** Primary-row handlers: quick-access undo/redo/save (editing only). */
export interface RibbonPrimaryHandlers {
	undo(): void;
	redo(): void;
	save(): void;
}

/** File tab handlers: save + export actions already implemented by the viewer's export lifecycle. */
export interface RibbonFileHandlers {
	save(): void;
	exportPng(): void;
	exportPdf(): void;
	exportGif(): void;
	exportVideo(): void;
	print(): void;
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
	insert: RibbonInsertHandlers;
	/** Home tab (clipboard/slides/font/paragraph/arrange/editing) + shape actions. */
	edit: EditActions;
	findReplace: FindReplaceActions;
	/** Design tab's viewer-chrome theme swap (Format Background routes through `edit`). */
	design: RibbonDesignHandlers;
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

/** Selection-derived state the Home tab's Font/Paragraph/Arrange groups reflect. */
export interface RibbonSelectionState {
	hasClipboard: boolean;
	slideCount: number;
}
