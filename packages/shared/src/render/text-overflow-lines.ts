/**
 * `a:bodyPr/@vertOverflow="clip"`: PowerPoint clips an overflowing text body
 * to the last WHOLE line that fits, never half a line (COM-verified,
 * audit-text slide 2: four lines of the three 18pt paragraphs show, the
 * fifth is gone entirely). A plain `overflow: hidden` on the body cut the
 * fifth line through the middle of its glyphs in every binding. The same
 * holds for `ellipsis`, whose `-webkit-line-clamp` only truncates the
 * paragraph it lands in: the next paragraph's first line still peeked in.
 *
 * CSS cannot clip at a line boundary it does not know, so this estimates the
 * line count from the body's content box and resolved line height (the same
 * estimate `resolveVertOverflowEllipsisStyle` uses for its clamp) and clips
 * the rest with `clip-path`. Only top-anchored bodies are handled: a
 * centred or bottom-anchored overflowing body spills both ways and its line
 * grid does not start at the content box edge.
 *
 * @module text-overflow-lines
 */

import type { TextStyle } from 'pptx-viewer-core';

/** The clip CSS for {@link resolveVertOverflowClipLines}. */
export interface TextOverflowLineClip {
	clipPath: string;
}

/**
 * @param textStyle       The element's resolved text style.
 * @param contentHeightPx The content-box height (element height minus insets).
 * @param paddingBottomPx The body's own bottom inset.
 * @param lineHeightPx    The resolved single-line height.
 * @returns The clip, or `undefined` when the body does not clip, is not
 *          top-anchored, or the inputs are unusable.
 */
export function resolveVertOverflowClipLines(
	textStyle: Pick<TextStyle, 'vertOverflow' | 'vAlign'> | undefined,
	contentHeightPx: number,
	paddingBottomPx: number,
	lineHeightPx: number,
): TextOverflowLineClip | undefined {
	if (textStyle?.vertOverflow !== 'clip' && textStyle?.vertOverflow !== 'ellipsis') {
		return undefined;
	}
	if (textStyle.vAlign !== undefined && textStyle.vAlign !== 'top') {
		return undefined;
	}
	if (!(lineHeightPx > 0) || !(contentHeightPx > lineHeightPx)) {
		return undefined;
	}
	const lines = Math.floor(contentHeightPx / lineHeightPx);
	const hidden = contentHeightPx - lines * lineHeightPx;
	if (hidden < 0.5) {
		return undefined;
	}
	const bottom = Math.round((paddingBottomPx + hidden) * 100) / 100;
	return { clipPath: `inset(0 0 ${bottom}px 0)` };
}
