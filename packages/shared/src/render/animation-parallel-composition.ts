import { getEffectKeyframes } from './animation-keyframes';
import type { EffectName, TimelineStep } from './animation-timeline-types';

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

// ===========================================================================
// Which CSS properties a step's keyframes animate.
//
// A click group can hold SEVERAL steps for one element (a motion 0-2s and its
// exit 2-2.5s, say), each with its own delay. CSS plays a comma-joined
// animation list side by side, so such steps can coexist on the element  -  but
// ONLY when they animate disjoint properties: two animations touching the same
// property resolve in list order, and a later one's `fill: both` from-frame
// would pin the property through the earlier one's whole active window (the
// freeze/teleport the chained-journey merge exists to prevent). The playback
// engine joins exactly the disjoint pairs and keeps the historical
// last-write-wins for the rest.
// ===========================================================================

const TRANSFORM_KEYFRAME_NAME = /^pptx-(?:tl-)?(?:motion|rotate(?:Abs)?|scale(?:Abs)?|transform)-/u;
const COLOR_KEYFRAME_NAME = /^pptx-(?:tl-)?(?:color|tavclr)-/u;
const FILTER_KEYFRAME_NAME = /^pptx-(?:tl-)?emph-/u;

const animatedPropertyCache = new Map<string, Set<string>>();

/** Properties ("transform" / "opacity" / "color" / "filter" / "unknown") a keyframe animates. */
export function keyframeAnimatedProperties(keyframeName: string): Set<string> {
	let props = animatedPropertyCache.get(keyframeName);
	if (props) {
		return props;
	}
	props = new Set();
	if (TRANSFORM_KEYFRAME_NAME.test(keyframeName)) {
		props.add('transform');
		if (keyframeName.endsWith('-visibility')) {
			props.add('opacity');
		}
	} else if (COLOR_KEYFRAME_NAME.test(keyframeName)) {
		props.add('color');
	} else if (FILTER_KEYFRAME_NAME.test(keyframeName)) {
		props.add('filter');
	} else {
		// Static preset keyframes are registered unprefixed
		// (`cssKeyframeName` prepends `pptx-` when a step is built).
		const css = getEffectKeyframes(keyframeName.replace(/^pptx-/u, '') as EffectName);
		if (css) {
			// The `[^-]` guard keeps `stroke-opacity` from reading as `opacity`.
			if (/(?:^|[^-])\btransform\s*:/u.test(css)) {
				props.add('transform');
			}
			if (/(?:^|[^-])\bopacity\s*:/u.test(css)) {
				props.add('opacity');
			}
			if (/(?:^|[^-])\bfilter\s*:/u.test(css)) {
				props.add('filter');
			}
			if (/(?:^|[^-])\b(?:color|fill|stroke)\s*:/u.test(css)) {
				props.add('color');
			}
		} else {
			// An unrecognised name: claim EVERY property so callers never join
			// against something they cannot reason about.
			props.add('unknown');
		}
	}
	if (!/^pptx-(?:tl-)?(?:motion|rotate|scale|transform|color|tavclr|emph)-/u.test(keyframeName)) {
		animatedPropertyCache.set(keyframeName, props);
	}
	return props;
}
