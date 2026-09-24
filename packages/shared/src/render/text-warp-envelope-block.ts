/**
 * Unwarped layout of a WordArt envelope text block, the input to the
 * envelope mapping (`text-warp-envelope-map.ts`). Measured against
 * PowerPoint COM renders (2026-09-24, see `docs/guide/visual-effects.md`):
 *
 *  - Paragraphs stack as ordinary lines: baseline to baseline is
 *    `1.2 * ((1 - k) * S_prev + k * S_next)` for the lines' largest font
 *    sizes `S` ({@link LINE_PITCH_EM}, {@link BASELINE_FRACTION}); the 1.2em
 *    pitch held for all seven fonts measured (Arial, Times New Roman,
 *    Calibri, Georgia, Verdana, Segoe UI, Cambria, each within 0.3%).
 *  - Lines are aligned against the widest line, and are NOT each stretched
 *    to the box: a short line keeps its natural width inside the block.
 *  - The block box is the union of every glyph's INK box vertically, and
 *    horizontally the union of ink boxes plus the full advance box of
 *    whitespace (a leading or trailing space widens the block).
 */
import type { EnvelopeBlockBox } from './text-warp-envelope-map';
import {
	envelopeFontSizePx,
	measureGlyphAdvances,
	measureGlyphInk,
} from './text-warp-envelope-measure';
import type {
	EnvelopeAlign,
	EnvelopeFontSpec,
	EnvelopeSegmentInput,
	GlyphOutlineLookup,
} from './text-warp-envelope-types';
import type { GlyphOutlineCommand } from './text-warp-glyph-outline';
import { outlineBounds } from './text-warp-glyph-outline';

/** PowerPoint's single-spaced line pitch, in ems of the line's largest font. */
export const LINE_PITCH_EM = 1.2;

/** Where the baseline sits inside a line's pitch (fraction from its top). */
const BASELINE_FRACTION = 0.805;

/** Ink height estimate (ems above the baseline) with no outline or DOM metrics. */
const FALLBACK_CAP_HEIGHT_EM = 0.72;

const WHITESPACE_RE = /^\s$/u;

/** One glyph placed in the unwarped block. */
export interface EnvelopeBlockGlyph {
	char: string;
	segmentIndex: number;
	font: EnvelopeFontSpec;
	/** Left advance edge (layout units). */
	x: number;
	/** Baseline (layout units). */
	baseline: number;
	advance: number;
	/** The glyph's outline at `(x, baseline)`, when obtainable. */
	outline?: GlyphOutlineCommand[];
	/** Ink box; `undefined` for whitespace. */
	ink?: EnvelopeBlockBox;
}

/** The unwarped block: glyphs per paragraph plus the box the warp normalises by. */
export interface EnvelopeBlockLayout {
	lines: EnvelopeBlockGlyph[][];
	box: EnvelopeBlockBox | undefined;
}

function alignOffset(align: EnvelopeAlign, blockWidth: number, lineWidth: number): number {
	if (align === 'right') {
		return blockWidth - lineWidth;
	}
	if (align === 'center' || align === undefined) {
		return (blockWidth - lineWidth) / 2;
	}
	return 0;
}

function glyphInk(
	char: string,
	font: EnvelopeFontSpec,
	x: number,
	baseline: number,
	advance: number,
	outline: GlyphOutlineCommand[] | undefined,
): EnvelopeBlockBox | undefined {
	if (WHITESPACE_RE.test(char)) {
		return undefined;
	}
	if (outline) {
		return outlineBounds(outline);
	}
	const ink = measureGlyphInk(char, font);
	if (ink) {
		return ink.right > ink.left || ink.ascent + ink.descent > 0
			? {
					left: x + ink.left,
					right: x + ink.right,
					top: baseline - ink.ascent,
					bottom: baseline + ink.descent,
				}
			: undefined;
	}
	return {
		left: x,
		right: x + advance,
		top: baseline - envelopeFontSizePx(font) * FALLBACK_CAP_HEIGHT_EM,
		bottom: baseline,
	};
}

function lineFontSize(segments: EnvelopeSegmentInput[], fallback: number): number {
	const sizes = segments.map((s) => envelopeFontSizePx(s.font));
	return sizes.length > 0 ? Math.max(...sizes) : fallback;
}

/**
 * Lay out `paragraphs` (each a list of styled runs) unwarped, and measure
 * the block box. The box is `undefined` when nothing on any line has ink.
 */
export function layoutEnvelopeBlock(
	paragraphs: EnvelopeSegmentInput[][],
	align: EnvelopeAlign,
	getGlyphOutline?: GlyphOutlineLookup,
): EnvelopeBlockLayout {
	const measured = paragraphs.map((segments) =>
		segments.map((seg) => ({ seg, advances: measureGlyphAdvances(seg.text, seg.font) })),
	);
	const widths = measured.map((line) =>
		line.reduce((sum, m) => sum + m.advances.reduce((s, a) => s + a, 0), 0),
	);
	const blockWidth = widths.length > 0 ? Math.max(...widths) : 0;

	let baseline = 0;
	let previousSize: number | undefined;
	const box = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
	let hasInk = false;
	const lines = measured.map((line, lineIdx) => {
		const size = lineFontSize(paragraphs[lineIdx], previousSize ?? 0);
		if (previousSize !== undefined) {
			baseline +=
				LINE_PITCH_EM * ((1 - BASELINE_FRACTION) * previousSize + BASELINE_FRACTION * size);
		}
		previousSize = size;
		let x = alignOffset(effectiveAlign(align), blockWidth, widths[lineIdx]);
		const glyphs: EnvelopeBlockGlyph[] = [];
		for (const { seg, advances } of line) {
			const chars = [...seg.text];
			for (let i = 0; i < chars.length; i++) {
				const char = chars[i];
				const advance = advances[i] ?? 0;
				const outline = WHITESPACE_RE.test(char)
					? undefined
					: getGlyphOutline?.(char, seg.font, x, baseline);
				const usable = outline && outline.length > 0 ? outline : undefined;
				const ink = glyphInk(char, seg.font, x, baseline, advance, usable);
				if (ink) {
					hasInk = true;
					box.left = Math.min(box.left, ink.left);
					box.right = Math.max(box.right, ink.right);
					box.top = Math.min(box.top, ink.top);
					box.bottom = Math.max(box.bottom, ink.bottom);
				} else if (WHITESPACE_RE.test(char)) {
					box.left = Math.min(box.left, x);
					box.right = Math.max(box.right, x + advance);
				}
				glyphs.push({
					char,
					segmentIndex: seg.segmentIndex,
					font: seg.font,
					x,
					baseline,
					advance,
					outline: usable,
					ink,
				});
				x += advance;
			}
		}
		return glyphs;
	});
	return { lines, box: hasInk ? box : undefined };
}

/** Distributed/justified alignments lay a single unwrapped line out left-aligned. */
function effectiveAlign(align: EnvelopeAlign): EnvelopeAlign {
	return align === 'justify' || align === 'justLow' || align === 'dist' || align === 'thaiDist'
		? 'left'
		: align;
}
