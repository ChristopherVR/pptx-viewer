import { layoutEnvelopeBlock } from './text-warp-envelope-block';
import type { EnvelopeBlockGlyph } from './text-warp-envelope-block';
/**
 * Per-glyph placement for the WordArt two-curve envelope presets
 * (inflate/deflate/can, see `text-warp-envelope-curves.ts`).
 *
 * A binding calls {@link buildGlyphEnvelopeBlock} once with every paragraph's
 * run segments and gets back one {@link EnvelopeGlyphPlacement} per character
 * per paragraph. Rendering is then "loop over the arrays and emit one element
 * per glyph": a warped `<path>` when `outlinePath` is present (the exact
 * outline warp), otherwise a `<text x y transform>` (optionally in clipped
 * `slices`) - identical across React/Vue/Angular/Svelte/Vanilla.
 *
 * The pipeline is PowerPoint's own, COM-derived (2026-09-24):
 *  1. `layoutEnvelopeBlock` lays the paragraphs out unwarped as one block and
 *     measures its box (ink vertically; ink plus whitespace advances
 *     horizontally).
 *  2. `createEnvelopeWarp` maps that box onto the preset's top/bottom paths,
 *     placing horizontal position by ARC LENGTH along each path.
 *  3. Each glyph's outline is warped point by point
 *     (`buildWarpedGlyphOutlinePathD`); a glyph with no obtainable outline
 *     falls back to an affine / sliced-affine fit of the same mapping.
 *
 * Because the whole block is one continuous, monotone mapping, a short and
 * heavily stretched paragraph can no longer cross its neighbour: rows keep
 * the order and spacing they have in the unwarped block.
 */
import { hasGlyphEnvelope } from './text-warp-envelope-curves';
import { createEnvelopeWarp } from './text-warp-envelope-map';
import type { EnvelopeWarp } from './text-warp-envelope-map';
import {
	envelopeFontSizePx,
	measureGlyphAdvances,
	resetGlyphEnvelopeMeasureCache,
} from './text-warp-envelope-measure';
import type {
	EnvelopeAlign,
	EnvelopeGlyphPlacement,
	EnvelopeSegmentInput,
	GlyphOutlineLookup,
} from './text-warp-envelope-types';
import { buildWarpedGlyphOutlinePathD } from './text-warp-glyph-outline';
import { fitGlyphEnvelopeAffine } from './text-warp-glyph-slicing';

export type {
	EnvelopeAlign,
	EnvelopeFontSpec,
	EnvelopeGlyphPlacement,
	EnvelopeSegmentInput,
	GlyphOutlineLookup,
	GlyphOutlineLookupFont,
} from './text-warp-envelope-types';

// Re-exported for backward compatibility with callers/tests importing them
// from this module.
export { measureGlyphAdvances, resetGlyphEnvelopeMeasureCache };

/** Outline pieces are flattened to at most this fraction of the block width. */
const FLATTEN_FRACTION = 1 / 240;

function placeGlyph(
	glyph: EnvelopeBlockGlyph,
	warp: EnvelopeWarp,
	maxSegment: number,
	shapeHeight: number,
): EnvelopeGlyphPlacement {
	const base = {
		char: glyph.char,
		segmentIndex: glyph.segmentIndex,
		x: glyph.x,
		y: glyph.baseline,
	};
	const outlinePath = glyph.outline
		? buildWarpedGlyphOutlinePathD(glyph.outline, warp, maxSegment)
		: undefined;
	if (outlinePath) {
		const origin = warp.map(glyph.x, glyph.baseline);
		const dx = origin.x - glyph.x;
		const dy = origin.y - glyph.baseline;
		return { ...base, transform: `matrix(1 0 0 1 ${dx} ${dy})`, outlinePath };
	}
	const size = envelopeFontSizePx(glyph.font);
	const box = glyph.ink
		? { x0: glyph.ink.left, x1: glyph.ink.right, y0: glyph.ink.top, y1: glyph.ink.bottom }
		: {
				x0: glyph.x,
				x1: glyph.x + Math.max(glyph.advance, 1e-3),
				y0: glyph.baseline - size * 0.72,
				y1: glyph.baseline,
			};
	const fit = fitGlyphEnvelopeAffine(warp, box, shapeHeight);
	return { ...base, transform: fit.transform, slices: fit.slices };
}

/**
 * Build every paragraph's glyph placements for one envelope-warped text
 * block in a `width` x `height` shape box. Returns one array per paragraph
 * (in order), each empty when the preset is outside the envelope family, the
 * box is degenerate, or the block has no ink at all.
 */
export function buildGlyphEnvelopeBlock(
	preset: string,
	paragraphs: EnvelopeSegmentInput[][],
	width: number,
	height: number,
	align: EnvelopeAlign,
	adj?: number,
	adj2?: number,
	getGlyphOutline?: GlyphOutlineLookup,
): EnvelopeGlyphPlacement[][] {
	const empty = paragraphs.map((): EnvelopeGlyphPlacement[] => []);
	if (!hasGlyphEnvelope(preset) || !(width > 0) || !(height > 0)) {
		return empty;
	}
	const layout = layoutEnvelopeBlock(paragraphs, align, getGlyphOutline);
	if (!layout.box) {
		return empty;
	}
	const warp = createEnvelopeWarp(preset, width, height, adj, adj2, layout.box);
	if (!warp) {
		return empty;
	}
	const maxSegment = Math.max(1e-3, (layout.box.right - layout.box.left) * FLATTEN_FRACTION);
	return layout.lines.map((line) =>
		line.map((glyph) => placeGlyph(glyph, warp, maxSegment, height)),
	);
}

/**
 * Single-paragraph convenience wrapper around {@link buildGlyphEnvelopeBlock}:
 * the placements for a block that consists of `segments` alone.
 */
export function buildGlyphEnvelope(
	preset: string,
	segments: EnvelopeSegmentInput[],
	width: number,
	height: number,
	align: EnvelopeAlign,
	adj?: number,
	adj2?: number,
	getGlyphOutline?: GlyphOutlineLookup,
): EnvelopeGlyphPlacement[] {
	return (
		buildGlyphEnvelopeBlock(
			preset,
			[segments],
			width,
			height,
			align,
			adj,
			adj2,
			getGlyphOutline,
		)[0] ?? []
	);
}
