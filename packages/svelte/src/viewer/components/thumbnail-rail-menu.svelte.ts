/**
 * thumbnail-rail-menu.svelte.ts: Ctrl/Shift multi-select and the thumbnail
 * right-click menu for `ThumbnailRail.svelte`.
 *
 * Split out of the SFC (already past the repo's 300-line guideline) so the
 * component stays template plus thin wiring. The click resolution and the
 * menu's command list are both shared (`resolveSlidePaneClick` /
 * `buildSlidePaneContextMenuEntries`); this module is only the Svelte-side
 * reactive state around them.
 */
import type { PptxSlide } from 'pptx-viewer-core';
import type { SlidePaneContextMenuCommandId } from 'pptx-viewer-shared';
import { buildSlidePaneContextMenuEntries, resolveSlidePaneClick } from 'pptx-viewer-shared';

/** Position and target of an open thumbnail context menu. */
export interface ThumbnailContextMenuState {
	x: number;
	y: number;
	index: number;
	selectedIndexes: number[];
}

export interface ThumbnailRailMenuActions {
	addSlideAfter?: (index: number) => void;
	duplicateSlides?: (indexes: number[]) => void;
	deleteSlides?: (indexes: number[]) => void;
	openLayoutForSlide?: (index: number, x: number, y: number) => void;
	toggleHideSlides?: (indexes: number[]) => void;
	addSectionAt?: (index: number) => void;
}

export class ThumbnailRailMenu {
	selectedIds = $state<string[]>([]);
	contextMenu = $state<ThumbnailContextMenuState | null>(null);
	#anchorId: string | null = null;

	isSelected(slideId: string): boolean {
		return this.selectedIds.includes(slideId);
	}

	onClick(
		event: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean },
		slideId: string,
		orderedIds: readonly string[],
	): void {
		const result = resolveSlidePaneClick({
			clickedId: slideId,
			orderedIds,
			selectedIds: this.selectedIds,
			anchorId: this.#anchorId,
			ctrlKey: event.ctrlKey,
			metaKey: event.metaKey,
			shiftKey: event.shiftKey,
		});
		this.selectedIds = result.selectedIds;
		this.#anchorId = result.anchorId;
	}

	/**
	 * Open the context menu for a right-click on `index`. A slide already part
	 * of the selection acts with the whole selection; a slide right-clicked
	 * outside it acts on just that one.
	 */
	openContextMenu(x: number, y: number, index: number, orderedIds: readonly string[]): void {
		const slideId = orderedIds[index];
		if (slideId === undefined) {
			return;
		}
		const ids =
			this.selectedIds.length > 0 && this.selectedIds.includes(slideId)
				? this.selectedIds
				: [slideId];
		const selectedIndexes = ids.map((id) => orderedIds.indexOf(id)).filter((i) => i !== -1);
		this.contextMenu = { x, y, index, selectedIndexes };
	}

	closeContextMenu(): void {
		this.contextMenu = null;
	}

	menuEntries(slides: readonly PptxSlide[]) {
		const menu = this.contextMenu;
		const selected = (menu?.selectedIndexes ?? [])
			.map((i) => slides[i])
			.filter((s): s is PptxSlide => Boolean(s));
		return buildSlidePaneContextMenuEntries({
			selectedCount: selected.length,
			hasHiddenInSelection: selected.some((s) => s.hidden),
			hasVisibleInSelection: selected.some((s) => !s.hidden),
			wouldDeleteAllSlides: selected.length >= slides.length,
		});
	}

	/** Run a chosen command id against `actions`, then close the menu. */
	run(id: SlidePaneContextMenuCommandId, actions: ThumbnailRailMenuActions): void {
		const menu = this.contextMenu;
		this.closeContextMenu();
		if (!menu) {
			return;
		}
		switch (id) {
			case 'new-slide':
				actions.addSlideAfter?.(menu.index);
				break;
			case 'duplicate':
				actions.duplicateSlides?.(menu.selectedIndexes);
				break;
			case 'delete':
				actions.deleteSlides?.(menu.selectedIndexes);
				break;
			case 'layout':
				actions.openLayoutForSlide?.(menu.index, menu.x, menu.y);
				break;
			case 'hide':
				actions.toggleHideSlides?.(menu.selectedIndexes);
				break;
			case 'add-section':
				actions.addSectionAt?.(menu.index);
				break;
			default:
				break;
		}
	}
}
