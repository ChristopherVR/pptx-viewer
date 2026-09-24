/**
 * slide-canvas-context-menu-dispatch.ts: routing from a shared empty-canvas
 * context-menu command id to the Angular editor operation that performs it.
 *
 * Sibling of `editor-context-menu-dispatch.ts` (the per-element menu), kept
 * apart for the same reason: Angular has no TestBed in this package, so a
 * switch buried inside a component is unreachable from a unit test, while
 * this one can be driven with a recording stub.
 *
 * @module angular-viewer/slide-canvas-context-menu-dispatch
 */

import type { CanvasContextMenuCommandId } from '../internal/shared';

/** Everything the empty-canvas menu can ask the viewer to do. */
export interface CanvasContextMenuActions {
	paste(): void;
	/** Opens the existing Layout gallery (imperative open, not the ribbon's own click). */
	openLayoutGallery(): void;
	resetSlide(): void;
	/** Opens the inspector on slide/background properties (no element selected). */
	openFormatBackground(): void;
	toggleGrid(): void;
	toggleRulers(): void;
}

/**
 * Run `id` against `actions`. Unknown ids cannot occur (the id type is
 * closed), but an id added to shared and not routed here would fall through
 * silently, so the switch is exhaustive by construction.
 */
export function runCanvasContextMenuCommand(
	id: CanvasContextMenuCommandId,
	actions: CanvasContextMenuActions,
): void {
	switch (id) {
		case 'paste':
			actions.paste();
			break;
		case 'layout':
			actions.openLayoutGallery();
			break;
		case 'reset-slide':
			actions.resetSlide();
			break;
		case 'format-background':
			actions.openFormatBackground();
			break;
		case 'grid-and-guides':
			actions.toggleGrid();
			break;
		case 'ruler':
			actions.toggleRulers();
			break;
		default:
			break;
	}
}
