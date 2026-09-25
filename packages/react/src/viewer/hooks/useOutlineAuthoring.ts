import type { PptxElement, ShapePptxElement } from 'pptx-viewer-core';
import { isEditPointsEnabled } from 'pptx-viewer-shared';
import { useCallback, useMemo } from 'react';

import type { OutlineAuthoringProps } from '../components/canvas/OutlineAuthoringLayer';
import { useViewerCustomizationContext } from '../components/viewer-customization-context';
import type { EditPointsModeState } from './useEditPointsState';

export interface UseOutlineAuthoringInput {
	state: EditPointsModeState;
	/** The generic on-canvas element update (one undo step per call). */
	updateElement: (elementId: string, updates: Partial<PptxElement>) => void;
	/** Insert a shape and select it. */
	insertShape: (shape: ShapePptxElement) => void;
}

/**
 * The `outlineAuthoring` props `SlideCanvas` needs: Edit Points commits go
 * through the canvas's element-update path (so each is one undo step), a drawn
 * freeform through the insert path, and the host's customisation decides
 * whether Edit Points is on at all and which of its commands are offered.
 */
export function useOutlineAuthoring({
	state,
	updateElement,
	insertShape,
}: UseOutlineAuthoringInput): OutlineAuthoringProps {
	const customization = useViewerCustomizationContext();
	const { editPointsElementId, setEditPointsElementId, activeFreeformTool, setActiveFreeformTool } =
		state;
	const enabled = isEditPointsEnabled(customization);
	const onExitEditPoints = useCallback(
		() => setEditPointsElementId(null),
		[setEditPointsElementId],
	);
	const onFreeformCancel = useCallback(() => setActiveFreeformTool(null), [setActiveFreeformTool]);
	return useMemo(
		() => ({
			editPointsElementId: enabled ? editPointsElementId : null,
			hiddenEditPointsCommands: customization.hiddenEditPointsCommands,
			onCommitEditPoints: (elementId, patch) => updateElement(elementId, patch),
			onExitEditPoints,
			freeformTool: activeFreeformTool,
			onFreeformCommit: (shape) => {
				setActiveFreeformTool(null);
				insertShape(shape);
			},
			onFreeformCancel,
		}),
		[
			enabled,
			editPointsElementId,
			customization.hiddenEditPointsCommands,
			updateElement,
			onExitEditPoints,
			activeFreeformTool,
			setActiveFreeformTool,
			insertShape,
			onFreeformCancel,
		],
	);
}
