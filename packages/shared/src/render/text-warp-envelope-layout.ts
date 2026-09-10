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
import { DEFAULT_FONT_FAMILY, DEFAULT_TEXT_FONT_SIZE } from '../constants';
import { hasGlyphEnvelope, NOMINAL_ENVELOPE_BAND } from './text-warp-envelope-curves';
import type {
	EnvelopeAlign,
	EnvelopeFontSpec,
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

let measureCtx: CanvasRenderingContext2D | null | undefined;

function getMeasureCtx(): CanvasRenderingContext2D | null {
	if (measureCtx !== undefined) {
		return measureCtx;
	}
	if (typeof document === 'undefined') {
		measureCtx = null;
		return null;
	}
	measureCtx = document.createElement('canvas').getContext('2d');
	return measureCtx;
}

function toCanvasFont(font: EnvelopeFontSpec): string {
	const size = font.fontSizePx && font.fontSizePx > 0 ? font.fontSizePx : DEFAULT_TEXT_FONT_SIZE;
	const family = font.fontFamily || DEFAULT_FONT_FAMILY;
	return `${font.italic ? 'italic ' : ''}${font.bold ? 'bold ' : ''}${size}px ${family}`;
}

/**
 * Per-character advance widths for `text` set in `font`, measured as prefix
 * differences (never a lone character: see `text-metric-tracking.ts`'s
 * `advancesOf` for why - shaped scripts and ligatures need the context).
 *
 * Falls back to a flat `0.55em`-per-character estimate when there is no DOM
 * to measure with (SSR, or a test environment without a 2D canvas context);
 * the estimate only affects horizontal glyph spacing, never the envelope
 * curve itself, so it stays visually reasonable even when approximate.
 */
export function measureGlyphAdvances(text: string, font: EnvelopeFontSpec): number[] {
	const chars = [...text];
	const ctx = getMeasureCtx();
	if (!ctx) {
		const size = font.fontSizePx && font.fontSizePx > 0 ? font.fontSizePx : DEFAULT_TEXT_FONT_SIZE;
		return chars.map(() => size * 0.55);
	}
	ctx.font = toCanvasFont(font);
	const advances: number[] = [];
	let previous = 0;
	let prefix = '';
	for (const char of chars) {
		prefix += char;
		const width = ctx.measureText(prefix).width;
		advances.push(Math.max(0, width - previous));
		previous = width;
	}
	return advances;
}

/**
 * The real (ink-measured) ascent of `segments`' text at their own font
 * sizes, as the tallest `actualBoundingBoxAscent` across every segment on
 * the line (not a per-character average - one tall glyph anywhere on the
 * line sets the reference the whole line warps against, matching how a
 * single baseline/cap-height pair governs a real text run).
 *
 * `buildGlyphEnvelope` used to map every glyph's nominal band from a FIXED
 * `NOMINAL_ENVELOPE_BAND` fraction of the box height (0.15..0.85), assuming
 * a glyph's own cap height fills that whole span. COM-measured (2026-09-11,
 * `text-warp-glyph-outline.ts`'s doc comment): for an 8-shape WordArt
 * fixture (Arimo Bold 44pt captions in 100pt-tall boxes, the `textCanUp` /
 * `textCanDown` / `textInflate` / `textDeflate` presets at both default and
 * extreme `adj`), real cap height reaches only about `t = 0.57` of that
 * nominal span, not `t = 0`, so every glyph's mapped top undershot the
 * curve's own top edge by the same amount - an outline-vs-COM interior-
 * column ink-scan comparison measured ~30-40% of box height mean error (max
 * 58-80%) on BOTH the outline path and the affine fallback alike (both use
 * this same nominal band, so both shared the bug identically: the residual
 * lived here, not in the outline point-mapping math). Anchoring `nomTop` to
 * the line's REAL measured ascent instead - clamped to never exceed the
 * historical fixed band, so a line whose font genuinely fills (or exceeds)
 * the nominal span keeps the old, already-validated behaviour unchanged -
 * dropped the `textInflate`/`textDeflate` interior mean error to ~2.6-2.9%
 * (max ~9-10%), in the range `text-warp-glyph-slicing.ts`'s doc comment
 * already documents as the residual once this band mismatch is not also
 * present. The `textCanUp`/`textCanDown` cases still show an elevated
 * residual (their interior mean measured ~6-20% even after this fix) that
 * further investigation traced to a SEPARATE, larger issue: real PowerPoint
 * spaces envelope-warped glyphs to fill the box's own width edge-to-edge
 * (measured ink spanning ~99.9% of box width) rather than centering the
 * text at its natural (unstretched) advance width the way `startX`/
 * `measureGlyphAdvances` do today, with `textCanUp`/`textCanDown` additionally
 * showing non-uniform (cylinder-projection-like) horizontal spacing this fix
 * does not address - both are horizontal-layout gaps, out of scope for this
 * (purely vertical) band fix and left as an open, separately-scoped issue.
 *
 * Returns `undefined` with no DOM (SSR, or a test environment without a 2D
 * canvas context), so a caller falls back to the previous fixed-fraction
 * band unchanged, exactly like {@link measureGlyphAdvances}'s own fallback.
 */
export function measureLineAscent(segments: EnvelopeSegmentInput[]): number | undefined {
	const ctx = getMeasureCtx();
	if (!ctx) {
		return undefined;
	}
	let maxAscent = 0;
	for (const segment of segments) {
		if (!segment.text) {
			continue;
		}
		ctx.font = toCanvasFont(segment.font);
		const ascent = ctx.measureText(segment.text).actualBoundingBoxAscent;
		if (Number.isFinite(ascent) && ascent > maxAscent) {
			maxAscent = ascent;
		}
	}
	return maxAscent > 0 ? maxAscent : undefined;
}

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

/** Test hook: forget the cached measurement context. */
export function resetGlyphEnvelopeMeasureCache(): void {
	measureCtx = undefined;
}
