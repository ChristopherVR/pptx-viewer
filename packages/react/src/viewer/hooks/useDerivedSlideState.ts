/**
 * useDerivedSlideState — Memoised computed values derived from slide and
 * presentation state.  Keeps the orchestrator component slim by hosting
 * the four most expensive `useMemo` blocks in one place.
 */
import { useMemo } from "react";

import type {
  PptxSlide,
  PptxSlideMaster,
  PptxSlideLayout,
} from "pptx-viewer-core";
import type { SlideSectionGroup } from "../types";
import type { ViewerMode } from "../types-core";
import { EMU_PER_PX, GRID_SIZE, UNGROUPED_SECTION_ID } from "../constants";

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
// Hook
// ---------------------------------------------------------------------------

export function useDerivedSlideState(
  input: UseDerivedSlideStateInput,
): DerivedSlideState {
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
  const gridSpacingPx = useMemo(() => {
    if (presentationGridSpacing) {
      const px = Math.round(presentationGridSpacing.cx / EMU_PER_PX);
      if (px > 0) return px;
    }
    return GRID_SIZE;
  }, [presentationGridSpacing]);

  // Slide indexes visible in the current custom show (or all non-hidden)
  const visibleSlideIndexes = useMemo(() => {
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
  }, [slides, activeCustomShowId, customShows]);

  // Slide section groups for the slides pane sidebar
  const slideSectionGroups: SlideSectionGroup[] = useMemo(() => {
    if (slides.length === 0) return [];

    if (sections.length > 0) {
      const sectionSlideMap = new Map<string, number[]>();
      const ungroupedIndexes: number[] = [];
      for (let i = 0; i < slides.length; i++) {
        const sid = slides[i].sectionId;
        if (sid) {
          const arr = sectionSlideMap.get(sid);
          if (arr) arr.push(i);
          else sectionSlideMap.set(sid, [i]);
        } else {
          ungroupedIndexes.push(i);
        }
      }

      const groups: SlideSectionGroup[] = sections
        .map((sec) => ({
          id: sec.id,
          label: sec.name,
          slideIndexes: sectionSlideMap.get(sec.id) ?? [],
          color: sec.color,
          defaultCollapsed: sec.collapsed,
        }))
        .filter((g) => g.slideIndexes.length > 0);

      if (ungroupedIndexes.length > 0) {
        groups.push({
          id: UNGROUPED_SECTION_ID,
          label: "Ungrouped Slides",
          slideIndexes: ungroupedIndexes,
        });
      }

      return groups.length > 0
        ? groups
        : [
            {
              id: "default",
              label: "Slides",
              slideIndexes: slides.map((_s, i) => i),
            },
          ];
    }

    return [
      {
        id: "default",
        label: "Slides",
        slideIndexes: slides.map((_s, i) => i),
      },
    ];
  }, [slides, sections]);

  // Pseudo-slide for master / layout canvas rendering
  const masterPseudoSlide = useMemo((): PptxSlide | undefined => {
    if (mode !== "master") return undefined;
    if (activeLayout) {
      return {
        id: activeLayout.path,
        rId: "",
        slideNumber: 0,
        elements: activeLayout.elements ?? [],
        backgroundColor:
          activeLayout.backgroundColor ?? activeMaster?.backgroundColor,
        backgroundImage:
          activeLayout.backgroundImage ?? activeMaster?.backgroundImage,
      };
    }
    if (activeMaster) {
      return {
        id: activeMaster.path,
        rId: "",
        slideNumber: 0,
        elements: activeMaster.elements ?? [],
        backgroundColor: activeMaster.backgroundColor,
        backgroundImage: activeMaster.backgroundImage,
      };
    }
    return undefined;
  }, [mode, activeLayout, activeMaster]);

  return {
    gridSpacingPx,
    visibleSlideIndexes,
    slideSectionGroups,
    masterPseudoSlide,
  };
}
