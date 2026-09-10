/**
 * Per-glyph placement for the two-curve WordArt envelope (see
 * `text-warp-envelope-curves.ts`).
 *
 * A binding calls {@link buildGlyphEnvelope} with the line's run segments (each
 * carrying its own font) and gets back one {@link EnvelopeGlyphPlacement} per
 * character: an `(x, y)` origin plus an SVG `transform` that maps the glyph's
 * nominal (undeformed) cap-height/baseline band onto the top/bottom envelope
 * curve, fit across that glyph's own horizontal extent (see
 * {@link glyphEnvelopeMatrix}). Rendering is then just "loop over the array,
 * emit one `<text>` per glyph with its own `transform`" - identical across
 * React/Vue/Angular/Svelte/Vanilla, matching the framework-neutral
 * `WarpPathGenerator` shape the `'path'` family already uses.
 */
import { hasGlyphEnvelope, NOMINAL_ENVELOPE_BAND } from './text-warp-envelope-curves';
import {
	measureGlyphAdvances,
	measureLineAscent,
	resetGlyphEnvelopeMeasureCache,
} from './text-warp-envelope-measure';
import type {
	EnvelopeAlign,
	EnvelopeGlyphPlacement,
	EnvelopeSegmentInput,
	GlyphOutlineLookup,
} from './text-warp-envelope-types';
import { edgeBandAt, glyphEnvelopeMatrix, sliceBand } from './text-warp-glyph-matrix';
import { buildWarpedGlyphOutlinePathD, scaleOutlineCommandsX } from './text-warp-glyph-outline';
import { buildGlyphSlices, chooseGlyphSliceCount } from './text-warp-glyph-slicing';

export type {
	EnvelopeAlign,
	EnvelopeFontSpec,
	EnvelopeGlyphPlacement,
	EnvelopeSegmentInput,
	GlyphOutlineLookup,
	GlyphOutlineLookupFont,
} from './text-warp-envelope-types';

// Re-exported for backward compatibility: these were originally defined here
// and moved to `text-warp-envelope-measure.ts` (see that module's doc
// comment) as a pure structural split, so existing callers/tests importing
// them from this module keep working unchanged.
export { measureGlyphAdvances, measureLineAscent, resetGlyphEnvelopeMeasureCache };

function startX(align: EnvelopeAlign, width: number, lineWidth: number): number {
	if (align === 'right') {
		return width - lineWidth;
	}
	if (
		align === 'left' ||
		align === 'justify' ||
		align === 'justLow' ||
		align === 'dist' ||
		align === 'thaiDist'
	) {
		return 0;
	}
	return (width - lineWidth) / 2;
}

/**
 * Build one {@link EnvelopeGlyphPlacement} per character across every segment
 * of a warped line, mapping each glyph's own horizontal extent onto the
 * preset's top/bottom envelope curve (see {@link glyphEnvelopeMatrix}).
 *
 * A multi-paragraph WordArt block bends every paragraph within the SAME
 * overall envelope: line `lineIndex` of `lineCount` occupies the
 * `[lineIndex/lineCount, (lineIndex+1)/lineCount]` vertical slice of the
 * curve's local `[top, bottom]` band at each glyph's horizontal position,
 * matching how PowerPoint distributes multiple lines across one envelope
 * shape. A single-paragraph block (the default `lineIndex=0, lineCount=1`)
 * gets the whole band, unchanged from before this parameter existed.
 *
 * Returns `[]` for a preset outside the glyph-envelope family (callers should
 * gate on {@link hasGlyphEnvelope} first; this still degrades safely).
 */
