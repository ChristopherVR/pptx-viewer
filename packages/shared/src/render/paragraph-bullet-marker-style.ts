/**
 * The bullet marker's own inline style: colour, typeface, weight/slant, size,
 * and the box that reserves the hanging distance.
 *
 * Split out of `paragraph-run-build.ts` (which stays focused on the run
 * builder itself) to keep both files under this repo's ~300-LOC guideline.
 */

import type { TextSegment } from 'pptx-viewer-core';
import { getSubstituteFontFamily } from 'pptx-viewer-core';

import type { ParagraphBulletResult } from './bullet-list';
import type { RunStyle } from './text-run-style';

export function buildBulletMarkerStyle(
	bullet: ParagraphBulletResult | undefined,
	firstSeg: TextSegment | undefined,
	fontScale: number,
	textIndentPx: number | undefined,
): RunStyle {
	const bulletStyle: RunStyle = {};
	if (!bullet) {
		return bulletStyle;
	}
	if (bullet.color) {
		bulletStyle.color = bullet.color;
	}
	if (bullet.fontFamily) {
		bulletStyle.fontFamily = bullet.fontFamily;
	} else if (firstSeg?.style?.fontFamily) {
		// A bullet that declares no `a:buFont` is painted in the paragraph's own
		// typeface, which is what React does (the marker rides the first segment's
		// span). Leaving it to inherit the text BODY's declaration picked a
		// different family whenever the first run overrode it, and a marker glyph's
		// advance is what positions the whole first line.
		bulletStyle.fontFamily = getSubstituteFontFamily(firstSeg.style.fontFamily);
	}
	// Weight / slant come from the marker's OWN segment, never from the text
	// body: a bold heading whose marker segment core parsed as regular painted a
	// bold glyph here and a regular one in React, and a heavier marker is also a
	// wider one, so the first line started further in.
	bulletStyle.fontWeight = firstSeg?.style?.bold ? 700 : 400;
	bulletStyle.fontStyle = firstSeg?.style?.italic ? 'italic' : 'normal';
	// The marker shrinks with the body's autofit scale exactly as its runs do (an
	// explicit `a:buSzPts` is an absolute size and stays put).
	const runFontSize = firstSeg?.style?.fontSize;
	if (typeof bullet.sizePts === 'number') {
		bulletStyle.fontSize = `${bullet.sizePts}px`;
	} else if (typeof bullet.sizePercent === 'number' && typeof runFontSize === 'number') {
		bulletStyle.fontSize = `${runFontSize * fontScale * (bullet.sizePercent / 100)}px`;
	} else if (fontScale !== 1 && typeof runFontSize === 'number') {
		bulletStyle.fontSize = `${runFontSize * fontScale}px`;
	}
	// PowerPoint draws the marker at `marL + indent` and starts the text at
	// `marL`, so the marker's box is exactly the hanging distance wide. Reserving
	// it here is what makes the runs line up on the indent stop instead of butting
	// straight against the glyph, and it removes the need for a spacer character
	// after the marker: a non-breaking space inherits the marker's font, and
	// Wingdings maps U+00A0 to a visible dot, which painted a second bullet
	// (issue #131, slides 13-14).
	const hangPx = typeof textIndentPx === 'number' && textIndentPx < 0 ? -textIndentPx : undefined;
	bulletStyle.display = 'inline-block';
	// `text-indent` inherits, and an inline-block is a block container: without
	// this reset the marker box applies the paragraph's negative first-line indent
	// AGAIN internally and paints the glyph a full hang-width left of its own box
	// (outside the text inset).
	bulletStyle.textIndent = '0px';
	if (hangPx !== undefined) {
		bulletStyle.minWidth = `${hangPx}px`;
	} else {
		bulletStyle.marginInlineEnd = '0.35em';
	}
	return bulletStyle;
}
