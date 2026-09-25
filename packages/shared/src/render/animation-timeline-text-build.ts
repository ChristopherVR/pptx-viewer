/**
 * `animation-timeline-text-build`: pure expansion of text-build animations
 * (by-paragraph / by-word / by-char) into staggered per-segment sub-animations.
 *
 * @module render/animation-timeline-text-build
 */

import type { PptxNativeAnimation, PptxTextBuildType } from 'pptx-viewer-core';

import { DEFAULT_BUILD_LEVEL, groupParagraphsByBuildLevel } from './animation-timeline-build-level';
import {
	emitStaggeredPieces,
	iterateGranularity,
	parseParagraphScopedTarget,
	TEXT_BUILD_ID_SEP,
} from './animation-timeline-text-build-pieces';
import type { TextBuildSegmentCounts } from './animation-timeline-text-build-pieces';
import { emitParagraphGroupRipple } from './animation-timeline-text-build-ripple';

export type { TextBuildSegmentCounts } from './animation-timeline-text-build-pieces';
export { TEXT_BUILD_ID_SEP } from './animation-timeline-text-build-pieces';

// ==========================================================================
// Text-build segment counts
// ==========================================================================

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

		// PowerPoint writes a by-paragraph build as ONE effect per paragraph,
		// each scoped by `p:txEl/p:pRg` (already split to `<id>::p<N>` by
		// `expandTextRangeAnimations`). Such an effect must not be re-split into
		// every paragraph again; only its own `p:iterate` (by letter / word)
		// still subdivides it, inside that one paragraph.
		const scoped = parseParagraphScopedTarget(targetId);
		if (scoped) {
			const baseCounts = segmentCounts.get(scoped.baseId);
			const granularity =
				iterateGranularity(anim) ??
				(buildType === 'byWord' || buildType === 'byChar' ? buildType : undefined);
			const before = result.length;
			if (baseCounts && granularity) {
				emitStaggeredPieces(anim, granularity, baseCounts, result, scoped);
			}
			// An empty paragraph has no pieces; keep its step so the click count
			// still matches PowerPoint's.
			if (result.length === before) {
				result.push({ ...anim, buildType: undefined });
			}
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
		// `p:bldP/@bldLvl` ("Group text: By Nth Level Paragraphs") groups a
		// top-level paragraph with its nested sub-bullets into ONE click step
		// instead of giving every paragraph its own click, regardless of
		// outline depth.
		const levels = counts.paragraphLevels ?? new Array<number>(counts.paragraphCount).fill(0);
		const groups = groupParagraphsByBuildLevel(levels, anim.buildLevel ?? DEFAULT_BUILD_LEVEL);
		// `p:bldP/@rev` reverses the GROUP reveal order (last group first);
		// a group's own members stay in their original ascending order.
		const orderedGroups = anim.buildReverse === true ? [...groups].reverse() : groups;

		// A by-paragraph build whose effect also iterates by letter / word still
		// ripples inside each paragraph; only the step boundaries are paragraph
		// groups.
		const granularity = iterateGranularity(anim);
		if (granularity) {
			orderedGroups.forEach((members, index) => {
				const next = index === 0 ? undefined : nextBuildStepTrigger(anim.buildAdvAutoMs);
				const head = next
					? {
							...next,
							delayMs: 0,
							startConditions: undefined,
							parGroupIndex: undefined,
							parGroupDelayMs: undefined,
						}
					: {
							trigger: anim.trigger,
							triggerDelayMs: anim.triggerDelayMs,
							delayMs: anim.delayMs,
							startConditions: anim.startConditions,
							parGroupIndex: anim.parGroupIndex,
							parGroupDelayMs: anim.parGroupDelayMs,
						};
				emitParagraphGroupRipple(anim, granularity, counts, members, head, output);
			});
			return;
		}

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
					parGroupDelayMs: undefined,
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
		emitStaggeredPieces(anim, buildType, counts, output);
		return;
	}

	// Unknown build type: keep original
	output.push(anim);
}
