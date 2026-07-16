import type { PptxSlide, PptxSlideMaster, PptxSlideLayout } from 'pptx-viewer-core';
import { groupSlidesBySection } from 'pptx-viewer-shared';
/**
 * useDerivedSlideState: Memoised computed values derived from slide and
 * presentation state.  Keeps the orchestrator component slim by hosting
 * the four most expensive `useMemo` blocks in one place.
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { EMU_PER_PX, GRID_SIZE, UNGROUPED_SECTION_ID } from '../constants';
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

/** Compute visible slide indexes based on custom show or hidden state. */
export function computeVisibleSlideIndexes(
	slides: PptxSlide[],
	activeCustomShowId: string | null,
	customShows: Array<{ id: string; name: string; slideRIds: string[] }>,
): number[] {
	if (activeCustomShowId) {
		const show = customShows.find((s) => s.id === activeCustomShowId);
		if (show) {
			const rIdToIndex = new Map<string, number>();
			slides.forEach((s, i) => rIdToIndex.set(s.rId, i));
			return show.slideRIds
				.map((rId) => rIdToIndex.get(rId))
				.filter((i): i is number => i !== undefined);
		}
	}
	return slides.map((_, i) => i).filter((i) => !slides[i]?.hidden);
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
		id: group.section?.id ?? (sections.length > 0 ? UNGROUPED_SECTION_ID : 'default'),
		label: group.section?.name ?? (sections.length > 0 ? 'Ungrouped Slides' : 'Slides'),
		slideIndexes: group.slideIndexes,
		...(group.section?.color !== undefined ? { color: group.section.color } : {}),
		...(group.section?.collapsed !== undefined
			? { defaultCollapsed: group.section.collapsed }
			: {}),
	}));
}

/** Compute a pseudo-slide for master / layout canvas rendering. */
export function computeMasterPseudoSlide(
	mode: ViewerMode,
	activeLayout: PptxSlideLayout | undefined,
	activeMaster: PptxSlideMaster | undefined,
): PptxSlide | undefined {
	if (mode !== 'master') {
		return undefined;
	}
	if (activeLayout) {
		return {
			id: activeLayout.path,
			rId: '',
			slideNumber: 0,
			elements: activeLayout.elements ?? [],
			backgroundColor: activeLayout.backgroundColor ?? activeMaster?.backgroundColor,
			backgroundImage: activeLayout.backgroundImage ?? activeMaster?.backgroundImage,
		};
	}
	if (activeMaster) {
		return {
			id: activeMaster.path,
			rId: '',
			slideNumber: 0,
			elements: activeMaster.elements ?? [],
			backgroundColor: activeMaster.backgroundColor,
			backgroundImage: activeMaster.backgroundImage,
		};
	}
	return undefined;
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
				if (group.id === 'default' && group.label === 'Slides') {
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
