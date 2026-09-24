/**
 * `animation-timeline-text-build-pieces`: the per-letter / per-word split
 * used by text-build expansion (`animation-timeline-text-build`), plus the
 * segment-count type and composite-id separator both modules share. Split out
 * to keep each module under the repo's file-size guideline.
 *
 * @module render/animation-timeline-text-build-pieces
 */

import type { PptxNativeAnimation } from 'pptx-viewer-core';

/** Paragraph / word / character counts used to expand text-build animations. */
export interface TextBuildSegmentCounts {
	/** Number of paragraphs in the text body. */
	paragraphCount: number;
	/** Number of words per paragraph (undefined when not needed). */
	wordCounts?: number[];
	/** Number of characters per paragraph (undefined when not needed). */
	charCounts?: number[];
	/**
	 * 0-based outline level per paragraph (`a:p/@lvl`, `TextSegment.paragraphLevel`),
	 * used by a `bldLvl`-aware "by paragraph" build to decide which paragraphs
	 * open their own click step. Absent entries default to level 0.
	 */
	paragraphLevels?: number[];
}

/**
 * Separator used between element ID and sub-element identifier
 * in composite animation target IDs (e.g. `"shape3::p0"`).
 */
export const TEXT_BUILD_ID_SEP = '::';

/**
 * Stagger (ms) between consecutive sub-elements of an `p:iterate` build.
 *
 * `p:tmAbs` is already milliseconds; `p:tmPct` is a percentage of the effect's
 * own duration in 1000ths of a percent (PowerPoint's default is `10000`, i.e.
 * 10%). A ZERO interval is meaningful: PowerPoint plays "by letter" with a 0%
 * delay as all letters simultaneously, so `0` must be returned as `0` (every
 * piece starts together), NOT collapsed to `undefined`. Falling through to the
 * `undefined` sequential fallback chained each letter after the previous one's
 * full duration, turning an instant reveal into a multi-second crawl that also
 * pushed every later effect in the group tens of seconds out (issue #132).
 * Returns `undefined` only when the animation is not iterate-driven at all, so
 * the caller keeps the slide-build defaults.
 */
function iterateStaggerMs(anim: PptxNativeAnimation, durationMs: number): number | undefined {
	const iterate = anim.iterate;
	if (!iterate || iterate.type === 'el') {
		return undefined;
	}
	if (typeof iterate.tmAbs === 'number' && Number.isFinite(iterate.tmAbs) && iterate.tmAbs >= 0) {
		return iterate.tmAbs;
	}
	if (typeof iterate.tmPct === 'number' && Number.isFinite(iterate.tmPct) && iterate.tmPct >= 0) {
		if (iterate.tmPct === 0) {
			return 0;
		}
		return Math.max(1, Math.round((iterate.tmPct / 100000) * durationMs));
	}
	return undefined;
}

/** A `<baseId>::p<N>` paragraph-scoped target id, split into its parts. */
export interface ParagraphScopedTarget {
	baseId: string;
	paragraph: number;
}

/** Parse a paragraph-scoped composite target id (`shape3::p1`), if it is one. */
export function parseParagraphScopedTarget(targetId: string): ParagraphScopedTarget | undefined {
	const at = targetId.lastIndexOf(`${TEXT_BUILD_ID_SEP}p`);
	if (at < 0) {
		return undefined;
	}
	const paragraph = Number(targetId.slice(at + TEXT_BUILD_ID_SEP.length + 1));
	if (!Number.isInteger(paragraph) || paragraph < 0) {
		return undefined;
	}
	return { baseId: targetId.slice(0, at), paragraph };
}

/**
 * The within-paragraph granularity an effect's own `p:iterate` asks for, or
 * `undefined` when it animates the text as one object (`type="el"`, or absent).
 *
 * This is INDEPENDENT of `p:bldP/@build`: the slide build says how the text is
 * grouped into steps ("by paragraph"), while `p:iterate` says how each step is
 * subdivided in time ("by letter"). PowerPoint composes the two; reading only
 * the build type made a by-paragraph credit line authored to ripple in letter by
 * letter appear as one solid block (issue #106).
 */
