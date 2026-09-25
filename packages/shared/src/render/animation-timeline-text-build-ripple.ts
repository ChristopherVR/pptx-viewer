/**
 * `animation-timeline-text-build-ripple`: the per-letter / per-word ripple of
 * ONE click step of a "By paragraph" text build whose effect also carries
 * `p:iterate type="lt" | "wd"` (Effect Options > Animate text: By letter / By
 * word), split out of `animation-timeline-text-build` to keep each module
 * under the repo's file-size guideline.
 *
 * PowerPoint ground truth (CreateVideo captures of Fade, 1 s, tmPct 10%):
 * - every letter plays the FULL effect duration and starts one interval after
 *   the previous letter of its own paragraph, so a 6-letter step lasts
 *   `dur + 5 * interval` (1000 + 5 * 100 = 1500 ms);
 * - a sub-level paragraph grouped into the step by `p:bldP/@bldLvl` ripples
 *   IN PARALLEL with its opener (both first letters at the step start),
 *   instead of continuing the opener's ripple;
 * - `p:iterate/@backwards` reverses the letters within each paragraph only.
 *
 * @module render/animation-timeline-text-build-ripple
 */

import type { PptxNativeAnimation } from 'pptx-viewer-core';

import {
	fallbackPiecePacing,
	iterateStaggerMs,
	pieceCounts,
	TEXT_BUILD_ID_SEP,
} from './animation-timeline-text-build-pieces';
import type { TextBuildSegmentCounts } from './animation-timeline-text-build-pieces';

/** How the first step of a by-paragraph build group starts. */
export type RippleGroupHead = Pick<
	PptxNativeAnimation,
	'trigger' | 'triggerDelayMs' | 'delayMs' | 'startConditions' | 'parGroupIndex' | 'parGroupDelayMs'
>;

/** Build-level fields a synthesized piece must not carry forward. */
const CLEARED_BUILD_FIELDS = {
	buildType: undefined,
	buildReverse: undefined,
	buildAdvAutoMs: undefined,
	buildLevel: undefined,
	iterate: undefined,
} as const;

interface RipplePiece {
	paragraph: number;
	piece: number;
	offsetMs: number;
}

/**
 * Emit one click step (a `bldLvl` paragraph group) of a by-paragraph build as
 * staggered per-letter / per-word sub-animations.
 *
 * Every member paragraph's ripple starts at the step start; the pieces are
 * then ordered by start offset and chained as `withPrevious` steps whose delay
 * is the gap from the previous piece's start (the scheduler measures a
 * `withPrevious` delay from the previous step's START). The first piece
 * carries `head`, which decides whether the step waits for a click, follows
 * the previous effect, or starts after an `advAuto` delay.
 *
 * A group without any piece (only empty paragraphs) still emits one
 * paragraph-scoped step, so the click count matches PowerPoint's.
 */
export function emitParagraphGroupRipple(
	anim: PptxNativeAnimation,
	kind: 'byChar' | 'byWord',
	counts: TextBuildSegmentCounts,
	members: readonly number[],
	head: RippleGroupHead,
	output: PptxNativeAnimation[],
): void {
	const targetId = anim.targetId ?? '';
	const baseDuration = anim.durationMs ?? 500;
	const stagger = iterateStaggerMs(anim, baseDuration);
	const fallback = fallbackPiecePacing(kind, baseDuration);
	// With no authored interval the pieces chain end to end (duration + gap).
	const intervalMs = stagger ?? fallback.durationMs + fallback.staggerMs;
	const durationMs = stagger !== undefined ? baseDuration : fallback.durationMs;
	const { token, perParagraph } = pieceCounts(kind, counts);
	const backwards = anim.iterate?.backwards === true;

	const pieces: RipplePiece[] = [];
	for (const paragraph of members) {
		const n = perParagraph[paragraph] ?? 0;
		for (let step = 0; step < n; step++) {
			pieces.push({
				paragraph,
				piece: backwards ? n - 1 - step : step,
				offsetMs: step * intervalMs,
			});
		}
	}
	// Stable: equal offsets keep document (member) order.
	pieces.sort((a, b) => a.offsetMs - b.offsetMs);

	if (pieces.length === 0) {
		output.push({
			...anim,
			...head,
			...CLEARED_BUILD_FIELDS,
			targetId: `${targetId}${TEXT_BUILD_ID_SEP}p${members[0] ?? 0}`,
		});
		return;
	}

	let previousOffset = 0;
	pieces.forEach((entry, index) => {
		const timing: RippleGroupHead =
			index === 0
				? head
				: {
						trigger: 'withPrevious',
						delayMs: entry.offsetMs - previousOffset,
						triggerDelayMs: undefined,
						startConditions: undefined,
						parGroupIndex: undefined,
						parGroupDelayMs: undefined,
					};
		output.push({
			...anim,
			...timing,
			...CLEARED_BUILD_FIELDS,
			targetId: `${targetId}${TEXT_BUILD_ID_SEP}${token}${entry.paragraph}-${entry.piece}`,
			durationMs,
		});
		previousOffset = entry.offsetMs;
	});
}
