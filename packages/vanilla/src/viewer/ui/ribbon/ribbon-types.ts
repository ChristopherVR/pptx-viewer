import type { ViewerTheme } from 'pptx-viewer-shared';

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
	openAccessibility(): void;
	toggleTemplateEditing?(): void;
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

/** Slide Show actions already supported by the viewer and collaboration UI. */
export interface RibbonSlideShowHandlers {
	startFromBeginning(): void;
	startFromCurrent(): void;
	openBroadcast(): void;
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

/** Selection-derived state the Home tab's Font/Paragraph/Arrange groups reflect. */
export interface RibbonSelectionState {
	hasClipboard: boolean;
	slideCount: number;
	selectedCount?: number;
	formatPainterActive?: boolean;
}
