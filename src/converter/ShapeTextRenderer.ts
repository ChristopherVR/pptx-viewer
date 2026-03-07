import type { TextSegment, TextStyle } from '../core';

/** Default font size in CSS px when none specified. */
const DEFAULT_FONT_SIZE = 18;
/** Fallback padding as fraction of shape dimension. */
const FALLBACK_PAD_FACTOR = 0.06;

/**
 * Draws text segments onto a canvas context, with word-wrapping,
 * horizontal/vertical alignment, and per-run font styling.
 *
 * @param scaleFactor ratio between rendered canvas size and original
 *                    element size (1 = no scaling). Font sizes are
 *                    multiplied by this value so they remain
 *                    proportional to the canvas.
 */
export function drawTextSegments(
	ctx: CanvasRenderingContext2D,
	segments: TextSegment[],
	bodyStyle: TextStyle | undefined,
	w: number,
	h: number,
	scaleFactor = 1
): void {
	// Use body insets if available, else a small fraction of dimensions.
	const padL = bodyStyle?.bodyInsetLeft
		? bodyStyle.bodyInsetLeft * scaleFactor
		: Math.round(w * FALLBACK_PAD_FACTOR);
	const padR = bodyStyle?.bodyInsetRight
		? bodyStyle.bodyInsetRight * scaleFactor
		: Math.round(w * FALLBACK_PAD_FACTOR);
	const padT = bodyStyle?.bodyInsetTop
		? bodyStyle.bodyInsetTop * scaleFactor
		: Math.round(h * FALLBACK_PAD_FACTOR);
	const padB = bodyStyle?.bodyInsetBottom
		? bodyStyle.bodyInsetBottom * scaleFactor
		: Math.round(h * FALLBACK_PAD_FACTOR);

	const maxWidth = w - padL - padR;
	if (maxWidth <= 0) return;

	const paragraphs = splitIntoParagraphs(segments);
	const lines = layoutParagraphs(ctx, paragraphs, maxWidth, scaleFactor);
	if (lines.length === 0) return;

	const totalHeight = lines.reduce((sum, l) => sum + l.height * 1.3, 0);
	const usableH = h - padT - padB;

	// Vertical alignment.
	const vAlign = bodyStyle?.vAlign ?? 'top';
	let y: number;
	if (vAlign === 'middle') {
		y = padT + (usableH - totalHeight) / 2;
	} else if (vAlign === 'bottom') {
		y = h - padB - totalHeight;
	} else {
		y = padT;
	}

	for (const line of lines) {
		y += line.height;
		const hAlign = line.align ?? bodyStyle?.align ?? 'left';
		let x: number;
		if (hAlign === 'center') {
			x = padL + (maxWidth - line.width) / 2;
		} else if (hAlign === 'right') {
			x = padL + maxWidth - line.width;
		} else {
			x = padL;
		}

		for (const run of line.runs) {
			ctx.font = buildFont(run.style, scaleFactor);
			ctx.fillStyle = run.style.color ?? '#000000';
			ctx.fillText(run.text, x, y);
			x += run.measuredWidth;
		}

		y += line.height * 0.3; // line gap
	}
}

/* ------------------------------------------------------------------ */
/*  Internal types                                                    */
/* ------------------------------------------------------------------ */

interface TextRun {
	text: string;
	style: TextStyle;
	measuredWidth: number;
}

interface TextLine {
	runs: TextRun[];
	width: number;
	height: number;
	align?: TextStyle['align'];
}

/* ------------------------------------------------------------------ */
/*  Paragraph splitting & layout                                      */
/* ------------------------------------------------------------------ */

function splitIntoParagraphs(
	segments: TextSegment[]
): TextSegment[][] {
	const paragraphs: TextSegment[][] = [[]];
	for (const seg of segments) {
		if (seg.isParagraphBreak) {
			paragraphs.push([]);
		} else if (seg.text) {
			paragraphs[paragraphs.length - 1].push(seg);
		}
	}
	return paragraphs.filter((p) => p.length > 0);
}

function layoutParagraphs(
	ctx: CanvasRenderingContext2D,
	paragraphs: TextSegment[][],
	maxWidth: number,
	scaleFactor: number
): TextLine[] {
	const lines: TextLine[] = [];

	for (const para of paragraphs) {
		const paraAlign = para[0]?.style?.align;
		let currentLine: TextRun[] = [];
		let lineWidth = 0;
		let lineHeight = 0;

		for (const seg of para) {
			ctx.font = buildFont(seg.style, scaleFactor);
			const fontSize =
				(seg.style.fontSize ?? DEFAULT_FONT_SIZE) * scaleFactor;
			const segHeight = fontSize * 1.2;

			// Split into words while preserving whitespace boundaries.
			// A segment may be a single space (" ") between runs — we
			// must ensure that space is kept.
			const tokens = seg.text.split(/(?<=\s)(?=\S)|(?<=\S)(?=\s)/);
			for (const raw of tokens) {
				if (!raw) continue;

				// If the token is pure whitespace, attach it to the
				// current line as trailing space.
				if (/^\s+$/.test(raw)) {
					if (currentLine.length > 0) {
						const spaceW = ctx.measureText(raw).width;
						currentLine.push({
							text: raw,
							style: seg.style,
							measuredWidth: spaceW,
						});
						lineWidth += spaceW;
					}
					continue;
				}

				// Non-whitespace word.
				const word = raw;
				const wordW = ctx.measureText(word).width;

				if (
					lineWidth + wordW > maxWidth &&
					currentLine.length > 0
				) {
					// Trim trailing whitespace runs before pushing.
					while (
						currentLine.length > 0 &&
						/^\s+$/.test(currentLine[currentLine.length - 1].text)
					) {
						const removed = currentLine.pop()!;
						lineWidth -= removed.measuredWidth;
					}
					lines.push({
						runs: currentLine,
						width: lineWidth,
						height: lineHeight,
						align: paraAlign,
					});
					currentLine = [];
					lineWidth = 0;
					lineHeight = 0;
				}

				currentLine.push({
					text: word,
					style: seg.style,
					measuredWidth: wordW,
				});
				lineWidth += wordW;
				lineHeight = Math.max(lineHeight, segHeight);
			}
		}

		if (currentLine.length > 0) {
			lines.push({
				runs: currentLine,
				width: lineWidth,
				height: lineHeight,
				align: paraAlign,
			});
		}
	}

	return lines;
}

/* ------------------------------------------------------------------ */
/*  Font string builder                                               */
/* ------------------------------------------------------------------ */

function buildFont(style: TextStyle, scaleFactor: number): string {
	const size = (style.fontSize ?? DEFAULT_FONT_SIZE) * scaleFactor;
	const weight = style.bold ? 'bold' : 'normal';
	const slant = style.italic ? 'italic' : 'normal';
	const family = style.fontFamily ?? 'sans-serif';
	return `${slant} ${weight} ${size}px "${family}", sans-serif`;
}
