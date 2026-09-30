/**
 * `animation-motion-path-chain` - chained (`p:animMotion` sequence) motion
 * paths: merging same-target path segments and playing them as ONE continuous
 * choreography.
 *
 * PowerPoint decks frequently express one continuous journey (a crane picking
 * an object up, carrying it across, and setting it down) as SEVERAL
 * `presetClass: "path"` effects on the SAME shape, timed back-to-back inside
 * one sequence (each with its own effect-wrapper offset via
 * `parGroupDelayMs`). All segments share ONE reference frame: slide-fraction
 * offsets from the shape's own layout position (`pathEditMode="relative"`,
 * `origin="layout"`), which is exactly the frame a CSS `translate()` applied
 * to that shape speaks.
 *
 * Played naively as separate per-segment CSS animations the journey breaks in
 * two ways:
 * 1. The playback engine keeps one CSS animation per element (later steps
 *    replace earlier ones in its element-state map), so only the LAST
 *    segment's keyframes ever attach.
 * 2. With `animation-fill-mode: both` (the `path` default) that last
 *    segment's 0% frame shows during its whole `animation-delay`, so the
 *    shape teleports to that segment's start offset the moment the click
 *    fires and sits there frozen.
 *
 * The fix here merges each run of same-target path segments into a single
 * synthetic animation whose keyframes cover the whole journey: waypoints land
 * at their AUTHORED time positions (each segment keeps its own duration and
 * accel/decel easing), and the 0% frame is the first segment's own start
 * offset - which deck authors place at the shape's resting spot, so the
 * pre-delay freeze shows the shape standing still, as authored, instead of
 * teleporting.
 *
 * @module render/animation-motion-path-chain
 */
import type { PptxNativeAnimation } from 'pptx-viewer-core';

import { resolveAnimationStart } from './animation-advanced-triggers';
import { cssEasingForAccelDecel } from './animation-easing';
import { parseMotionPathPoints } from './animation-motion-path';
import type { MotionPoint } from './animation-motion-path';
import { resolveAnimationTargetId } from './animation-target-id';

export { buildChainedMotionKeyframes } from './animation-motion-chain-keyframes';

/** One authored path segment inside a merged chain, in authored time. */
export interface ChainedMotionSegment {
	/** Parsed waypoints, in the shared slide-fraction offset frame. */
	points: MotionPoint[];
	/** Authored start offset (ms) from the chain window's start. */
	startMs: number;
	/** Authored active duration (ms) of this segment. */
	durationMs: number;
	/** CSS timing function for this segment (from its authored accel/decel). */
	easing: string;
}

/** A synthetic path animation carrying its merged segment breakdown. */
export interface ChainedMotionAnimation extends PptxNativeAnimation {
	/** Segment breakdown consumed by `buildChainedMotionKeyframes`. Render-only. */
	motionChain?: ChainedMotionSegment[];
	/** True for the members a merge consumed into a chain head. */
	motionChainSwallowed?: boolean;
	/**
	 * True when the same sequence holds an authored EXIT for this element at
	 * (or before) the chain start: the element is hidden by that exit and must
	 * stay hidden (via the chain keyframes' leading `opacity: 0`) until the
	 * journey's own start, then pop in exactly as the first segment begins.
	 */
	motionChainHideUntilStart?: boolean;
}

export function isChainedMotionAnimation(
	anim: PptxNativeAnimation,
): anim is ChainedMotionAnimation {
	return (anim as ChainedMotionAnimation).motionChain !== undefined;
}

export function isChainedMotionSwallowed(anim: PptxNativeAnimation): boolean {
	return (anim as ChainedMotionAnimation).motionChainSwallowed === true;
}

/**
 * Extras the chain keyframes cannot reproduce. A segment carrying any of them
 * keeps its standalone step (and blocks any run it would belong to).
 */
function hasChainBlockingExtras(anim: PptxNativeAnimation): boolean {
	return Boolean(
		anim.rotationBy !== undefined ||
		anim.rotationFrom !== undefined ||
		anim.rotationTo !== undefined ||
		anim.scaleByX !== undefined ||
		anim.scaleByY !== undefined ||
		anim.scaleFromX !== undefined ||
		anim.scaleFromY !== undefined ||
		anim.scaleToX !== undefined ||
		anim.scaleToY !== undefined ||
		anim.colorAnimation ||
		anim.attributeAnimations?.length ||
		anim.setAnimations?.length ||
		anim.repeatCount !== undefined ||
		anim.repeatDurMs !== undefined ||
		anim.autoReverse ||
		anim.graphicBuildProperties ||
		anim.iterate ||
		anim.speedPct !== undefined ||
		anim.afterAnimationAction ||
		anim.startConditions?.some(
			(condition) =>
				condition.targetTimeNodeId !== undefined ||
				(condition.event !== undefined &&
					condition.event !== 'onClick' &&
					condition.event !== 'onMouseOver'),
		),
	);
}

function authoredStartMs(anim: PptxNativeAnimation): number {
	return (anim.parGroupDelayMs ?? 0) + Math.max(anim.delayMs ?? 0, anim.triggerDelayMs ?? 0);
}

