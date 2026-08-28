/**
 * `animation-timeline-text-range` — scopes an animation carrying a `p:txEl`
 * text-level target (`p:pRg` paragraph range or `p:charRg` character range,
 * ECMA-376 S19.5.86 CT_TLTextTargetElement) to just the paragraphs/characters
 * it names, instead of the whole text-box element.
 *
 * Reuses the SAME `<elementId>::p<i>` / `<elementId>::c<p>-<c>` composite-id
 * scheme `expandTextBuildAnimations` already emits for staged text builds:
 * every binding's text renderer already knows how to look up those ids (see
 * `text-build-spans.ts`), so scoping a plain entrance/emphasis/exit effect
 * to a paragraph or character range needs no new rendering plumbing, only
 * this expansion.
 *
 * @module render/animation-timeline-text-range
 */

import type { PptxNativeAnimation } from 'pptx-viewer-core';

import { TEXT_BUILD_ID_SEP } from './animation-timeline-text-build';
import type { TextBuildSegmentCounts } from './animation-timeline-text-build';

/**
 * Fields that make a synthetic sub-target step join the SAME click as the
 * first sub-target instead of starting its own new one. A `p:txEl` scope
 * targets several paragraphs/characters with ONE effect that plays as a
 * single simultaneous unit, unlike a staged by-paragraph/word/char BUILD.
 */
function joinPreviousFields(): Pick<
	PptxNativeAnimation,
	'trigger' | 'triggerDelayMs' | 'startConditions' | 'parGroupIndex' | 'parGroupDelayMs'
> {
	return {
		trigger: 'withPrevious',
		triggerDelayMs: undefined,
		startConditions: undefined,
		parGroupIndex: undefined,
		parGroupDelayMs: undefined,
	};
}

/** Expand a `pRg`-scoped animation into one sub-animation per named paragraph. */
function expandParagraphRange(
	anim: PptxNativeAnimation,
	targetId: string,
	start: number,
	end: number,
	output: PptxNativeAnimation[],
): void {
	let isFirst = true;
	for (let i = Math.max(0, start); i < end; i++) {
		output.push({
			...anim,
			targetId: `${targetId}${TEXT_BUILD_ID_SEP}p${i}`,
			textTarget: undefined,
			...(isFirst ? {} : joinPreviousFields()),
		});
		isFirst = false;
	}
}

/** Expand a `charRg`-scoped animation into one sub-animation per named character. */
function expandCharacterRange(
	anim: PptxNativeAnimation,
	targetId: string,
	start: number,
	end: number,
	charCounts: readonly number[],
	output: PptxNativeAnimation[],
): boolean {
	let offset = 0;
	let isFirst = true;
	let emitted = false;
	for (let p = 0; p < charCounts.length; p++) {
		const len = charCounts[p];
		for (let c = 0; c < len; c++) {
			const globalIndex = offset + c;
			if (globalIndex >= start && globalIndex < end) {
				output.push({
					...anim,
					targetId: `${targetId}${TEXT_BUILD_ID_SEP}c${p}-${c}`,
					textTarget: undefined,
					...(isFirst ? {} : joinPreviousFields()),
				});
				isFirst = false;
				emitted = true;
			}
		}
		offset += len;
	}
	return emitted;
}

/**
 * Expand every animation carrying a `p:txEl` (`textTarget`) into per-paragraph
 * or per-character sub-animations scoped to the named range, using the
 * element's segment counts to clamp/interpret the range. Animations without a
 * `textTarget`, or whose target element has no known segment counts, pass
 * through unchanged (falling back to the pre-existing whole-element scope).
 *
 * @param animations - Native animations, some carrying `textTarget`.
 * @param segmentCounts - Map of elementId -> segment counts (see
 *        `countTextSegments`); the SAME map `expandTextBuildAnimations` uses.
 */
export function expandTextRangeAnimations(
	animations: ReadonlyArray<PptxNativeAnimation>,
	segmentCounts: ReadonlyMap<string, TextBuildSegmentCounts>,
): PptxNativeAnimation[] {
	const result: PptxNativeAnimation[] = [];

	for (const anim of animations) {
		const range = anim.textTarget;
		const targetId = anim.targetId ?? '';
		if (!range || !targetId) {
			result.push(anim);
			continue;
		}

		const counts = segmentCounts.get(targetId);

		if (range.type === 'pRg') {
			const end = counts ? Math.min(range.end, counts.paragraphCount) : range.end;
			if (end <= Math.max(0, range.start)) {
				result.push(anim);
				continue;
			}
			expandParagraphRange(anim, targetId, range.start, end, result);
			continue;
		}

		// charRg needs per-paragraph character counts to translate a flat
		// character offset into a paragraph + within-paragraph index; without
		// them the range can't be interpreted, so fall back to the whole shape.
		if (range.type === 'charRg' && counts?.charCounts) {
			const total = counts.charCounts.reduce((sum, n) => sum + n, 0);
			const start = Math.max(0, range.start);
			const end = Math.min(range.end, total);
			if (
				end > start &&
				expandCharacterRange(anim, targetId, start, end, counts.charCounts, result)
			) {
				continue;
			}
		}

		result.push(anim);
	}

	return result;
}
