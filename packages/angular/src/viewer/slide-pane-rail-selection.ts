/**
 * slide-pane-rail-selection.ts: Ctrl/Shift multi-select and right-click menu
 * position/target state for the slides pane rail (`SlidesPanelComponent`).
 *
 * A plain class (no DI, no component) so the state and its resolution are
 * unit-testable directly: this package has no TestBed (see `vitest.config.ts`),
 * and Angular `signal()`s work outside an injection context, so there is no
 * reason for this to live inside the component. Kept apart from
 * `slides-panel.component.ts` so that file stays template plus thin wiring.
 *
 * @module angular-viewer/slide-pane-rail-selection
 */
import { signal } from '@angular/core';

import { resolveSlidePaneClick } from '../internal/shared';

/** Position and target of an open thumbnail context menu. */
export interface SlidePaneContextMenuState {
	x: number;
	y: number;
	index: number;
	/** Every selected slide index, right-clicked one included, for bulk commands. */
	selectedIndexes: number[];
}

export class SlidePaneRailSelection {
	readonly selectedIds = signal<string[]>([]);
	readonly contextMenu = signal<SlidePaneContextMenuState | null>(null);
	#anchorId: string | null = null;

	isSelected(slideId: string): boolean {
		return this.selectedIds().includes(slideId);
	}

	/** Resolve one click on a slide thumbnail into the next multi-selection. */
	onClick(
		event: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean },
		slideId: string,
		orderedIds: readonly string[],
	): void {
		const result = resolveSlidePaneClick({
			clickedId: slideId,
			orderedIds,
			selectedIds: this.selectedIds(),
			anchorId: this.#anchorId,
			ctrlKey: event.ctrlKey,
			metaKey: event.metaKey,
			shiftKey: event.shiftKey,
		});
		this.selectedIds.set(result.selectedIds);
		this.#anchorId = result.anchorId;
	}

	/**
	 * Open the context menu for a right-click on `index`. A slide already part
	 * of the selection acts with the whole selection; a slide right-clicked
	 * outside it acts on just that one, matching the per-element context menu.
	 */
	openContextMenu(x: number, y: number, index: number, orderedIds: readonly string[]): void {
		const slideId = orderedIds[index];
		if (slideId === undefined) {
			return;
		}
		const ids =
			this.selectedIds().length > 0 && this.selectedIds().includes(slideId)
				? this.selectedIds()
				: [slideId];
		const selectedIndexes = ids.map((id) => orderedIds.indexOf(id)).filter((i) => i !== -1);
		this.contextMenu.set({ x, y, index, selectedIndexes });
	}

	closeContextMenu(): void {
		this.contextMenu.set(null);
	}
}
