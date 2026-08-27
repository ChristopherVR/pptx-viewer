import type {
	PptxElementAnimation,
	PptxAfterAnimationAction,
	PptxAnimationDirection,
	PptxAnimationTimelineAnchor,
} from 'pptx-viewer-core';
import type { AnimationTimelineRow, EffectSoundState } from 'pptx-viewer-shared';
import type React from 'react';

// ---------------------------------------------------------------------------
// Hook argument types
// ---------------------------------------------------------------------------

export interface UseAnimationHandlersArgs {
	selectedElement: { id: string } & Record<string, unknown>;
	activeSlide: {
		animations?: PptxElementAnimation[];
		/** Read-only anchors for the deck's own effect groups, see {@link PptxAnimationTimelineAnchor}. */
		animationTimelineAnchors?: PptxAnimationTimelineAnchor[];
		elements?: Array<{ id: string } & Record<string, unknown>>;
	};
	canEdit: boolean;
	onUpdateSlide: (updates: { animations?: PptxElementAnimation[] }) => void;
}

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface AnimationHandlers {
	selectedElementAnimation: PptxElementAnimation | undefined;
	sortedAnimations: PptxElementAnimation[];
	/**
	 * The full drag-to-reorder timeline: editor-authored animations MERGED
	 * with read-only anchors for the deck's own effect groups, sorted by
	 * `order`. Dragging an editor row to any index here (including past a
	 * native row) is how an effect can be sequenced ahead of or behind an
	 * effect the deck already had.
	 */
	timelineRows: AnimationTimelineRow[];
	hasAnimation: boolean;
	showDirectionPicker: boolean;
	dragIndex: number | null;
	dragOverIndex: number | null;
	timelineBarData: Array<{
		anim: PptxElementAnimation;
		leftPercent: number;
		widthPercent: number;
	}>;
	handleEntranceChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
	handleExitChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
	handleEmphasisChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
	handleTriggerChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
	handleTriggerShapeChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
	handleTimingCurveChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
	handleDurationChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
	handleDelayChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
	handleRepeatCountChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
	handleRepeatModeChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
	handleDirectionChange: (dir: PptxAnimationDirection) => void;
	handleSequenceChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
	handlePreviewClick: () => void;
	handleAnimationHover: (anim: PptxElementAnimation) => void;
	handleAnimationHoverEnd: () => void;
	handleDragStart: (index: number, event: React.DragEvent) => void;
	handleDragOver: (index: number, event: React.DragEvent) => void;
	handleDragEnter: (index: number) => void;
	handleDragLeave: () => void;
	handleDrop: (targetIndex: number, event: React.DragEvent) => void;
	handleDragEnd: () => void;
	handleMoveUp: (animIndex: number) => void;
	handleMoveDown: (animIndex: number) => void;
	effectSoundState: EffectSoundState;
	handleEffectSoundPick: (pick: { dataUrl: string; fileName?: string } | undefined) => void;
	handleAfterAnimationChange: (action: PptxAfterAnimationAction) => void;
	handleAfterAnimationColorChange: (color: string) => void;
	getTimelineLabel: (anim: PptxElementAnimation) => string;
	/** Label for a read-only native row from the target element ids its effects reach. */
	getNativeRowLabel: (targetIds: string[]) => string;
}

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

export { DIRECTIONAL_PRESETS } from 'pptx-viewer-shared';

// ---------------------------------------------------------------------------
// Shared callback type used by sub-hooks
// ---------------------------------------------------------------------------

export type AnimationUpdater = (
	updater: (anims: PptxElementAnimation[]) => PptxElementAnimation[],
) => void;
