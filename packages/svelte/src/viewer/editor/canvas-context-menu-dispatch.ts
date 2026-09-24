import type { CanvasContextMenuCommandId, CanvasContextMenuContext } from 'pptx-viewer-shared';
import { buildCanvasContextMenuEntries } from 'pptx-viewer-shared';

import type { EditorState } from './editor-state.svelte';

/**
 * What the empty-canvas context menu offers, and what each command does.
 *
 * Sibling of `context-menu-dispatch.ts` (the per-element menu): the item list
 * comes from `pptx-viewer-shared`'s `canvas-context-menu-commands`, this
 * module only supplies the context and routes the chosen id.
 *
 * @module editor/canvas-context-menu-dispatch
 */

/** Everything the menu needs to decide its items and to run one. */
export interface CanvasContextMenuDispatchDeps {
	editor: EditorState;
	showGrid: boolean;
	showRulers: boolean;
	onOpenLayoutGallery: () => void;
	onResetSlide: () => void;
	/** Opens the inspector on slide/background properties (no element selected). */
	onOpenFormatBackground: () => void;
	onToggleGrid: () => void;
	onToggleRulers: () => void;
}

/** The menu for the current view state. */
export function buildCanvasMenuEntries(deps: CanvasContextMenuDispatchDeps) {
	const context: CanvasContextMenuContext = {
		hasClipboard: deps.editor.hasClipboard,
		showGrid: deps.showGrid,
		showRulers: deps.showRulers,
	};
	return buildCanvasContextMenuEntries(context);
}

/** Route a chosen command id. Closing the menu is the caller's job. */
export function runCanvasContextMenuCommand(
	id: CanvasContextMenuCommandId,
	deps: CanvasContextMenuDispatchDeps,
): void {
	switch (id) {
		case 'paste':
			deps.editor.clipboardOps.pasteClipboard();
			return;
		case 'layout':
			deps.onOpenLayoutGallery();
			return;
		case 'reset-slide':
			void deps.editor.slidesOps.resetSlide();
			return;
		case 'format-background':
			deps.onOpenFormatBackground();
			return;
		case 'grid-and-guides':
			deps.onToggleGrid();
			return;
		case 'ruler':
			deps.onToggleRulers();
			break;
		default:
			break;
	}
}
