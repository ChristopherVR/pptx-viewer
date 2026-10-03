import { slideSorterPasteIndexes } from './slide-sorter-context-menu';
import type { SlideSorterContextMenuContext } from './slide-sorter-context-menu';
import { clampSorterZoom, SORTER_ZOOM_STEP } from './slide-sorter-keymap';
import type { SlideSorterKeyActionName } from './slide-sorter-keymap';

export interface SorterSlide {
	id: string;
	hidden?: boolean;
}
export interface SlideSorterState {
	selectedIds: string[];
	anchor: number;
	clipboardIds: string[];
	zoom: number;
}
export function createSlideSorterState(
	slides: readonly SorterSlide[],
	active: number,
): SlideSorterState {
	return {
		selectedIds: slides[active] ? [slides[active].id] : [],
		anchor: active,
		clipboardIds: [],
		zoom: 100,
	};
}
export function selectSorterSlide(
	state: SlideSorterState,
	slides: readonly SorterSlide[],
	index: number,
	modifiers: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean } = {},
	context = false,
): SlideSorterState {
	const slide = slides[index];
	if (!slide || (context && state.selectedIds.includes(slide.id))) {
		return state;
	}
	if (!context && (modifiers.ctrlKey || modifiers.metaKey)) {
		return {
			...state,
			anchor: index,
			selectedIds: state.selectedIds.includes(slide.id)
				? state.selectedIds.filter((id) => id !== slide.id)
				: [...state.selectedIds, slide.id],
		};
	}
	if (!context && modifiers.shiftKey) {
		return {
			...state,
			selectedIds: slides
				.slice(Math.min(state.anchor, index), Math.max(state.anchor, index) + 1)
				.map((s) => s.id),
		};
	}
	return { ...state, anchor: index, selectedIds: [slide.id] };
}
export function sorterSelectionIndexes(
	state: SlideSorterState,
	slides: readonly SorterSlide[],
): number[] {
	return slideSorterPasteIndexes(state.selectedIds, slides);
}
export function sorterMenuContext(
	state: SlideSorterState,
	slides: readonly SorterSlide[],
): SlideSorterContextMenuContext {
	const indexes = sorterSelectionIndexes(state, slides);
	return {
		selectedCount: indexes.length,
		hasClipboard: slideSorterPasteIndexes(state.clipboardIds, slides).length > 0,
		hasHiddenInSelection: indexes.some((i) => slides[i].hidden),
		hasVisibleInSelection: indexes.some((i) => !slides[i].hidden),
		wouldDeleteAllSlides: indexes.length >= slides.length,
	};
}
export function sorterGridColumns(zoom: number): number {
	return zoom >= 180 ? 2 : zoom >= 140 ? 3 : zoom >= 100 ? 4 : zoom >= 70 ? 5 : 6;
}
/** A decision descriptor; adapters apply deck operations in descending index order. */
export function applySorterAction(
	state: SlideSorterState,
	slides: readonly SorterSlide[],
	action: SlideSorterKeyActionName | 'toggle-hidden',
	active: number,
): {
	state: SlideSorterState;
	indexes: number[];
	operation?: 'duplicate' | 'delete' | 'toggle-hidden';
	close?: boolean;
} {
	const indexes = sorterSelectionIndexes(state, slides);
	switch (action) {
		case 'close':
			return { state, indexes: [], close: true };
		case 'collapseSelection':
			return {
				state: { ...state, selectedIds: slides[active] ? [slides[active].id] : [], anchor: active },
				indexes: [],
			};
		case 'selectAll':
			return { state: { ...state, selectedIds: slides.map((s) => s.id) }, indexes: [] };
		case 'copy':
			return { state: { ...state, clipboardIds: indexes.map((i) => slides[i].id) }, indexes: [] };
		case 'zoomIn':
		case 'zoomOut':
			return {
				state: {
					...state,
					zoom: clampSorterZoom(
						state.zoom + (action === 'zoomIn' ? SORTER_ZOOM_STEP : -SORTER_ZOOM_STEP),
					),
				},
				indexes: [],
			};
		case 'paste':
			return {
				state,
				indexes: slideSorterPasteIndexes(state.clipboardIds, slides).reverse(),
				operation: 'duplicate',
			};
		case 'delete':
			return {
				state: indexes.length < slides.length ? { ...state, selectedIds: [] } : state,
				indexes: indexes.length < slides.length ? indexes.reverse() : [],
				operation: 'delete',
			};
		case 'duplicate':
		case 'toggle-hidden':
			return { state, indexes: indexes.reverse(), operation: action };
	}
}