/**
 * Merge same-target path animations into chained synthetic animations,
 * preserving array order and leaving swallowed members in place (flagged) so
 * callers can skip them without disturbing their own prevStep bookkeeping.
 *
 * A run qualifies when every member:
 *
 * - is `presetClass: "path"` with an actual `motionPath`,
 * - resolves to the same element id,
 * - carries an absolute effect-wrapper offset (`parGroupDelayMs`), so removal
 *   cannot disturb the prevStep delay chaining other animations rely on,
 * - carries none of the extras the chain keyframes cannot reproduce,
 * - and (except for the run's head) is NOT `onClick`-triggered, so a chain
 *   can never collapse two click groups into one.
 *
 * Segments carrying animation SOUNDS still merge: their motion is consumed
 * into the chain, and the builder emits each swallowed member's sound as a
 * sound-only timeline step timed at the segment's own start, so the crane's
 * move / drop cues keep firing at the authored moments.
 *
 * Runs need not be adjacent in the array (decks interleave other shapes'
 * effects between one shape's segments); members are ordered by their
 * authored wrapper offsets inside the run. Gaps between segments are fine -
 * the keyframes hold the last reached position across them.
 */
export function mergeChainedMotionPathAnims(
	anims: readonly PptxNativeAnimation[],
): PptxNativeAnimation[] {
	interface Candidate {
		index: number;
		anim: PptxNativeAnimation;
		startMs: number;
		endMs: number;
	}

	const candidates = new Map<string, Candidate[]>();
	let clickGroup = 0;
	const clickGroups: number[] = [];

	for (let index = 0; index < anims.length; index++) {
		const anim = anims[index];
		if (resolveAnimationStart(anim).trigger === 'onClick') {
			clickGroup++;
		}
		clickGroups[index] = clickGroup;
		if (
			anim.presetClass !== 'path' ||
			!anim.motionPath ||
			anim.parGroupIndex === undefined ||
			!Number.isFinite(anim.parGroupDelayMs) ||
			!Number.isFinite(anim.durationMs) ||
			(anim.durationMs ?? 0) <= 0
		) {
			continue;
		}
		if (hasChainBlockingExtras(anim)) {
			continue;
		}
		const targetId = resolveAnimationTargetId(anim);
		if (!targetId) {
			continue;
		}
		const startMs = authoredStartMs(anim);
		const candidateKey = JSON.stringify([
			clickGroup,
			anim.triggerShapeId,
			targetId,
			anim.motionOrigin,
		]);
		const run = candidates.get(candidateKey) ?? [];
		run.push({ index, anim, startMs, endMs: startMs + (anim.durationMs ?? 0) });
		candidates.set(candidateKey, run);
	}

	const swallowedIndices = new Set<number>();
	const replacements = new Map<number, ChainedMotionAnimation>();

	for (const [, run] of candidates) {
		if (run.length < 2) {
			continue;
		}
		const ordered = [...run].sort((left, right) => left.startMs - right.startMs);
		// Never collapse click boundaries: only the run's head may be
		// onClick-triggered (later onClick members start their own groups).
		if (ordered.slice(1).some((member) => member.anim.trigger === 'onClick')) {
			continue;
		}

		if (ordered.some((member, i) => i > 0 && member.startMs < ordered[i - 1].endMs)) {
			continue;
		}

		const segments: ChainedMotionSegment[] = [];
		const points: MotionPoint[] = [];
		const windowStartMs = ordered[0].startMs;
		let windowEndMs = ordered[0].endMs;
		let viable = true;

		for (const member of ordered) {
			const segmentPoints = parseMotionPathPoints(member.anim.motionPath ?? '');
			if (segmentPoints.length < 2) {
				viable = false;
				break;
			}
			points.push(...segmentPoints);
			segments.push({
				points: segmentPoints,
				startMs: member.startMs - windowStartMs,
				durationMs: member.anim.durationMs ?? 0,
				easing: cssEasingForAccelDecel(member.anim.accel, member.anim.decel),
			});
			windowEndMs = Math.max(windowEndMs, member.endMs);
		}
		if (!viable) {
			continue;
		}

		const head = ordered[0];
		const windowStartMsAbs = windowStartMs;
		// An authored EXIT on this element at/before the chain start (the deck's
		// way of parking a rope above the slide invisibly) means the element
		// must stay hidden until the journey's own first segment begins.
		const hasPreChainExit = anims.some(
			(other, index) =>
				index < head.index &&
				clickGroups[index] === clickGroups[head.index] &&
				other !== head.anim &&
				other.presetClass === 'exit' &&
				resolveAnimationTargetId(other) === resolveAnimationTargetId(head.anim) &&
				authoredStartMs(other) + (other.durationMs ?? 0) <= windowStartMsAbs,
		);
		const synthetic: ChainedMotionAnimation = {
			...head.anim,
			motionPath: pointsToPathString(points),
			// The window includes any authored gaps between segments.
			durationMs: Math.max(1, windowEndMs - windowStartMs),
			motionChain: segments,
			motionChainHideUntilStart: hasPreChainExit,
		};
		replacements.set(head.index, synthetic);
		for (const member of ordered.slice(1)) {
			swallowedIndices.add(member.index);
		}
	}

	if (replacements.size === 0) {
		return [...anims];
	}

	return anims.map((anim, index) => {
		if (swallowedIndices.has(index)) {
			return { ...anim, motionChainSwallowed: true } as ChainedMotionAnimation;
		}
		return replacements.get(index) ?? anim;
	});
}

/** Serialize waypoints back to an `M`/`L` path string in slide-fraction units. */
function pointsToPathString(points: readonly MotionPoint[]): string {
	return points
		.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x / 100} ${point.y / 100} `)
		.join('');
}
