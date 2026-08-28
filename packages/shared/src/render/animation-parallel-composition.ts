import type { TimelineStep } from './animation-timeline-types';

const COLOR_KEYFRAME = /^pptx-tl-(?:color|tavclr)-/u;
const TRANSFORM_KEYFRAME = /^pptx-tl-(?:motion|rotate(?:Abs)?|scale(?:Abs)?|transform)-/u;

function sameOptionalValue<T>(left: T | undefined, right: T | undefined): boolean {
	return left === right;
}

function hasIndependentColourAndTransform(left: TimelineStep, right: TimelineStep): boolean {
	return (
		(COLOR_KEYFRAME.test(left.keyframeName) && TRANSFORM_KEYFRAME.test(right.keyframeName)) ||
		(TRANSFORM_KEYFRAME.test(left.keyframeName) && COLOR_KEYFRAME.test(right.keyframeName))
	);
}

/** Whether two sibling behaviours can safely share one CSS animation list. */
export function canComposeParallelSteps(left: TimelineStep, right: TimelineStep): boolean {
	return (
		hasIndependentColourAndTransform(left, right) &&
		left.elementId !== '' &&
		left.elementId === right.elementId &&
		left.cssAnimation !== '' &&
		right.cssAnimation !== '' &&
		left.delayMs === right.delayMs &&
		left.durationMs === right.durationMs &&
		left.presetClass === right.presetClass &&
		left.fillMode === right.fillMode &&
		sameOptionalValue(left.holdEndState, right.holdEndState) &&
		sameOptionalValue(left.hideAfterEffect, right.hideAfterEffect) &&
		sameOptionalValue(left.pendingHideOnNextClick, right.pendingHideOnNextClick) &&
		sameOptionalValue(left.seqConcurrent, right.seqConcurrent) &&
		sameOptionalValue(left.seqNextAction, right.seqNextAction) &&
		sameOptionalValue(left.seqPrevAction, right.seqPrevAction) &&
		!left.command &&
		!right.command &&
		!left.build &&
		!right.build &&
		!left.soundPath &&
		!right.soundPath &&
		!left.stopSound &&
		!right.stopSound &&
		!left.restart &&
		!right.restart &&
		left.exclGroupId === undefined &&
		right.exclGroupId === undefined
	);
}

/** Compose independent CSS properties without dropping either behaviour. */
export function composeParallelSteps(left: TimelineStep, right: TimelineStep): TimelineStep {
	const colorTargets = [...new Set([...(left.colorTargets ?? []), ...(right.colorTargets ?? [])])];
	return {
		...left,
		cssAnimation: `${left.cssAnimation}, ${right.cssAnimation}`,
		colorTargets: colorTargets.length > 0 ? colorTargets : undefined,
	};
}
