import type {
	PptxPresentationProperties,
	PptxSlide,
	PptxSlideMaster,
	PptxSlideLayout,
} from 'pptx-viewer-core';
import {
	computeGridSpacingPx as sharedComputeGridSpacingPx,
	groupSlidesBySection,
	masterViewPseudoSlide,
	resolveAuthoredSlideRange,
	resolveShowSlideIndexes,
} from 'pptx-viewer-shared';
/**
 * useDerivedSlideState: Memoised computed values derived from slide and
 * presentation state.  Keeps the orchestrator component slim by hosting
 * the four most expensive `useMemo` blocks in one place.
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { DEFAULT_SECTION_GROUP_ID, GRID_SIZE, UNGROUPED_SECTION_ID } from '../constants';
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
	/**
	 * `p:showPr`, read for `resolveAuthoredSlideRange` so a deck authored to
	 * open into a `p:sldRg` range (`showSlidesMode === 'range'`) presents only
	 * that range when no custom show is active.
	 */
	presentationProperties: Pick<
		PptxPresentationProperties,
		'showSlidesMode' | 'showSlidesFrom' | 'showSlidesTo'
	>;
	mode: ViewerMode;
	activeLayout: PptxSlideLayout | undefined;
	activeMaster: PptxSlideMaster | undefined;
	/**
	 * `PptxData.viewProperties.gridSpacing` (from `ppt/viewProps.xml`), NOT
	 * `presentationProperties.gridSpacing`: `p:gridSpacing` lives under
	 * `p:viewPr`, and a real PowerPoint file never populates it under
	 * `p:presentationPr`, so reading the latter always yields the fallback.
	 */
	documentGridSpacing: { cx: number } | undefined;
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

/**
 * Compute grid spacing in pixels from the document's authored grid spacing
 * (EMU, `viewProperties.gridSpacing`). Thin wrapper over the shared pure
 * decision function so React's default (`GRID_SIZE`) applies without every
 * call site repeating it.
 */
export function computeGridSpacingPx(documentGridSpacing: { cx: number } | undefined): number {
	return sharedComputeGridSpacingPx(documentGridSpacing, GRID_SIZE);
}

/**
 * The ordered deck indexes the slide show visits: the active custom show's
 * membership (or the deck's authored `p:sldRg` range), minus any slide the
 * author hid.
 *
 * The rule itself lives in `pptx-viewer-shared` so React, Vue, Angular, Svelte
 * and Vanilla cannot answer "what comes next" differently and present a slide
 * its author hid, or a slide outside a deck authored to open into a range.
 * This wrapper only adapts React's custom-show shape.
 */
export function computeVisibleSlideIndexes(
	slides: PptxSlide[],
	activeCustomShowId: string | null,
	customShows: Array<{ id: string; name: string; slideRIds: string[] }>,
	presentationProperties?: Pick<
		PptxPresentationProperties,
		'showSlidesMode' | 'showSlidesFrom' | 'showSlidesTo'
	>,
): number[] {
	const activeShow = activeCustomShowId
		? customShows.find((show) => show.id === activeCustomShowId)
		: undefined;
	const authoredRange = resolveAuthoredSlideRange(presentationProperties, slides.length);
	return resolveShowSlideIndexes(slides, activeShow, authoredRange);
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
		presentationProperties,
		mode,
		activeLayout,
		activeMaster,
		documentGridSpacing,
	} = input;

	// Grid spacing in pixels
	const gridSpacingPx = useMemo(
		() => computeGridSpacingPx(documentGridSpacing),
		[documentGridSpacing],
	);

	// Slide indexes visible in the current custom show (or all non-hidden)
	const visibleSlideIndexes = useMemo(
		() =>
			computeVisibleSlideIndexes(slides, activeCustomShowId, customShows, presentationProperties),
		[slides, activeCustomShowId, customShows, presentationProperties],
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
