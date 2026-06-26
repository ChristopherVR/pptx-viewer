/**
 * useGroupAlignLayerHandlers: Group/ungroup, flip, alignment,
 * layer-order, and merge shapes handlers extracted from useElementManipulation.
 */
import type { PptxElement, PptxSlide, GroupPptxElement } from 'pptx-viewer-core';
import {
	alignElements,
	bringForward,
	bringToFront,
	distributeElements,
	groupElements,
	sendBackward,
	sendToBack,
} from 'pptx-viewer-shared';
import type { AlignEdge, DistributeAxis } from 'pptx-viewer-shared';

import { isTemplateElementId } from '../utils';
import { generateElementId } from '../utils/generate-id';
import { makeCloneId } from '../utils/template-editing';
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
		// Group within whichever store is being edited (template store while
		// edit-template mode is on, otherwise slide.elements).
		const { elements, groupId } = groupElements(ops.activeElements, ids, generateElementId());
		if (groupId === null) {
			return;
		}
		ops.updateActiveElements(() => elements);
		ops.applySelection(groupId);
		history.markDirty();
	};

	const handleUngroupElement = () => {
		if (!selectedElement || selectedElement.type !== 'group' || !activeSlide) {
			return;
		}
		const group = selectedElement as GroupPptxElement;
		const intoTemplate = isTemplateElementId(group.id);
		const ungrouped: PptxElement[] = group.children.map((child) => ({
			...structuredClone(child),
			// Keep child ids in the same store as the group so later edits route
			// correctly: template groups yield template-prefixed child ids.
			id: intoTemplate ? makeCloneId(true, child.id || group.id) : child.id || generateElementId(),
			x: child.x + group.x,
			y: child.y + group.y,
		}));
		ops.updateActiveElements((els) => [...els.filter((el) => el.id !== group.id), ...ungrouped]);
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

	const handleDistributeElements = (axis: string) => {
		if (selectedElements.length < 3) {
			return;
		}
		const distAxis = (
			axis === 'horizontal' || axis === 'vertical' ? axis : null
		) as DistributeAxis | null;
		if (!distAxis) {
			return;
		}
		const positions = distributeElements(selectedElements, distAxis);
		for (const [id, pos] of positions) {
			const el = elementLookup.get(id);
			if (!el) {
				continue;
			}
			ops.updateElementById(id, { x: pos.x ?? el.x, y: pos.y ?? el.y });
		}
		history.markDirty();
	};

	const canDistribute = selectedElements.length >= 3;

	const handleMoveLayer = (direction: string) => {
		if (!selectedElement || !activeSlide) {
			return;
		}
		const id = selectedElement.id;
		ops.updateActiveElements((els) =>
			direction === 'forward'
				? bringForward(els, id)
				: direction === 'backward'
					? sendBackward(els, id)
					: els,
		);
		history.markDirty();
	};

	const handleMoveLayerToEdge = (direction: string) => {
		if (!selectedElement || !activeSlide) {
			return;
		}
		const id = selectedElement.id;
		ops.updateActiveElements((els) =>
			direction === 'front' ? bringToFront(els, id) : sendToBack(els, id),
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
		handleDistributeElements,
		canDistribute,
		handleMoveLayer,
		handleMoveLayerToEdge,
		handleMergeShapes,
		canMergeShapes,
	};
}
