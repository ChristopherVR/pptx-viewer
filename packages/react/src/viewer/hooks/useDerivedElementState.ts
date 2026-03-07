/**
 * useDerivedElementState — Memoised element and master-view derived state.
 *
 * Extracted from useViewerCoreState to keep files under the 300-line limit.
 */
import { useMemo } from "react";

import type {
  PptxElement,
  PptxHandoutMaster,
  PptxNotesMaster,
  PptxSlide,
  PptxSlideLayout,
  PptxSlideMaster,
} from "pptx-viewer-core";

/* ------------------------------------------------------------------ */
/*  Input / Output types                                              */
/* ------------------------------------------------------------------ */

export interface UseDerivedElementStateInput {
  slides: PptxSlide[];
  activeSlideIndex: number;
  templateElementsBySlideId: Record<string, PptxElement[]>;
  selectedElementId: string | null;
  selectedElementIds: string[];
  slideMasters: PptxSlideMaster[];
  activeMasterIndex: number;
  activeLayoutIndex: number | null;
  notesMaster: PptxNotesMaster | undefined;
  handoutMaster: PptxHandoutMaster | undefined;
}

export interface DerivedElementState {
  activeSlide: PptxSlide | undefined;
  templateElements: PptxElement[];
  elementLookup: Map<string, PptxElement>;
  selectedElement: PptxElement | null;
  effectiveSelectedIds: string[];
  selectedElementIdSet: Set<string>;
  selectedElements: PptxElement[];
  activeMaster: PptxSlideMaster | undefined;
  activeLayout: PptxSlideLayout | undefined;
  masterViewElements: PptxElement[];
  notesMasterElements: PptxElement[];
  handoutMasterElements: PptxElement[];
}

/* ------------------------------------------------------------------ */
/*  Hook                                                              */
/* ------------------------------------------------------------------ */

export function useDerivedElementState(
  input: UseDerivedElementStateInput,
): DerivedElementState {
  const {
    slides,
    activeSlideIndex,
    templateElementsBySlideId,
    selectedElementId,
    selectedElementIds,
    slideMasters,
    activeMasterIndex,
    activeLayoutIndex,
    notesMaster,
    handoutMaster,
  } = input;

  // ── Slide-level derived state ───────────────────────────────────
  const activeSlide = slides[activeSlideIndex];

  const templateElements = useMemo(() => {
    if (!activeSlide) return [];
    return templateElementsBySlideId[activeSlide.id] ?? [];
  }, [activeSlide, templateElementsBySlideId]);

  const elementLookup = useMemo(() => {
    const map = new Map<string, PptxElement>();
    for (const el of templateElements) map.set(el.id, el);
    for (const el of activeSlide?.elements ?? []) map.set(el.id, el);
    return map;
  }, [activeSlide, templateElements]);

  // ── Selection derived state ─────────────────────────────────────
  const selectedElement = useMemo(() => {
    if (!selectedElementId) return null;
    return elementLookup.get(selectedElementId) ?? null;
  }, [elementLookup, selectedElementId]);

  const effectiveSelectedIds = useMemo(() => {
    if (selectedElementIds.length > 0) return selectedElementIds;
    return selectedElementId ? [selectedElementId] : [];
  }, [selectedElementId, selectedElementIds]);

  const selectedElementIdSet = useMemo(
    () => new Set(effectiveSelectedIds),
    [effectiveSelectedIds],
  );

  const selectedElements = useMemo(
    () =>
      effectiveSelectedIds
        .map((id) => elementLookup.get(id))
        .filter(Boolean) as PptxElement[],
    [effectiveSelectedIds, elementLookup],
  );

  // ── Master View derived state ───────────────────────────────────
  const activeMaster = slideMasters[activeMasterIndex];

  const activeLayout = useMemo(() => {
    if (activeLayoutIndex === null || !activeMaster?.layouts) return undefined;
    return activeMaster.layouts[activeLayoutIndex];
  }, [activeMaster, activeLayoutIndex]);

  const masterViewElements = useMemo(() => {
    if (activeLayout) return activeLayout.elements ?? [];
    if (activeMaster) return activeMaster.elements ?? [];
    return [];
  }, [activeMaster, activeLayout]);

  const notesMasterElements = useMemo(
    () => notesMaster?.elements ?? [],
    [notesMaster],
  );

  const handoutMasterElements = useMemo(
    () => handoutMaster?.elements ?? [],
    [handoutMaster],
  );

  return {
    activeSlide,
    templateElements,
    elementLookup,
    selectedElement,
    effectiveSelectedIds,
    selectedElementIdSet,
    selectedElements,
    activeMaster,
    activeLayout,
    masterViewElements,
    notesMasterElements,
    handoutMasterElements,
  };
}
