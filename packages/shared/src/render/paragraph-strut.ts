import type { TextSegment } from 'pptx-viewer-core';

/**
 * Font size (px) that a paragraph's CSS line box should be built from, or
 * `undefined` when the paragraph declares nothing of its own.
 *
 * ## Why this exists
 *
 * Every binding renders a text body as one container whose `font-size` is the
 * shape's default run size and whose `line-height` is a unitless ratio. Each
 * run then gets its own explicit `font-size` on its `<span>`. That looks
 * right until a paragraph's runs are SMALLER than the shape default: CSS still
 * builds every line box against the block container's own font metrics (the
 * "strut"), so a paragraph of 8pt runs inside a body defaulting to 14pt is
 * laid out on 14pt line boxes. PowerPoint sizes each line from the runs
 * actually on it, so our text came out with visibly airy leading and
 * overflowed its shape - the taller the shape default relative to the runs,
 * the worse the drift.
 *
 * Returning the paragraph's own dominant run size lets a binding set it as the
 * paragraph element's `font-size`, which re-bases the strut without touching
 * any run: the spans keep their explicit sizes, and the unitless
 * `line-height` ratio resolves against the paragraph instead of the body.
 *
 * The SMALLEST run wins, not the largest. A run's own `font-size` already
 * sizes ITS line correctly through ordinary inline layout (a non-replaced
 * inline element's line-box contribution is its own font-size times the
 * inherited unitless `line-height`, independent of the container's strut),
 * so the strut only needs to stop the invisible per-line minimum from being
 * BIGGER than the smallest real content - using the largest run instead
 * inflates every wrapped line of the paragraph to that run's height, even
 * lines the large run never appears on. COM-verified against
 * `audit-text/pp/s16.png` (`gen.py` slide 16): a paragraph of "small HUGE
 * small wraps onto the / second line of text" wraps into two lines, and
 * PowerPoint sizes line 2 (only the 12pt "small" text) tightly under line 1,
 * not with the airy gap a 48pt-based strut produces. Bullet segments are
 * excluded: a bullet glyph never drives the height of the line it marks.
 *
 * `fontScale` is `a:normAutofit/@fontScale` (see `resolveAutoFitFontScale`),
 * the same multiplier every run's own rendered size is scaled by. Segment
 * styles carry their pre-shrink authored size, so the strut has to apply the
 * same scale or the paragraph's line box stays sized for the unshrunk text
 * while every run inside it renders smaller - defeating the shrink for any
 * paragraph that sets its own (or inherits the body's) line spacing, which is
 * effectively every paragraph.
 */
export function resolveParagraphStrutFontSize(
	segments: ReadonlyArray<Pick<TextSegment, 'style' | 'bulletInfo' | 'text'>>,
	bodyFontSize: number | undefined,
	fontScale = 1,
): number | undefined {
	let smallest: number | undefined;
	for (const segment of segments) {
		if (segment.bulletInfo) {
			continue;
		}
		const size = segment.style?.fontSize;
		if (typeof size !== 'number' || !Number.isFinite(size) || size <= 0) {
			continue;
		}
		if (smallest === undefined || size < smallest) {
			smallest = size;
		}
	}
	if (smallest === undefined) {
		return undefined;
	}
	// Nothing to re-base when the paragraph already matches the body default.
	if (typeof bodyFontSize === 'number' && Math.abs(smallest - bodyFontSize) < 0.01) {
		return undefined;
	}
	return smallest * fontScale;
}
