import type { FreeformToolKind } from 'pptx-viewer-shared';
import { useCallback, useState } from 'react';

/**
 * Viewer state for the two outline-authoring modes: Edit Points on one shape,
 * and the armed Freeform: Shape / Curve drawing tool. At most one is active;
 * arming a tool ends Edit Points and starting Edit Points disarms the tool.
 */
export interface EditPointsModeState {
	/** The shape in Edit Points mode, or null. */
	editPointsElementId: string | null;
	setEditPointsElementId: (id: string | null) => void;
	/** The armed click-to-place drawing tool, or null. */
	activeFreeformTool: FreeformToolKind | null;
	setActiveFreeformTool: (tool: FreeformToolKind | null) => void;
}

export function useEditPointsState(): EditPointsModeState {
	const [editPointsElementId, setEditPointsElementId] = useState<string | null>(null);
	const [activeFreeformTool, setActiveFreeformTool] = useState<FreeformToolKind | null>(null);
	const enterEditPoints = useCallback((id: string | null) => {
		setEditPointsElementId(id);
		if (id) {
			setActiveFreeformTool(null);
		}
	}, []);
	const armFreeformTool = useCallback((tool: FreeformToolKind | null) => {
		setActiveFreeformTool(tool);
		if (tool) {
			setEditPointsElementId(null);
		}
	}, []);
	return {
		editPointsElementId,
		setEditPointsElementId: enterEditPoints,
		activeFreeformTool,
		setActiveFreeformTool: armFreeformTool,
	};
}
