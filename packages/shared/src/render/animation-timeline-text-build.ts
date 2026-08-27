/**
 * `animation-timeline-text-build` — pure expansion of text-build animations
 * (by-paragraph / by-word / by-char) into staggered per-segment sub-animations.
 *
 * @module render/animation-timeline-text-build
 */

import type { PptxNativeAnimation, PptxTextBuildType } from 'pptx-viewer-core';

import { DEFAULT_BUILD_LEVEL, groupParagraphsByBuildLevel } from './animation-timeline-build-level';

// ==========================================================================
// Text-build segment counts
// ==========================================================================

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
 * Count paragraphs, words and characters from an element's text segments.
 * Paragraph boundaries are segments whose text is exactly `"\n"`. A
 * paragraph's outline level comes from its first segment's
 * `paragraphLevel` (mirroring the `bulletInfo` convention), defaulting to 0.
 */
export function countTextSegments(
	textSegments: ReadonlyArray<{ text: string; paragraphLevel?: number }>,
): TextBuildSegmentCounts {
	const paragraphs: string[] = [''];
	const paragraphLevels: number[] = [];
	let atParagraphStart = true;
	for (const seg of textSegments) {
		if (atParagraphStart) {
			paragraphLevels.push(seg.paragraphLevel ?? 0);
			atParagraphStart = false;
		}
		if (seg.text === '\n') {
			paragraphs.push('');
			atParagraphStart = true;
		} else {
			paragraphs[paragraphs.length - 1] += seg.text;
		}
	}
	while (paragraphLevels.length < paragraphs.length) {
		paragraphLevels.push(0);
	}

	const wordCounts = paragraphs.map((p) => p.trim().split(/\s+/u).filter(Boolean).length);
	const charCounts = paragraphs.map((p) => p.length);

	return {
		paragraphCount: paragraphs.length,
		wordCounts,
		charCounts,
		paragraphLevels,
	};
}

/**
 * Separator used between element ID and sub-element identifier
 * in composite animation target IDs (e.g. `"shape3::p0"`).
 */
export const TEXT_BUILD_ID_SEP = '::';

/**
 * The build granularity an animation actually wants, from either of the two
 * places OOXML records it.
 *
 * `p:bldP/@build` (parsed to `buildType`) is the slide-level text build, but
 * PowerPoint's "Effect Options > Animate text: By letter / By word" writes
 * `p:iterate` on the effect's own `p:cTn` instead. Only the first was honoured,
 * so a title authored to fade in letter by letter faded in as one block
 * (issue #106). `p:iterate type="el"` means "as one object" and stays
 * unexpanded.
 */
export function effectiveTextBuildType(
	anim: Pick<PptxNativeAnimation, 'buildType' | 'iterate'>,
): PptxTextBuildType | undefined {
	if (anim.buildType && anim.buildType !== 'allAtOnce') {
		return anim.buildType;
	}
	if (anim.iterate?.type === 'lt') {
		return 'byChar';
	}
	if (anim.iterate?.type === 'wd') {
		return 'byWord';
	}
	return undefined;
}

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

/**
 * Expand text-build animations into per-paragraph, per-word or per-character
 * sub-element animations.
 *
 * - **byParagraph**: each paragraph becomes its own click-group entry (trigger: onClick).
 * - **byWord**: words within each paragraph stagger with afterPrevious within same click.
 * - **byChar**: characters stagger with afterPrevious within same click.
 *
 * @param animations - Original animations (some may have `buildType` set).
 * @param segmentCounts - Map of elementId → segment counts from `countTextSegments()`.
 * @returns Expanded animation list with composite target IDs.
 */
export function expandTextBuildAnimations(
	animations: ReadonlyArray<PptxNativeAnimation>,
	segmentCounts: ReadonlyMap<string, TextBuildSegmentCounts>,
): PptxNativeAnimation[] {
	const result: PptxNativeAnimation[] = [];

	for (const anim of animations) {
		const buildType = effectiveTextBuildType(anim);
		const targetId = anim.targetId ?? '';

		if (!buildType || !targetId) {
			result.push(anim);
			continue;
		}

		const counts = segmentCounts.get(targetId);
		if (!counts) {
			result.push(anim);
			continue;
		}

		expandSingleBuildAnimation(anim, buildType, counts, result);
	}

	return result;
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
function iterateGranularity(
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
function emitStaggeredPieces(
	anim: PptxNativeAnimation,
	kind: 'byChar' | 'byWord',
	counts: TextBuildSegmentCounts,
	output: PptxNativeAnimation[],
	newClickStepPerParagraph: boolean,
): void {
	const targetId = anim.targetId ?? '';
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
						}),
				buildType: undefined,
				iterate: undefined,
			});
			stepIndex++;
		}
	}
}

