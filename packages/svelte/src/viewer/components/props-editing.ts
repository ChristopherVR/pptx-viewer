import type { PptxElement } from 'pptx-viewer-core';
import type { ResizeHandleId, SnapLine } from 'pptx-viewer-shared';

import type { ContextMenuCellTarget } from '../editor/context-menu-dispatch';
import type { EditorController } from '../editor/editor-controller.svelte';
import type { EditorMarqueeRect } from '../editor/editor-selection-gestures';
import type { EditorState } from '../editor/editor-state.svelte';
import type { OverlayBox } from '../editor/types';

/**
 * Prop contracts for the on-canvas editing layer: the selection overlay, the
 * inline text editor, and the right-click context menu. Split out of
 * `props.ts` for the repo's file-size budget; import them from `./props`,
 * which re-exports this module.
 */

/** Props for the selection overlay (box + 8 resize handles + rotate handle). */
export interface SelectionOverlayProps {
	/** Selection box in element (unscaled slide) px, or null to hide it. */
	box: OverlayBox | null;
	/** Stage scale (screen px per element px) applied when positioning. */
	scale: number;
	/** Transient snap-alignment lines (element px). */
	snapLines: readonly SnapLine[];
	/** Hide the box/handles while the inline text editor is open. */
	editing?: boolean;
	/** Number of selected elements; collective boxes do not expose rotation. */
	selectionCount?: number;
	/** In-progress empty-canvas marquee rectangle. */
	marquee?: EditorMarqueeRect | null;
	onhandlepointerdown: (handle: ResizeHandleId, event: PointerEvent) => void;
	onrotatepointerdown: (event: PointerEvent) => void;
}

/** Props for the inline (double-click) text editing surface. */
export interface InlineTextEditorProps {
	/** The element being edited (seeds the initial text + font hints). */
	element: PptxElement;
	/** The element's box in element px (positioning). */
	box: OverlayBox;
	/** Stage scale (screen px per element px). */
	scale: number;
	spellCheck?: boolean;
	/** Called with the edited plain text on every keystroke (live preview only). */
	oninput?: (text: string) => void;
	/** Called with the edited plain text on commit (only when it changed). */
	oncommit: (text: string) => void;
	/** Called after the surface closes (commit or cancel). */
	onclose: () => void;
}

/** Props for the editing layer (selection overlay + inline editor over the stage). */
export interface EditorLayerProps {
	/** The reactive editing orchestrator (owns overlay/snap/inline state). */
	controller: EditorController;
	/** Stage scale (screen px per element px). */
	scale: number;
	spellCheck?: boolean;
}

/**
 * Where the canvas context menu opened, and on which table cell.
 *
 * Owned by the viewer shell and handed straight to `ElementContextMenu`; the
 * cell is what turns the shared menu's table block on and gives it a target.
 */
export interface StageContextMenu {
	x: number;
	y: number;
	cell: ContextMenuCellTarget | null;
}

/** Position and callbacks for the editable element context menu. */
export interface ElementContextMenuProps {
	x: number;
	y: number;
	editor: EditorState;
	/**
	 * The table cell the right-click landed on, which is what gates (and
	 * targets) the row / column / merge commands. Null for every other click.
	 */
	cell?: ContextMenuCellTarget | null;
	/** "Ask AI about this" action (shown only when the host enables the `ai` prop). */
	onaskai?: () => void;
	/** "Fix with AI" action (shown only when the host enables the `ai` prop). */
	onfixai?: () => void;
	/** "Add Comment": opens the inspector's Comments tab (mirrors React). */
	oncomment?: () => void;
	/** "Edit Hyperlink": opens the hyperlink dialog for the selected element. */
	onhyperlink?: () => void;
	onclose: () => void;
}
