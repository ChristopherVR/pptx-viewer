/**
 * useSlidePaneRailMenu: Ctrl/Shift multi-select and the thumbnail right-click
 * menu for `SlidesPaneSidebar.vue`.
 *
 * Split out of the SFC (already past the repo's 300-line guideline once this
 * landed) so the component stays template plus thin wiring. The click
 * resolution and the menu's command list are both shared
 * (`resolveSlidePaneClick` / `buildSlidePaneContextMenuEntries`); this module
 * is only the Vue-side reactive state around them.
 */
import type { PptxSlide } from 'pptx-viewer-core';
import { buildSlidePaneContextMenuEntries, resolveSlidePaneClick } from 'pptx-viewer-shared';
import { computed, ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';
import { useI18n } from 'vue-i18n';

import type { ContextMenuItem } from '../components/ContextMenu.vue';

export interface SlidePaneRailMenuEmit {
	select: (index: number) => void;
	'add-slide-after': (index: number) => void;
	duplicate: (indexes: number[]) => void;
	delete: (indexes: number[]) => void;
	'toggle-hidden': (indexes: number[]) => void;
	layout: (payload: { index: number; x: number; y: number }) => void;
	'add-section': (index: number) => void;
}

export interface SlidePaneContextMenuState {
	open: boolean;
	x: number;
	y: number;
	index: number;
	selectedIndexes: number[];
}

export interface UseSlidePaneRailMenuResult {
	selectedIds: Ref<string[]>;
	isSelected: (slideId: string) => boolean;
	onSlideClick: (e: MouseEvent, index: number) => void;
	onPaneKeydown: (e: KeyboardEvent) => void;
	menu: Ref<SlidePaneContextMenuState>;
	menuItems: ComputedRef<ContextMenuItem[]>;
	onContextMenu: (e: MouseEvent, index: number) => void;
	onMenuSelect: (id: string) => void;
}

export function useSlidePaneRailMenu(
	slides: () => readonly PptxSlide[],
	activeIndex: () => number,
	canEdit: () => boolean,
	emit: <K extends keyof SlidePaneRailMenuEmit>(
		event: K,
		...args: Parameters<SlidePaneRailMenuEmit[K]>
	) => void,
): UseSlidePaneRailMenuResult {
	const { t } = useI18n();

	// Ids, not indexes: an index shifts under insert/delete/move, so an
	// index-keyed selection silently points at the wrong slide the moment the
	// deck changes shape.
	const selectedIds = ref<string[]>([]);
	const selectionAnchorId = ref<string | null>(null);
	function isSelected(slideId: string): boolean {
		return selectedIds.value.includes(slideId);
	}
	function onSlideClick(e: MouseEvent, index: number): void {
		const slide = slides()[index];
		if (slide) {
			const result = resolveSlidePaneClick({
				clickedId: slide.id,
				orderedIds: slides().map((s) => s.id),
				selectedIds: selectedIds.value,
				anchorId: selectionAnchorId.value,
				ctrlKey: e.ctrlKey,
				metaKey: e.metaKey,
				shiftKey: e.shiftKey,
			});
			selectedIds.value = result.selectedIds;
			selectionAnchorId.value = result.anchorId;
		}
		emit('select', index);
	}
	/** PowerPoint's Enter on a focused thumbnail inserts a new slide after it. */
	function onPaneKeydown(e: KeyboardEvent): void {
		if (e.key === 'Enter' && canEdit()) {
			e.preventDefault();
			emit('add-slide-after', activeIndex());
		}
	}

	// ── Slide context menu ──
	const menu = ref<SlidePaneContextMenuState>({
		open: false,
		x: 0,
		y: 0,
		index: -1,
		selectedIndexes: [],
	});
	const menuItems = computed<ContextMenuItem[]>(() => {
		const selected = menu.value.selectedIndexes
			.map((i) => slides()[i])
			.filter((s): s is PptxSlide => Boolean(s));
		const entries = buildSlidePaneContextMenuEntries({
			selectedCount: selected.length,
			hasHiddenInSelection: selected.some((s) => s.hidden),
			hasVisibleInSelection: selected.some((s) => !s.hidden),
			wouldDeleteAllSlides: selected.length >= slides().length,
		});
		return entries.flatMap((entry, index) => {
			const item: ContextMenuItem = {
				id: entry.id,
				label: entry.countLabelKey
					? t(entry.labelKey, { count: selected.length })
					: t(entry.labelKey),
				disabled: entry.disabled,
			};
			return entry.separatorBefore
				? [{ id: `sep-${index}`, label: '', separator: true }, item]
				: [item];
		});
	});
	function onContextMenu(e: MouseEvent, index: number): void {
		if (!canEdit()) {
			return;
		}
		e.preventDefault();
		const slide = slides()[index];
		const idsForMenu =
			slide && selectedIds.value.length > 0 && selectedIds.value.includes(slide.id)
				? selectedIds.value
				: slide
					? [slide.id]
					: [];
		const selectedIndexes = idsForMenu
			.map((id) => slides().findIndex((s) => s.id === id))
			.filter((i) => i !== -1);
		menu.value = { open: true, x: e.clientX, y: e.clientY, index, selectedIndexes };
	}
	function onMenuSelect(id: string): void {
		const { index, selectedIndexes, x, y } = menu.value;
		menu.value = { ...menu.value, open: false };
		if (index < 0) {
			return;
		}
		switch (id) {
			case 'new-slide':
				emit('add-slide-after', index);
				break;
			case 'duplicate':
				emit('duplicate', selectedIndexes);
				break;
			case 'delete':
				emit('delete', selectedIndexes);
				break;
			case 'layout':
				emit('layout', { index, x, y });
				break;
			case 'hide':
				emit('toggle-hidden', selectedIndexes);
				break;
			case 'add-section':
				emit('add-section', index);
				break;
			default:
				break;
		}
	}

	return {
		selectedIds,
		isSelected,
		onSlideClick,
		onPaneKeydown,
		menu,
		menuItems,
		onContextMenu,
		onMenuSelect,
	};
}
