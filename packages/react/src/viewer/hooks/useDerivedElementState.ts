import type {
	PptxElement,
	PptxHandoutMaster,
	PptxNotesMaster,
	PptxSlide,
	PptxSlideLayout,
	PptxSlideMaster,
} from 'pptx-viewer-core';
import { visibleTemplateElements } from 'pptx-viewer-shared';
/**
 * useDerivedElementState: Memoised element and master-view derived state.
 *
 * Extracted from useViewerCoreState to keep files under the 300-line limit.
 */
import { useMemo } from 'react';

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
/*  Pure helper functions (exported for testing)                       */
/* ------------------------------------------------------------------ */

/** Build a lookup map from template + slide elements. Slide elements override template elements with the same id. */
export function buildElementLookup(
	templateElements: PptxElement[],
	slideElements: PptxElement[],
): Map<string, PptxElement> {
	const map = new Map<string, PptxElement>();
	for (const el of templateElements) {
		map.set(el.id, el);
	}
	for (const el of slideElements) {
		map.set(el.id, el);
	}
	return map;
}

/** Compute the effective list of selected element IDs. */
export function computeEffectiveSelectedIds(
	selectedElementId: string | null,
	selectedElementIds: string[],
): string[] {
	if (selectedElementIds.length > 0) {
		return selectedElementIds;
	}
	return selectedElementId ? [selectedElementId] : [];
}

/** Resolve the active layout from a master and layout index. */
export function resolveActiveLayout(
	activeMaster: PptxSlideMaster | undefined,
	activeLayoutIndex: number | null,
): PptxSlideLayout | undefined {
	if (activeLayoutIndex === null || !activeMaster?.layouts) {
		return undefined;
	}
	return activeMaster.layouts[activeLayoutIndex];
}

/** Compute elements for master view rendering. Layout elements take priority over master elements. */
export function computeMasterViewElements(
	activeMaster: PptxSlideMaster | undefined,
	activeLayout: PptxSlideLayout | undefined,
): PptxElement[] {
	if (activeLayout) {
		return activeLayout.elements ?? [];
	}
	if (activeMaster) {
		return activeMaster.elements ?? [];
	}
	return [];
}

/* ------------------------------------------------------------------ */
/*  Hook                                                              */
/* ------------------------------------------------------------------ */

export function useDerivedElementState(input: UseDerivedElementStateInput): DerivedElementState {
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
		if (!activeSlide) {
			return [];
		}
		// Re-evaluated on every render (not partitioned again): "Hide Background
		// Graphics" (`showMasterShapes`) can be toggled after load, and the
		// template/slide split itself only happens once.
		return [
			...visibleTemplateElements(activeSlide, templateElementsBySlideId[activeSlide.id] ?? []),
		];
	}, [activeSlide, templateElementsBySlideId]);

	// ── Master View derived state ───────────────────────────────────
	// Resolved before the lookup below, which has to be able to see these:
	// the Slide Master view paints shapes whose ids (`slide-master-…`,
	// `slide-layout-…`, `notes-master-…`, `handout-master-…`) exist on no
	// slide, so a lookup built from `slides` alone resolved every one of them
	// to nothing. That single miss disabled inline text editing, the
	// tap-an-already-selected edit, the Arrange > Delete button and the
	// context menu over a master shape, all of whose handlers begin by
	// resolving the id. The write path behind them was correct all along.
	const activeMaster = slideMasters[activeMasterIndex];

	const activeLayout = useMemo(
		() => resolveActiveLayout(activeMaster, activeLayoutIndex),
		[activeMaster, activeLayoutIndex],
	);

	const masterViewElements = useMemo(
		() => computeMasterViewElements(activeMaster, activeLayout),
		[activeMaster, activeLayout],
	);

	const notesMasterElements = useMemo(() => notesMaster?.elements ?? [], [notesMaster]);

	const handoutMasterElements = useMemo(() => handoutMaster?.elements ?? [], [handoutMaster]);

	const elementLookup = useMemo(
		() =>
			buildElementLookup(
				[
					...templateElements,
					...masterViewElements,
					...notesMasterElements,
					...handoutMasterElements,
				],
				activeSlide?.elements ?? [],
			),
		[activeSlide, templateElements, masterViewElements, notesMasterElements, handoutMasterElements],
	);

	// ── Selection derived state ─────────────────────────────────────
	const selectedElement = useMemo(() => {
		if (!selectedElementId) {
			return null;
		}
		return elementLookup.get(selectedElementId) ?? null;
	}, [elementLookup, selectedElementId]);

	const effectiveSelectedIds = useMemo(
		() => computeEffectiveSelectedIds(selectedElementId, selectedElementIds),
		[selectedElementId, selectedElementIds],
	);

	const selectedElementIdSet = useMemo(() => new Set(effectiveSelectedIds), [effectiveSelectedIds]);

	const selectedElements = useMemo(
		() => effectiveSelectedIds.map((id) => elementLookup.get(id)).filter(Boolean) as PptxElement[],
		[effectiveSelectedIds, elementLookup],
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
