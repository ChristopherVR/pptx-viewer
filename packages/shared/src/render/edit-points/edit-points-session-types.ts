/**
 * Types and helpers of `EditPointsSession`: the event inputs a binding
 * forwards, the session options, the in-flight drag state and the element
 * fingerprint used to tell the session's own commits from outside changes.
 *
 * @module render/edit-points/edit-points-session-types
 */
import type { EditPointsElementPatch } from './edit-points-export';
import type { EditPointsCommandId } from './edit-points-menu';
import type { EditGeometry, EditHandleRef, EditNodeRef, EditSegmentRef } from './edit-points-types';

/** A pointer event forwarded by a binding. */
export interface EditPointsPointerInput {
	/** Pointer position in slide pixels. */
	x: number;
	y: number;
	/** The hit shape's target id (`data-pptx-edit-points-target`), if any. */
	target?: string | null;
	button?: number;
	ctrlKey?: boolean;
	metaKey?: boolean;
}

/** A context-menu event forwarded by a binding. */
export interface EditPointsContextMenuInput extends EditPointsPointerInput {
	clientX: number;
	clientY: number;
}

export interface EditPointsSessionOptions {
	/** Apply an edit to the element (one undo step per call). */
	onCommit: (patch: EditPointsElementPatch) => void;
	/** The session ended (Escape, click away, Exit Edit Points). */
	onExit: () => void;
	/** The view changed; re-render. */
	onChange?: () => void;
	/** Menu commands the host hid. */
	hiddenCommands?: ReadonlySet<EditPointsCommandId>;
}

export interface DragBase {
	origin: EditGeometry;
	/** Press position (slide px), to tell a click from a drag. */
	startX: number;
	startY: number;
	moved: boolean;
}

export type EditPointsDrag =
	| (DragBase & { kind: 'node'; ref: EditNodeRef })
	| (DragBase & { kind: 'handle'; ref: EditHandleRef })
	| (DragBase & { kind: 'segment'; ref: EditSegmentRef; t: number });

/** Pointer travel (slide px) below which a press is a click, not a drag. */
export const EDIT_POINTS_DRAG_THRESHOLD_PX = 1;

function round(value: number | undefined): string {
	return String(Math.round((value ?? 0) * 2) / 2);
}

/** A cheap fingerprint of the geometry-bearing fields of an element. */
export function editPointsElementSignature(element: {
	x: number;
	y: number;
	width: number;
	height: number;
	shapeType?: string;
	pathData?: string;
	shapeAdjustments?: Record<string, number>;
}): string {
	return [
		element.shapeType ?? '',
		element.pathData ?? '',
		JSON.stringify(element.shapeAdjustments ?? {}),
		round(element.x),
		round(element.y),
		round(element.width),
		round(element.height),
	].join('|');
}
