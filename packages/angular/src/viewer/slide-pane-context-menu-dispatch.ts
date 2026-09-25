/**
 * slide-pane-context-menu-dispatch.ts: routing from a shared thumbnail
 * context-menu command id to the Angular editor operation that performs it.
 *
 * Sibling of `slide-canvas-context-menu-dispatch.ts` (the empty-canvas menu).
 *
 * @module angular-viewer/slide-pane-context-menu-dispatch
 */
import type { SlidePaneContextMenuCommandId } from '../internal/shared';

/** Everything the thumbnail menu can ask the viewer to do. */
export interface SlidePaneContextMenuActions {
	/** Insert a new slide after the right-clicked one. */
	addSlideAfter(index: number): void;
	duplicateSlides(indexes: number[]): void;
	deleteSlides(indexes: number[]): void;
	/** Makes the right-clicked slide active, then opens the Layout gallery at (x, y). */
	openLayoutForSlide(index: number, x: number, y: number): void;
	toggleHideSlides(indexes: number[]): void;
	addSectionAt(index: number): void;
}

/**
 * Run `id` against `actions`. Unknown ids cannot occur (the id type is
 * closed), but an id added to shared and not routed here would fall through
 * silently, so the switch is exhaustive by construction.
 */
export function runSlidePaneContextMenuCommand(
	id: SlidePaneContextMenuCommandId,
	index: number,
	selectedIndexes: number[],
	position: { x: number; y: number },
	actions: SlidePaneContextMenuActions,
): void {
	switch (id) {
		case 'new-slide':
			actions.addSlideAfter(index);
			break;
		case 'duplicate':
			actions.duplicateSlides(selectedIndexes);
			break;
		case 'delete':
			actions.deleteSlides(selectedIndexes);
			break;
		case 'layout':
			actions.openLayoutForSlide(index, position.x, position.y);
			break;
		case 'hide':
			actions.toggleHideSlides(selectedIndexes);
			break;
		case 'add-section':
			actions.addSectionAt(index);
			break;
		default:
			break;
	}
}