export function buildGlyphEnvelope(
	preset: string,
	segments: EnvelopeSegmentInput[],
	width: number,
	height: number,
	align: EnvelopeAlign,
	adj?: number,
	adj2?: number,
	lineIndex = 0,
	lineCount = 1,
	getGlyphOutline?: GlyphOutlineLookup,
): EnvelopeGlyphPlacement[] {
	if (!hasGlyphEnvelope(preset) || width <= 0 || height <= 0 || lineCount < 1) {
		return [];
	}
	const safeLineCount = Math.max(1, Math.floor(lineCount));
	const safeLineIndex = Math.min(Math.max(0, Math.floor(lineIndex)), safeLineCount - 1);

	const perSegmentAdvances = segments.map((seg) => measureGlyphAdvances(seg.text, seg.font));
	const lineWidth = perSegmentAdvances.reduce(
		(sum, advances) => sum + advances.reduce((s, w) => s + w, 0),
		0,
	);

	const { top: fixedBandTop, bottom: nomBottom } = sliceBand(
		height * NOMINAL_ENVELOPE_BAND.top,
		height * NOMINAL_ENVELOPE_BAND.bottom,
		safeLineIndex,
		safeLineCount,
	);
	// Prefer the line's own real ink ascent over the fixed-fraction band (see
	// `measureLineAscent`'s doc comment for why): never LOWER than the fixed
	// band's top, so a line whose font already fills (or exceeds) the nominal
	// span keeps today's behaviour unchanged.
	const realAscent = measureLineAscent(segments);
	const nomTop =
		realAscent !== undefined ? Math.max(fixedBandTop, nomBottom - realAscent) : fixedBandTop;

	// PowerPoint spaces envelope-warped glyphs edge to edge across the box's
	// own width, rather than centring the line at its natural (unstretched)
	// advance width the way `startX`/`measureGlyphAdvances` did before this
	// fix (COM-measured 2026-09-11, an 8-shape Arimo Bold fixture: measured
	// ink spans ~99.9% of box width for BOTH the `can` and `inflate`/
	// `deflate` families). `stretch` is the uniform factor (box width /
	// natural line width) that reproduces the measured glyph PITCH closely
	// (interior boundary positions within ~1-3% of box width of COM ground
	// truth) for every glyph-envelope preset tested; every glyph's advance is
	// scaled by it, so the line always spans exactly `[0, width]`.
	//
	// Whether the glyph's own SHAPE also widens by `stretch` differs by
	// family though: `shapeScale` is `stretch` for `inflate`/`deflate` (and
	// the rest of the non-`can` envelope family) - COM-measured, their
	// per-glyph ink WIDTH scales with the stretch factor, matching a literal
	// rubber-sheet distortion where letters get visibly fatter. It is `1` for
	// `textCanUp`/`textCanDown` - their per-glyph ink width stays at its
	// NATURAL (unstretched) value; only the gaps between glyphs widen,
	// matching the "wrap around a cylinder" metaphor (letters keep their own
	// proportions, spaced further apart) rather than 2D stretching. Only
	// `shapeScale` reaches the OUTLINE render path (`scaleOutlineCommandsX`
	// below): the affine-fallback `transform`/`slices` path has no
	// horizontal-scale term by design (see `glyphEnvelopeMatrix`'s `a=1, c=0,
	// e=0` doc note), so it always fits the glyph's own NATURAL (unscaled)
	// width regardless of family - an accepted simplification for the
	// secondary (no-outline-available) path.
	const isCanFamily = preset === 'textCanUp' || preset === 'textCanDown';
	const stretch = width > 0 && lineWidth > 0 ? width / lineWidth : 1;
	const shapeScale = isCanFamily ? 1 : stretch;

	const placements: EnvelopeGlyphPlacement[] = [];
	let x = lineWidth > 0 ? 0 : startX(align, width, lineWidth);

	segments.forEach((segment, segIdx) => {
		const chars = [...segment.text];
		const advances = perSegmentAdvances[segIdx];
		chars.forEach((char, i) => {
			const naturalGlyphWidth = advances[i] ?? 0;
			const pitch = naturalGlyphWidth * stretch;
			const x0 = x;
			// The affine-fit extent always uses the NATURAL (unscaled) width:
			// the affine/slice path can only ever render a glyph at its own
			// natural on-screen width (no horizontal-scale term available), so
			// fitting the curve across a wider span than what actually renders
			// would reintroduce the very mismatch this fix closes.
			const x1 = x0 + naturalGlyphWidth;
			const u0 = width > 0 ? x0 / width : 0.5;
			const u1 = width > 0 ? x1 / width : 0.5;
			const edge0 = edgeBandAt(preset, u0, adj, adj2, height, safeLineIndex, safeLineCount);
			const edge1 = edgeBandAt(preset, u1, adj, adj2, height, safeLineIndex, safeLineCount);

			// Outline warping takes priority when the caller can supply the
			// glyph's real outline: it is exact, so the affine fit (and its
			// piecewise-slice fallback) is only worth computing when it can't.
			const rawOutline = getGlyphOutline?.(char, segment.font, x0, nomBottom);
			const outlineCommands = rawOutline
				? scaleOutlineCommandsX(rawOutline, x0, shapeScale)
				: undefined;
			const outlinePath = outlineCommands
				? buildWarpedGlyphOutlinePathD(
						outlineCommands,
						preset,
						width,
						height,
						nomTop,
						nomBottom,
						adj,
						adj2,
						safeLineIndex,
						safeLineCount,
					)
				: undefined;

			const sliceCount = outlinePath
				? 1
				: chooseGlyphSliceCount(preset, u0, u1, adj, adj2, height, safeLineIndex, safeLineCount);
			placements.push({
				char,
				segmentIndex: segment.segmentIndex,
				x: x0,
				y: nomBottom,
				transform: glyphEnvelopeMatrix(x0, x1, edge0, edge1, nomTop, nomBottom),
				slices:
					sliceCount > 1
						? buildGlyphSlices(
								preset,
								x0,
								x1,
								u0,
								u1,
								adj,
								adj2,
								height,
								safeLineIndex,
								safeLineCount,
								nomTop,
								nomBottom,
								sliceCount,
							)
						: undefined,
				outlinePath,
			});
			x += pitch;
		});
	});

	return placements;
}
