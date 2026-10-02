import { EDITOR_THUMBNAIL_WIDTH, editorThumbnailStep } from 'pptx-viewer-shared';

import { DEFAULT_SECTION_GROUP_ID, UNGROUPED_SECTION_ID } from '../../constants';
import type { SlideSectionGroup } from '../../types';

/**
 * Where a section sits among the DECLARED sections. The synthetic groups (the
 * deck's "no sections at all" group and the trailing "ungrouped slides" group)
 * are not sections: they have no menu and do not count toward Move Up / Move
 * Down gating, matching the other four bindings.
 */
export function declaredSectionFacts(
	groups: readonly SlideSectionGroup[],
	sectionId: string,
): { isDeclared: boolean; index: number; total: number } {
	const declared = groups
		.filter((group) => group.id !== DEFAULT_SECTION_GROUP_ID && group.id !== UNGROUPED_SECTION_ID)
		.map((group) => group.id);
	return {
		isDeclared: declared.includes(sectionId),
		index: declared.indexOf(sectionId),
		total: declared.length,
	};
}

/**
 * Format a duration in milliseconds as "M:SS".
 */
export function formatTimingMs(ms: number): string {
	const totalSeconds = Math.max(0, Math.floor(ms / 1000));
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${String(minutes)}:${String(seconds).padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ */
/*  Flat item list for virtualization                                  */
/* ------------------------------------------------------------------ */

/** A section header entry in the flat list. */
export interface FlatSectionItem {
	type: 'section';
	sectionIndex: number;
	sectionId: string;
}

/** A slide entry in the flat list. */
export interface FlatSlideItem {
	type: 'slide';
	slideIndex: number;
}

export type FlatPaneItem = FlatSectionItem | FlatSlideItem;

/**
 * Build a flat, ordered list of renderable items (section headers + slides)
 * from the section groups. This flattened representation is what the
 * virtualizer iterates over.
 *
 * @param sectionGroups - The grouped slide sections.
 * @param showSectionHeaders - Whether to include section header rows.
 * @param collapsedSections - Map of section ID to collapsed state.
 * @returns A flat array of section-header and slide items.
 */
export function buildFlatPaneItems(
	sectionGroups: SlideSectionGroup[],
	showSectionHeaders: boolean,
	collapsedSections: Record<string, boolean>,
): FlatPaneItem[] {
	const items: FlatPaneItem[] = [];

	for (let si = 0; si < sectionGroups.length; si++) {
		const section = sectionGroups[si];
		if (showSectionHeaders) {
			items.push({
				type: 'section',
				sectionIndex: si,
				sectionId: section.id,
			});
		}

		const isCollapsed = collapsedSections[section.id] ?? false;
		if (!isCollapsed) {
			for (const idx of section.slideIndexes) {
				items.push({ type: 'slide', slideIndex: idx });
			}
		}
	}
	return items;
}

/**
 * Compute the estimated pixel height of a slide item in the sidebar,
 * based on the canvas aspect ratio.
 *
 * @param canvasWidth  - Canvas width in px (clamped to >= 1).
 * @param canvasHeight - Canvas height in px (clamped to >= 1).
 * @returns Estimated total height of one slide item row in px.
 */
export function estimateSlideItemHeight(
	canvasWidth: number,
	canvasHeight: number,
	width = EDITOR_THUMBNAIL_WIDTH,
): number {
	return editorThumbnailStep(canvasWidth, canvasHeight, width);
}
