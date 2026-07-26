/**
 * `animation-timeline-text-build` — pure expansion of text-build animations
 * (by-paragraph / by-word / by-char) into staggered per-segment sub-animations.
 *
 * @module render/animation-timeline-text-build
 */

import type { PptxNativeAnimation, PptxTextBuildType } from 'pptx-viewer-core';

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
}

/**
 * Count paragraphs, words and characters from an element's text segments.
 * Paragraph boundaries are segments whose text is exactly `"\n"`.
 */
export function countTextSegments(
	textSegments: ReadonlyArray<{ text: string }>,
): TextBuildSegmentCounts {
	const paragraphs: string[] = [''];
	for (const seg of textSegments) {
		if (seg.text === '\n') {
			paragraphs.push('');
		} else {
			paragraphs[paragraphs.length - 1] += seg.text;
		}
	}

	const wordCounts = paragraphs.map((p) => p.trim().split(/\s+/u).filter(Boolean).length);
	const charCounts = paragraphs.map((p) => p.length);

	return {
		paragraphCount: paragraphs.length,
		wordCounts,
		charCounts,
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
 * 10%). Returns `undefined` when the animation is not iterate-driven, so the
 * caller keeps the slide-build defaults.
 */
function iterateStaggerMs(anim: PptxNativeAnimation, durationMs: number): number | undefined {
	const iterate = anim.iterate;
	if (!iterate || iterate.type === 'el') {
		return undefined;
	}
	if (typeof iterate.tmAbs === 'number' && Number.isFinite(iterate.tmAbs) && iterate.tmAbs > 0) {
		return iterate.tmAbs;
	}
	if (typeof iterate.tmPct === 'number' && Number.isFinite(iterate.tmPct) && iterate.tmPct > 0) {
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
 * Expand a single text-build animation into sub-element animations.
 */
function expandSingleBuildAnimation(
	anim: PptxNativeAnimation,
	buildType: PptxTextBuildType,
	counts: TextBuildSegmentCounts,
	output: PptxNativeAnimation[],
): void {
	const targetId = anim.targetId ?? '';
	const baseDuration = anim.durationMs ?? 500;

	if (buildType === 'byParagraph') {
		for (let i = 0; i < counts.paragraphCount; i++) {
			output.push({
				...anim,
				targetId: `${targetId}${TEXT_BUILD_ID_SEP}p${i}`,
				trigger: i === 0 ? anim.trigger : 'onClick',
				buildType: undefined,
			});
		}
		return;
	}

	// An `p:iterate` build overlaps: every letter/word runs the FULL effect
	// duration and merely starts `stagger` later than the one before, which is
	// what makes PowerPoint's "by letter" read as a ripple. `withPrevious` steps
	// accumulate their delay from the previous step's START, so passing the bare
	// interval as each step's delay yields `base + i * stagger`. The slide-build
	// (`p:bldP`) path keeps its original end-to-end pacing.
	const stagger = iterateStaggerMs(anim, baseDuration);

	if (buildType === 'byWord') {
		const wordCounts = counts.wordCounts ?? [];
		let stepIndex = 0;
		for (let pIdx = 0; pIdx < counts.paragraphCount; pIdx++) {
			const wc = wordCounts[pIdx] ?? 0;
			for (let wIdx = 0; wIdx < wc; wIdx++) {
				output.push({
					...anim,
					targetId: `${targetId}${TEXT_BUILD_ID_SEP}w${pIdx}-${wIdx}`,
					trigger:
						stepIndex === 0
							? anim.trigger
							: stagger !== undefined
								? 'withPrevious'
								: 'afterPrevious',
					durationMs:
						stagger !== undefined ? baseDuration : Math.max(100, Math.round(baseDuration / 2)),
					delayMs: stepIndex === 0 ? (anim.delayMs ?? 0) : (stagger ?? 50),
					// Only the first sub-step inherits the parent's start delay; the
					// rest carry the bare stagger, so these must not re-apply it.
					// They are synthetic chain steps rather than OOXML `p:par`
					// siblings, so they also drop the wrapper index: their delay is
					// an interval off the step before, not an offset from the group.
					...(stepIndex === 0
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
		return;
	}

	if (buildType === 'byChar') {
		const charCounts = counts.charCounts ?? [];
		let stepIndex = 0;
		for (let pIdx = 0; pIdx < counts.paragraphCount; pIdx++) {
			const cc = charCounts[pIdx] ?? 0;
			for (let cIdx = 0; cIdx < cc; cIdx++) {
				output.push({
					...anim,
					targetId: `${targetId}${TEXT_BUILD_ID_SEP}c${pIdx}-${cIdx}`,
					trigger:
						stepIndex === 0
							? anim.trigger
							: stagger !== undefined
								? 'withPrevious'
								: 'afterPrevious',
					durationMs:
						stagger !== undefined ? baseDuration : Math.max(50, Math.round(baseDuration / 4)),
					delayMs: stepIndex === 0 ? (anim.delayMs ?? 0) : (stagger ?? 20),
					// Only the first sub-step inherits the parent's start delay; the
					// rest carry the bare stagger, so these must not re-apply it.
					// They are synthetic chain steps rather than OOXML `p:par`
					// siblings, so they also drop the wrapper index: their delay is
					// an interval off the step before, not an offset from the group.
					...(stepIndex === 0
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
		return;
	}

	// Unknown build type — keep original
	output.push(anim);
}
