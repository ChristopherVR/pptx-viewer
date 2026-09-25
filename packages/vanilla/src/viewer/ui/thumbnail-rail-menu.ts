/**
 * thumbnail-rail-menu.ts: Ctrl/Shift multi-select and right-click menu
 * position/target state for the slides pane rail (`createThumbnailRail`).
 *
 * A plain factory (no DOM, no rendering) so the state and its resolution are
 * unit-testable directly. Kept apart from `thumbnails.ts` so that file stays
 * DOM assembly, not selection logic.
 *
 * @module ui/thumbnail-rail-menu
 */
import { resolveSlidePaneClick } from 'pptx-viewer-shared';

/** Position and target of an open thumbnail context menu. */
export interface ThumbnailContextMenuState {
	x: number;
	y: number;
	index: number;
	/** Every selected slide index, right-clicked one included, for bulk commands. */
	selectedIndexes: number[];
}

export interface ThumbnailRailMenu {
	isSelected(slideId: string): boolean;
	onClick(
		event: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean },
		slideId: string,
		orderedIds: readonly string[],
	): void;
	/**
	 * Resolve a right-click on `index` into the menu's target: a slide already
	 * part of the selection acts with the whole selection; a slide right-
	 * clicked outside it acts on just that one.
	 */
	openContextMenu(
		x: number,
		y: number,
		index: number,
		orderedIds: readonly string[],
	): ThumbnailContextMenuState | null;
}

export function createThumbnailRailMenu(): ThumbnailRailMenu {
	let selectedIds: string[] = [];
	let anchorId: string | null = null;

	return {
		isSelected(slideId) {
			return selectedIds.includes(slideId);
		},
		onClick(event, slideId, orderedIds) {
			const result = resolveSlidePaneClick({
				clickedId: slideId,
				orderedIds,
				selectedIds,
				anchorId,
				ctrlKey: event.ctrlKey,
				metaKey: event.metaKey,
				shiftKey: event.shiftKey,
			});
			selectedIds = result.selectedIds;
			anchorId = result.anchorId;
		},
		openContextMenu(x, y, index, orderedIds) {
			const slideId = orderedIds[index];
			if (slideId === undefined) {
				return null;
			}
			const ids = selectedIds.length > 0 && selectedIds.includes(slideId) ? selectedIds : [slideId];
			const selectedIndexes = ids.map((id) => orderedIds.indexOf(id)).filter((i) => i !== -1);
			return { x, y, index, selectedIndexes };
		},
	};
}
