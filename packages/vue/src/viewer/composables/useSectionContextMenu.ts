/**
 * useSectionContextMenu: the section-header right-click menu for
 * `SectionList.vue`.
 *
 * The command list, order, separators and end-of-list gating are shared
 * (`buildSectionContextMenuEntries`, `sectionAddAfterSlideIndex`); this module
 * is only the Vue-side reactive state around them, the same split as
 * `useSlidePaneRailMenu` for the thumbnail menu.
 */
import { buildSectionContextMenuEntries, sectionAddAfterSlideIndex } from 'pptx-viewer-shared';
import type { SectionContextMenuCommandId } from 'pptx-viewer-shared';
import { computed, ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';
import { useI18n } from 'vue-i18n';

import type { ContextMenuItem } from '../components/ContextMenu.vue';
import type { SectionGroup } from './useSectionOperations';

export interface SectionContextMenuHandlers {
	rename: (sectionId: string, currentName: string) => void;
	moveUp: (sectionId: string) => void;
	moveDown: (sectionId: string) => void;
	remove: (sectionId: string) => void;
	addAfter: (slideIndex: number) => void;
}

export interface SectionContextMenuState {
	open: boolean;
	x: number;
	y: number;
	sectionId: string;
}

export interface UseSectionContextMenuResult {
	menu: Ref<SectionContextMenuState>;
	items: ComputedRef<ContextMenuItem[]>;
	openFor: (event: MouseEvent, sectionId: string) => void;
	onSelect: (id: string) => void;
}

export function useSectionContextMenu(
	groups: () => readonly SectionGroup[],
	totalSlides: () => number,
	canEdit: () => boolean,
	handlers: SectionContextMenuHandlers,
): UseSectionContextMenuResult {
	const { t } = useI18n();
	const menu = ref<SectionContextMenuState>({ open: false, x: 0, y: 0, sectionId: '' });

	const declared = computed(() => groups().filter((group) => group.section !== undefined));
	const sectionIndex = computed(() =>
		declared.value.findIndex((group) => group.section?.id === menu.value.sectionId),
	);

	const items = computed<ContextMenuItem[]>(() =>
		buildSectionContextMenuEntries({
			sectionIndex: sectionIndex.value,
			totalSections: declared.value.length,
		}).flatMap((entry, index) => {
			const item: ContextMenuItem = {
				id: entry.id,
				label: t(entry.labelKey),
				disabled: entry.disabled,
			};
			return entry.separatorBefore
				? [{ id: `sep-${index}`, label: '', separator: true }, item]
				: [item];
		}),
	);

	function openFor(event: MouseEvent, sectionId: string): void {
		if (!canEdit()) {
			return;
		}
		event.preventDefault();
		menu.value = { open: true, x: event.clientX, y: event.clientY, sectionId };
	}

	function onSelect(id: string): void {
		const { sectionId } = menu.value;
		menu.value = { ...menu.value, open: false };
		const group = groups().find((candidate) => candidate.section?.id === sectionId);
		if (!group?.section) {
			return;
		}
		switch (id as SectionContextMenuCommandId) {
			case 'rename':
				handlers.rename(sectionId, group.section.name);
				break;
			case 'delete':
				handlers.remove(sectionId);
				break;
			case 'move-up':
				handlers.moveUp(sectionId);
				break;
			case 'move-down':
				handlers.moveDown(sectionId);
				break;
			case 'add-after':
				handlers.addAfter(
					sectionAddAfterSlideIndex(
						group.slideIndexes[group.slideIndexes.length - 1],
						totalSlides(),
					),
				);
				break;
			default:
				break;
		}
	}

	return { menu, items, openFor, onSelect };
}
