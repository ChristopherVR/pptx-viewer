import type { PptxSlide, ShapePptxElement } from 'pptx-viewer-core';
import type {
	EditPointsCommandId,
	EditPointsElementPatch,
	FreeformToolKind,
} from 'pptx-viewer-shared';
import { canEditElementPoints } from 'pptx-viewer-shared';
import type React from 'react';
import { useEffect } from 'react';

import { EditPointsOverlay } from './EditPointsOverlay';
import { FreeformToolOverlay } from './FreeformToolOverlay';

/** Wiring for Edit Points and the Freeform: Shape / Curve tools. */
export interface OutlineAuthoringProps {
	/** The shape in Edit Points mode, or null. */
	editPointsElementId: string | null;
	/** Edit Points menu commands the host hid. */
	hiddenEditPointsCommands?: ReadonlySet<EditPointsCommandId>;
	/** Apply one Edit Points edit (one undo step). */
	onCommitEditPoints: (elementId: string, patch: EditPointsElementPatch) => void;
	onExitEditPoints: () => void;
	/** The armed drawing tool, or null. */
	freeformTool: FreeformToolKind | null;
	/** Insert a drawn freeform (the tool then disarms). */
	onFreeformCommit: (element: ShapePptxElement) => void;
	onFreeformCancel: () => void;
}

export interface OutlineAuthoringLayerProps extends OutlineAuthoringProps {
	activeSlide: PptxSlide | undefined;
	canvasSize: { width: number; height: number };
	scale: number;
}

/**
 * Stage-level host of the two outline-authoring overlays. Leaves Edit Points
 * when its shape disappears (deleted, slide changed) or becomes locked.
 */
export function OutlineAuthoringLayer({
	activeSlide,
	canvasSize,
	scale,
	editPointsElementId,
	hiddenEditPointsCommands,
	onCommitEditPoints,
	onExitEditPoints,
	freeformTool,
	onFreeformCommit,
	onFreeformCancel,
}: OutlineAuthoringLayerProps): React.ReactElement | null {
	const element = editPointsElementId
		? activeSlide?.elements.find((candidate) => candidate.id === editPointsElementId)
		: undefined;
	const editable = Boolean(element && canEditElementPoints(element));

	useEffect(() => {
		if (editPointsElementId && !editable) {
			onExitEditPoints();
		}
	}, [editPointsElementId, editable, onExitEditPoints]);

	if (freeformTool) {
		return (
			<FreeformToolOverlay
				tool={freeformTool}
				canvasSize={canvasSize}
				scale={scale}
				onCommit={onFreeformCommit}
				onCancel={onFreeformCancel}
			/>
		);
	}
	if (element && editable) {
		return (
			<EditPointsOverlay
				element={element}
				canvasSize={canvasSize}
				scale={scale}
				hiddenCommands={hiddenEditPointsCommands}
				onCommit={onCommitEditPoints}
				onExit={onExitEditPoints}
			/>
		);
	}
	return null;
}
