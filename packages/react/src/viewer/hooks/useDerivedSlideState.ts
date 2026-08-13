import type { PptxSlide, PptxSlideMaster, PptxSlideLayout } from 'pptx-viewer-core';
import {
	groupSlidesBySection,
	masterViewPseudoSlide,
	resolveShowSlideIndexes,
} from 'pptx-viewer-shared';
/**
 * useDerivedSlideState: Memoised computed values derived from slide and
 * presentation state.  Keeps the orchestrator component slim by hosting
 * the four most expensive `useMemo` blocks in one place.
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import {
	DEFAULT_SECTION_GROUP_ID,
	EMU_PER_PX,
	GRID_SIZE,
	UNGROUPED_SECTION_ID,
} from '../constants';
import type { SlideSectionGroup } from '../types';
import type { ViewerMode } from '../types-core';

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface UseDerivedSlideStateInput {
	slides: PptxSlide[];
	sections: Array<{
		id: string;
		name: string;
		collapsed?: boolean;
		color?: string;
	}>;
	customShows: Array<{ id: string; name: string; slideRIds: string[] }>;
	activeCustomShowId: string | null;
	mode: ViewerMode;
	activeLayout: PptxSlideLayout | undefined;
	activeMaster: PptxSlideMaster | undefined;
	presentationGridSpacing: { cx: number } | undefined;
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

export interface DerivedSlideState {
	gridSpacingPx: number;
	visibleSlideIndexes: number[];
	slideSectionGroups: SlideSectionGroup[];
	masterPseudoSlide: PptxSlide | undefined;
}

// ---------------------------------------------------------------------------
// Pure helper functions (exported for testing)
// ---------------------------------------------------------------------------

/** Compute grid spacing in pixels from presentation grid spacing in EMU. */
export function computeGridSpacingPx(presentationGridSpacing: { cx: number } | undefined): number {
	if (presentationGridSpacing) {
		const px = Math.round(presentationGridSpacing.cx / EMU_PER_PX);
		if (px > 0) {
			return px;
		}
	}
	return GRID_SIZE;
}

/**
 * The ordered deck indexes the slide show visits: the active custom show's
 * membership, minus any slide the author hid.
 *
 * The rule itself lives in `pptx-viewer-shared` so React, Vue, Angular, Svelte
 * and Vanilla cannot answer "what comes next" differently and present a slide
 * its author hid. This wrapper only adapts React's custom-show shape.
 */
export function computeVisibleSlideIndexes(
	slides: PptxSlide[],
	activeCustomShowId: string | null,
	customShows: Array<{ id: string; name: string; slideRIds: string[] }>,
): number[] {
	const activeShow = activeCustomShowId
		? customShows.find((show) => show.id === activeCustomShowId)
		: undefined;
	return resolveShowSlideIndexes(slides, activeShow);
}

/** Compute slide section groups for the slides pane sidebar. */
export function computeSlideSectionGroups(
	slides: PptxSlide[],
	sections: Array<{
		id: string;
		name: string;
		collapsed?: boolean;
		color?: string;
	}>,
): SlideSectionGroup[] {
	return groupSlidesBySection(sections, slides).map((group) => ({
		id:
			group.section?.id ?? (sections.length > 0 ? UNGROUPED_SECTION_ID : DEFAULT_SECTION_GROUP_ID),
		label: group.section?.name ?? (sections.length > 0 ? 'Ungrouped Slides' : 'Slides'),
		slideIndexes: group.slideIndexes,
		...(group.section?.color !== undefined ? { color: group.section.color } : {}),
		...(group.section?.collapsed !== undefined
			? { defaultCollapsed: group.section.collapsed }
			: {}),
	}));
}

/**
 * Compute a pseudo-slide for master / layout canvas rendering.
 *
 * The composition rule (a layout is painted on top of its own master, and the
 * pseudo-slide is keyed on the selected part's archive path) lives in
 * `pptx-viewer-shared` so all five bindings agree; this wrapper only adapts
 * React's already-resolved master/layout objects to it.
 */
export function computeMasterPseudoSlide(
	mode: ViewerMode,
	activeLayout: PptxSlideLayout | undefined,
	activeMaster: PptxSlideMaster | undefined,
): PptxSlide | undefined {
	if (mode !== 'master' || !activeMaster) {
		return undefined;
	}
	// React resolves the layout object itself rather than an index, so pin it
	// as the master's only layout to address it positionally.
	const document = activeLayout
		? { slideMasters: [{ ...activeMaster, layouts: [activeLayout] }] }
		: { slideMasters: [activeMaster] };
	return masterViewPseudoSlide(document, {
		tab: 'slides',
		masterIndex: 0,
		layoutIndex: activeLayout ? 0 : null,
	});
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDerivedSlideState(input: UseDerivedSlideStateInput): DerivedSlideState {
	const { t } = useTranslation();
	const {
		slides,
		sections,
		customShows,
		activeCustomShowId,
		mode,
		activeLayout,
		activeMaster,
		presentationGridSpacing,
	} = input;

	// Grid spacing in pixels
	const gridSpacingPx = useMemo(
		() => computeGridSpacingPx(presentationGridSpacing),
		[presentationGridSpacing],
	);

	// Slide indexes visible in the current custom show (or all non-hidden)
	const visibleSlideIndexes = useMemo(
		() => computeVisibleSlideIndexes(slides, activeCustomShowId, customShows),
		[slides, activeCustomShowId, customShows],
	);

	// Slide section groups for the slides pane sidebar. `computeSlideSectionGroups`
	// is a pure helper (unit-tested with literal English labels), so translation
	// of its two auto-generated group labels happens here, at the hook level.
	const slideSectionGroups: SlideSectionGroup[] = useMemo(
		() =>
			computeSlideSectionGroups(slides, sections).map((group) => {
				if (group.id === UNGROUPED_SECTION_ID && group.label === 'Ungrouped Slides') {
					return { ...group, label: t('pptx.slides.ungroupedSlides') };
				}
				if (group.id === DEFAULT_SECTION_GROUP_ID && group.label === 'Slides') {
					return { ...group, label: t('pptx.sections.slides') };
				}
				return group;
			}),
		[slides, sections, t],
	);

	// Pseudo-slide for master / layout canvas rendering
	const masterPseudoSlide = useMemo(
		() => computeMasterPseudoSlide(mode, activeLayout, activeMaster),
		[mode, activeLayout, activeMaster],
	);

	return {
		gridSpacingPx,
		visibleSlideIndexes,
		slideSectionGroups,
		masterPseudoSlide,
	};
}