export function iterateGranularity(
	anim: Pick<PptxNativeAnimation, 'iterate'>,
): 'byChar' | 'byWord' | undefined {
	if (anim.iterate?.type === 'lt') {
		return 'byChar';
	}
	if (anim.iterate?.type === 'wd') {
		return 'byWord';
	}
	return undefined;
}

/** Per-piece sub-element id prefix and per-paragraph piece count for a split. */
function pieceCounts(
	kind: 'byChar' | 'byWord',
	counts: TextBuildSegmentCounts,
): { token: 'c' | 'w'; perParagraph: number[] } {
	return kind === 'byChar'
		? { token: 'c', perParagraph: counts.charCounts ?? [] }
		: { token: 'w', perParagraph: counts.wordCounts ?? [] };
}

/**
 * Emit one staggered sub-animation per letter / word.
 *
 * An `p:iterate` build overlaps: every piece runs the FULL effect duration and
 * merely starts `stagger` later than the one before, which is what makes
 * PowerPoint's "by letter" read as a ripple. `withPrevious` steps accumulate
 * their delay from the previous step's START, so passing the bare interval as
 * each step's delay yields `base + i * stagger`. The slide-build (`p:bldP`) path
 * keeps its original end-to-end pacing.
 *
 * `newClickStepPerParagraph` reproduces a by-paragraph build: paragraph 0 starts
 * with the parent effect, and every later paragraph waits for its own click,
 * with its pieces rippling from there.
 */
export function emitStaggeredPieces(
	anim: PptxNativeAnimation,
	kind: 'byChar' | 'byWord',
	counts: TextBuildSegmentCounts,
	output: PptxNativeAnimation[],
	newClickStepPerParagraph: boolean,
	onlyParagraph?: ParagraphScopedTarget,
): void {
	const targetId = onlyParagraph?.baseId ?? anim.targetId ?? '';
	const baseDuration = anim.durationMs ?? 500;
	const stagger = iterateStaggerMs(anim, baseDuration);
	const { token, perParagraph } = pieceCounts(kind, counts);
	const fallbackDuration =
		kind === 'byChar'
			? Math.max(50, Math.round(baseDuration / 4))
			: Math.max(100, Math.round(baseDuration / 2));
	const fallbackStagger = kind === 'byChar' ? 20 : 50;

	// `p:iterate/@backwards` reverses the REVEAL order within each paragraph
	// (last letter/word first) while each synthesized step keeps targeting its
	// original piece index, so the correct glyph still animates.
	const backwards = anim.iterate?.backwards === true;
	let stepIndex = 0;
	for (let pIdx = 0; pIdx < counts.paragraphCount; pIdx++) {
		if (onlyParagraph && pIdx !== onlyParagraph.paragraph) {
			continue;
		}
		const pieces = perParagraph[pIdx] ?? 0;
		for (let step = 0; step < pieces; step++) {
			const i = backwards ? pieces - 1 - step : step;
			const opensParagraph = step === 0;
			const isFirstStep = stepIndex === 0;
			const startsClickStep = newClickStepPerParagraph && opensParagraph && !isFirstStep;
			output.push({
				...anim,
				targetId: `${targetId}${TEXT_BUILD_ID_SEP}${token}${pIdx}-${i}`,
				trigger: isFirstStep
					? anim.trigger
					: startsClickStep
						? 'onClick'
						: stagger !== undefined
							? 'withPrevious'
							: 'afterPrevious',
				durationMs: stagger !== undefined ? baseDuration : fallbackDuration,
				delayMs: isFirstStep
					? (anim.delayMs ?? 0)
					: startsClickStep
						? 0
						: (stagger ?? fallbackStagger),
				// Only the first sub-step inherits the parent's start delay; the
				// rest carry the bare stagger, so these must not re-apply it.
				// They are synthetic chain steps rather than OOXML `p:par`
				// siblings, so they also drop the wrapper index: their delay is
				// an interval off the step before, not an offset from the group.
				...(isFirstStep
					? {}
					: {
							triggerDelayMs: undefined,
							startConditions: undefined,
							parGroupIndex: undefined,
							parGroupDelayMs: undefined,
						}),
				buildType: undefined,
				iterate: undefined,
			});
			stepIndex++;
		}
	}
}
