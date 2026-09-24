/**
 * True two-curve WordArt envelope descriptor (inflate/deflate/can) for the
 * Angular viewer. Split out of `text-warp.ts` to keep that file under the
 * repo's per-file line budget.
 *
 * Unlike `TextWarpPathDef` (a shared-baseline SVG `<textPath>`), glyph HEIGHT
 * varies with horizontal position here: each glyph carries its own warped
 * outline path (or, without one, an affine `matrix`), computed once for the
 * whole block by `buildGlyphEnvelopeBlock` (`pptx-viewer-shared`).
 */
import type { PptxTextWarpPreset, TextSegment, TextStyle } from 'pptx-viewer-core';
import { getSubstituteFontFamily } from 'pptx-viewer-core';

import { buildGlyphEnvelopeBlock, DEFAULT_FONT_FAMILY } from '../internal/shared';
import type { EnvelopeGlyphSlice, EnvelopeSegmentInput, WarpParagraph } from '../internal/shared';
import { getGlyphOutline, glyphOutlineFontsTick } from './glyph-outline-cache';

const DEFAULT_FONT_SIZE = 18;
const DEFAULT_COLOR = '#000000';

/** One glyph of an envelope-warped (inflate/deflate/can) line. */
export interface WarpGlyph {
	readonly char: string;
	readonly x: number;
	readonly y: number;
	/** SVG `matrix(a b c d e f)` fit of the envelope mapping over the glyph (fallback only). */
	readonly transform: string;
	readonly fill: string;
	readonly fontWeight: 400 | 700;
	readonly fontStyle: 'italic' | 'normal';
	readonly fontFamily: string;
	readonly fontSize: number;
	/**
	 * Present only when this glyph needed more than one rendered piece (see
	 * `fitGlyphEnvelopeAffine` in pptx-viewer-shared): a very wide glyph on a
	 * strongly-curved envelope, where `transform` alone misses how much the
	 * curve bends within the glyph's own width. Absent for an ordinary
	 * caption, in which case the template renders exactly one `<text>` with
	 * `transform`, unchanged from before slicing existed.
	 */
	readonly slices?: EnvelopeGlyphSlice[];
	/**
	 * Deterministic clip-id prefix for this glyph's slices (unique across
	 * every WordArt element on the page: element id + line + glyph index).
	 * The template appends `-s{index}` per slice.
	 */
	readonly clipIdPrefix: string;
	/**
	 * A warped SVG path `d` for this glyph's ACTUAL outline (see
	 * `buildWarpedGlyphOutlinePathD` in pptx-viewer-shared), present whenever
	 * an outline was obtainable (a font file, or a glyph traced from the
	 * browser's own rendering). When set, the template renders
	 * `<path d [fill]>` instead of `<text transform>` / `slices`: exact, since
	 * every outline point is already mapped through the envelope.
	 */
	readonly outlinePath?: string;
}

/** Descriptor for the true two-curve envelope renderer. One `<text>` per glyph. */
export interface TextWarpGlyphDef {
	readonly strategy: 'glyph';
	readonly preset: PptxTextWarpPreset;
	readonly width: number;
	readonly height: number;
	readonly glyphs: WarpGlyph[];
}

/** Resolve one segment's plain (measurement-ready) font, falling back to the element's. */
function segmentFont(
	segment: TextSegment,
	elementStyle: TextStyle | undefined,
): EnvelopeSegmentInput['font'] {
	const s = segment.style ?? {};
	const family = s.fontFamily ?? elementStyle?.fontFamily;
	return {
		fontFamily: family ? getSubstituteFontFamily(family) : DEFAULT_FONT_FAMILY,
		fontSizePx: s.fontSize ?? elementStyle?.fontSize ?? DEFAULT_FONT_SIZE,
		bold: s.bold ?? elementStyle?.bold,
		italic: s.italic ?? elementStyle?.italic,
	};
}

/**
 * Build the true two-curve envelope descriptor across every paragraph.
 *
 * The paragraphs are laid out as ONE block and warped by a single mapping
 * (see `buildGlyphEnvelopeBlock` in `pptx-viewer-shared`), matching
 * PowerPoint, so a multi-paragraph block bends within the same overall
 * envelope shape and its rows keep their order. All lines' glyphs are returned as one flat array;
 * each glyph already carries its own resolved style, so the template does
 * not need to know which paragraph a glyph came from.
 *
 * @param preset       A preset for which `hasGlyphEnvelope` is true.
 * @param paragraphs   Every paragraph's text segments, in line order.
 * @param elementStyle The element's own text style, used as the per-segment fallback.
 * @param idPrefix     Deterministic id prefix (e.g. `ng-warp-${element.id}`), used to
 *                     build a unique clip-id prefix per glyph when it needs slicing.
 */
export function buildGlyphWarpDef(
	preset: PptxTextWarpPreset,
	paragraphs: WarpParagraph[],
	width: number,
	height: number,
	adj1: number | undefined,
	adj2: number | undefined,
	elementStyle: TextStyle | undefined,
	idPrefix: string,
): TextWarpGlyphDef {
	// Read (never write) the tick so a caller inside an Angular `computed()`
	// (element-renderer-shape.component.ts's `glyphWarp`) picks this function
	// up as a dependency and recomputes once a catalogue webfont's outline
	// bytes land (see glyph-outline-cache.ts).
	glyphOutlineFontsTick();
	const perLine = buildGlyphEnvelopeBlock(
		preset,
		paragraphs.map((paragraph) =>
			paragraph.segments.map((seg, i): EnvelopeSegmentInput => ({
				text: seg.text,
				font: segmentFont(seg, elementStyle),
				segmentIndex: i,
			})),
		),
		width,
		height,
		elementStyle?.align,
		adj1,
		adj2,
		getGlyphOutline,
	);
	const glyphs: WarpGlyph[] = paragraphs.flatMap((paragraph, lineIndex) => {
		const segments = paragraph.segments;
		const placements = perLine[lineIndex] ?? [];
		return placements.map((p, glyphIndex) => {
			const s = segments[p.segmentIndex]?.style ?? {};
			const family = s.fontFamily ?? elementStyle?.fontFamily;
			return {
				char: p.char,
				x: p.x,
				y: p.y,
				transform: p.transform,
				fill: s.color ?? elementStyle?.color ?? DEFAULT_COLOR,
				fontWeight: (s.bold ?? elementStyle?.bold) ? 700 : 400,
				fontStyle: (s.italic ?? elementStyle?.italic) ? 'italic' : 'normal',
				fontFamily: family ? getSubstituteFontFamily(family) : DEFAULT_FONT_FAMILY,
				fontSize: (s.fontSize ?? elementStyle?.fontSize ?? DEFAULT_FONT_SIZE) as number,
				slices: p.slices,
				clipIdPrefix: `${idPrefix}-l${lineIndex}-g${glyphIndex}`,
				outlinePath: p.outlinePath,
			};
		});
	});
	return { strategy: 'glyph', preset, width, height, glyphs };
}