/**
 * The trigger a by-paragraph build step after the first uses: a click, unless
 * `p:bldP/@advAuto` asked the paragraph to advance on its own after a delay
 * instead of waiting for one. `Infinity` (the `@advAuto="indefinite"` token)
 * has no meaningful finite wait, so it falls back to click-gated rather than
 * scheduling an unbounded timer.
 */
function nextBuildStepTrigger(advAutoMs: number | undefined): {
	trigger: 'onClick' | 'afterDelay';
	triggerDelayMs?: number;
} {
	if (advAutoMs === undefined || advAutoMs === Infinity) {
		return { trigger: 'onClick' };
	}
	return { trigger: 'afterDelay', triggerDelayMs: Math.max(0, advAutoMs) };
}

/**
 * Expand a single text-build animation into sub-element animations.
 */
function expandSingleBuildAnimation(
	anim: PptxNativeAnimation,
	buildType: PptxTextBuildType,
	counts: TextBuildSegmentCounts,
	output: PptxNativeAnimation[],
): void {
	const targetId = anim.targetId ?? '';

	if (buildType === 'byParagraph') {
		// A by-paragraph build whose effect also iterates by letter / word still
		// ripples inside each paragraph; only the step boundaries are paragraphs.
		// (`p:bldP/@bldLvl` grouping below is not composed with this rarer
		// combination: every paragraph still opens its own click here.)
		const granularity = iterateGranularity(anim);
		if (granularity) {
			emitStaggeredPieces(anim, granularity, counts, output, true);
			return;
		}
		// `p:bldP/@bldLvl` ("Group text: By Nth Level Paragraphs") groups a
		// top-level paragraph with its nested sub-bullets into ONE click step
		// instead of giving every paragraph its own click, regardless of
		// outline depth.
		const levels = counts.paragraphLevels ?? new Array<number>(counts.paragraphCount).fill(0);
		const groups = groupParagraphsByBuildLevel(levels, anim.buildLevel ?? DEFAULT_BUILD_LEVEL);
		// `p:bldP/@rev` reverses the GROUP reveal order (last group first);
		// a group's own members stay in their original ascending order.
		const orderedGroups = anim.buildReverse === true ? [...groups].reverse() : groups;

		let isFirstStep = true;
		for (const members of orderedGroups) {
			const [opener, ...rest] = members;
			const next = isFirstStep ? undefined : nextBuildStepTrigger(anim.buildAdvAutoMs);
			output.push({
				...anim,
				targetId: `${targetId}${TEXT_BUILD_ID_SEP}p${opener}`,
				trigger: isFirstStep ? anim.trigger : next!.trigger,
				triggerDelayMs: isFirstStep ? anim.triggerDelayMs : next!.triggerDelayMs,
				buildType: undefined,
				buildReverse: undefined,
				buildAdvAutoMs: undefined,
				buildLevel: undefined,
			});
			// Sub-level paragraphs grouped with `opener` reveal WITH it, on the
			// same click, rather than needing their own advance.
			for (const paraIndex of rest) {
				output.push({
					...anim,
					targetId: `${targetId}${TEXT_BUILD_ID_SEP}p${paraIndex}`,
					trigger: 'withPrevious',
					triggerDelayMs: undefined,
					startConditions: undefined,
					parGroupIndex: undefined,
					buildType: undefined,
					buildReverse: undefined,
					buildAdvAutoMs: undefined,
					buildLevel: undefined,
				});
			}
			isFirstStep = false;
		}
		return;
	}

	if (buildType === 'byWord' || buildType === 'byChar') {
		emitStaggeredPieces(anim, buildType, counts, output, false);
		return;
	}

	// Unknown build type — keep original
	output.push(anim);
}
