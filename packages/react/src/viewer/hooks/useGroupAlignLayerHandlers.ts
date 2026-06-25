/**
 * useGroupAlignLayerHandlers: Group/ungroup, flip, alignment,
 * layer-order, and merge shapes handlers extracted from useElementManipulation.
 */
import type { PptxElement, PptxSlide, GroupPptxElement } from 'pptx-viewer-core';
import {
	alignElements,
	bringForward,
	bringToFront,
	groupElements,
	sendBackward,
	sendToBack,
} from 'pptx-viewer-shared';
import type { AlignEdge } from 'pptx-viewer-shared';

import { generateElementId } from '../utils/generate-id';
import type { GroupAlignLayerHandlers } from './element-manipulation-types';
import type { EditorHistoryResult } from './useEditorHistory';
import type { ElementOperations } from './useElementOperations';
import { useMergeShapesHandler } from './useMergeShapesHandler';

/** Map the React toolbar's align keys onto the shared {@link AlignEdge} names. */
const ALIGN_EDGE_BY_KEY: Record<string, AlignEdge> = {
	left: 'left',
	center: 'centerH',
	right: 'right',
	top: 'top',
	middle: 'middle',
	bottom: 'bottom',
};

interface GroupAlignLayerInput {
	activeSlide: PptxSlide | undefined;
	activeSlideIndex: number;
	selectedElement: PptxElement | null;
	effectiveSelectedIds: string[];
	selectedElements: PptxElement[];
	elementLookup: Map<string, PptxElement>;
	setSelectedElementIds: React.Dispatch<React.SetStateAction<string[]>>;
	ops: ElementOperations;
	history: EditorHistoryResult;
}

export function useGroupAlignLayerHandlers(input: GroupAlignLayerInput): GroupAlignLayerHandlers {
	const {
		activeSlide,
		activeSlideIndex,
		selectedElement,
		effectiveSelectedIds,
		selectedElements,
		elementLookup,
		setSelectedElementIds,
		ops,
		history,
	} = input;

	const handleGroupElements = () => {
		const ids = effectiveSelectedIds;
		if (ids.length < 2 || !activeSlide) {
			return;
		}
		const { elements, groupId } = groupElements(activeSlide.elements, ids, generateElementId());
		if (groupId === null) {
			return;
		}
		ops.updateSlides((prev) =>
			prev.map((s, i) => (i === activeSlideIndex ? { ...s, elements } : s)),
		);
		ops.applySelection(groupId);
		history.markDirty();
	};

	const handleUngroupElement = () => {
		if (!selectedElement || selectedElement.type !== 'group' || !activeSlide) {
			return;
		}
		const group = selectedElement as GroupPptxElement;
		const ungrouped: PptxElement[] = group.children.map((child) => ({
			...structuredClone(child),
			id: child.id || generateElementId(),
			x: child.x + group.x,
			y: child.y + group.y,
		}));
		ops.updateSlides((prev) =>
			prev.map((s, i) =>
				i === activeSlideIndex
					? {
							...s,
							elements: [...s.elements.filter((el) => el.id !== group.id), ...ungrouped],
						}
					: s,
			),
		);
		setSelectedElementIds(ungrouped.map((el) => el.id));
		history.markDirty();
	};

	const handleFlip = (direction: 'horizontal' | 'vertical') => {
		if (!selectedElement) {
			return;
		}
		const update =
			direction === 'horizontal'
				? { flipHorizontal: !selectedElement.flipHorizontal }
				: { flipVertical: !selectedElement.flipVertical };
		ops.updateSelectedElement(update);
		history.markDirty();
	};

	const handleAlignElements = (align: string) => {
		if (selectedElements.length < 2) {
			return;
		}
		const edge = ALIGN_EDGE_BY_KEY[align];
		if (!edge) {
			return;
		}
		const positions = alignElements(selectedElements, edge);
		for (const [id, pos] of positions) {
			const el = elementLookup.get(id);
			if (!el) {
				continue;
			}
			// `alignElements` only sets the touched axis; keep the other axis as-is.
			ops.updateElementById(id, { x: pos.x ?? el.x, y: pos.y ?? el.y });
		}
		history.markDirty();
	};

	const handleMoveLayer = (direction: string) => {
		if (!selectedElement || !activeSlide) {
			return;
		}
		const id = selectedElement.id;
		const newElements =
			direction === 'forward'
				? bringForward(activeSlide.elements, id)
				: direction === 'backward'
					? sendBackward(activeSlide.elements, id)
					: activeSlide.elements;
		ops.updateSlides((prev) =>
			prev.map((s, i) => (i === activeSlideIndex ? { ...s, elements: newElements } : s)),
		);
		history.markDirty();
	};

	const handleMoveLayerToEdge = (direction: string) => {
		if (!selectedElement || !activeSlide) {
			return;
		}
		const id = selectedElement.id;
		const newElements =
			direction === 'front'
				? bringToFront(activeSlide.elements, id)
				: sendToBack(activeSlide.elements, id);
		ops.updateSlides((prev) =>
			prev.map((s, i) => (i === activeSlideIndex ? { ...s, elements: newElements } : s)),
		);
		history.markDirty();
	};

	const { handleMergeShapes, canMergeShapes } = useMergeShapesHandler({
		activeSlide,
		activeSlideIndex,
		selectedElements,
		effectiveSelectedIds,
		setSelectedElementIds,
		ops,
		history,
	});

	return {
		handleGroupElements,
		handleUngroupElement,
		handleFlip,
		handleAlignElements,
		handleMoveLayer,
		handleMoveLayerToEdge,
		handleMergeShapes,
		canMergeShapes,
	};
}
