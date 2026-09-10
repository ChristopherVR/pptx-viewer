/**
 * Per-point glyph-outline warping for the WordArt two-curve envelope (see
 * `text-warp-envelope-curves.ts` / `text-warp-glyph-matrix.ts`), closing the
 * residual documented in `text-warp-glyph-slicing.ts`: a single affine (or a
 * handful of piecewise-affine slices) fit through a glyph's own edges can
 * only approximate how PowerPoint bends that glyph, because PowerPoint warps
 * the glyph's actual vector OUTLINE, point by point.
 *
 * When a glyph's outline is obtainable (the font file is available, see
 * `text-warp-outline-font-cache.ts`), this module maps EVERY outline point
 * (on-curve points and off-curve Bezier control points alike) through the
 * envelope's own top/bottom curves sampled at that point's own `x`, instead
 * of fitting one affine transform across the glyph's whole width. This is
 * exact in the sense that it reproduces PowerPoint's model precisely at
 * every point the outline defines; a control point is warped along with its
 * curve, which is the same approximation PowerPoint's own renderer makes
 * (the model does not re-parameterise a warped Bezier as a "true" warped
 * Bezier either).
 *
 * When no outline is obtainable (a system font with no embedded/catalogue
 * file, e.g. a signature font on the reader's OS with no webfont match),
 * `text-warp-envelope-layout.ts` falls back to the existing per-glyph affine
 * / piecewise-affine-slice transform, unchanged.
 */
import { edgeBandAt } from './text-warp-glyph-matrix';

/**
 * One drawing command of a glyph outline, in the SAME absolute coordinate
 * space as the (unwarped) glyph would be drawn: `x` is the line-relative
 * horizontal position (matching {@link EnvelopeGlyphPlacement.x}), `y` is the
 * nominal (undeformed) vertical position (matching the nominal band the
 * affine path already maps from). Mirrors `opentype.js`'s `PathCommand`
 * shape so a caller can pass its commands through with only a field rename,
 * without this module depending on the `opentype.js` type directly (kept
 * decoupled so the pure warp math here is trivially unit-testable without a
 * real parsed font).
 */
export type GlyphOutlineCommand =
	| { readonly type: 'M'; readonly x: number; readonly y: number }
	| { readonly type: 'L'; readonly x: number; readonly y: number }
	| {
			readonly type: 'C';
			readonly x1: number;
			readonly y1: number;
			readonly x2: number;
			readonly y2: number;
			readonly x: number;
			readonly y: number;
	  }
	| {
			readonly type: 'Q';
			readonly x1: number;
			readonly y1: number;
			readonly x: number;
			readonly y: number;
	  }
	| { readonly type: 'Z' };

/**
 * Map `y` (a point on the glyph's nominal, undeformed `[nomTop, nomBottom]`
 * band) into the envelope curve's own `[edgeTop, edgeBottom]` band at this
 * point's horizontal position, by linear interpolation of the point's
 * fractional position within the nominal band.
 *
 * Pure and preset-independent: when `edgeTop === nomTop` and
 * `edgeBottom === nomBottom` (a "straight-line" envelope, i.e. no vertical
 * deformation at this `x`), this returns `y` unchanged - the identity case a
 * caller can rely on regardless of which preset produced the edge band.
 */
export function mapYThroughEnvelopeBand(
	y: number,
	nomTop: number,
	nomBottom: number,
	edgeTop: number,
	edgeBottom: number,
): number {
	const nominalSpan = nomBottom - nomTop;
	if (nominalSpan <= 0) {
		return edgeTop;
	}
	const t = (y - nomTop) / nominalSpan;
	return edgeTop + t * (edgeBottom - edgeTop);
}

/**
 * Map one outline point `(x, y)` through `preset`'s envelope curve, sampled
 * at THIS point's own horizontal position (`u = x / width`), never at the
 * glyph's edges or centre. `x` itself is left untouched: PowerPoint's warp
 * (and the existing affine `glyphEnvelopeMatrix`) only ever displaces text
 * vertically, matching `a=1, c=0, e=0` there.
 */
export function warpEnvelopeOutlinePoint(
	preset: string,
	x: number,
	y: number,
	width: number,
	height: number,
	nomTop: number,
	nomBottom: number,
	adj: number | undefined,
	adj2: number | undefined,
	lineIndex: number,
	lineCount: number,
): { x: number; y: number } {
	const u = width > 0 ? x / width : 0.5;
	const edge = edgeBandAt(preset, u, adj, adj2, height, lineIndex, lineCount);
	return { x, y: mapYThroughEnvelopeBand(y, nomTop, nomBottom, edge.top, edge.bottom) };
}

function formatCoord(n: number): string {
	// Two decimals keeps the emitted `d` compact (a multi-glyph caption can
	// carry hundreds of points) while staying well under a visible rounding
	// error at any realistic slide scale.
	return Number.isFinite(n) ? (Math.round(n * 100) / 100).toString() : '0';
}

/**
 * Build the warped SVG path `d` string for one glyph's outline commands,
 * mapping every on-curve and off-curve point through
 * {@link warpEnvelopeOutlinePoint}.
 *
 * Returns `undefined` for an empty command list (a whitespace glyph with no
 * visible outline), so a caller can distinguish "nothing to draw" from "no
 * outline was obtainable" (the latter should fall back to the affine path).
 */
export function buildWarpedGlyphOutlinePathD(
	commands: readonly GlyphOutlineCommand[],
	preset: string,
	width: number,
	height: number,
	nomTop: number,
	nomBottom: number,
	adj: number | undefined,
	adj2: number | undefined,
	lineIndex: number,
	lineCount: number,
): string | undefined {
	if (commands.length === 0) {
		return undefined;
	}
	const map = (px: number, py: number): { x: number; y: number } =>
		warpEnvelopeOutlinePoint(
			preset,
			px,
			py,
			width,
			height,
			nomTop,
			nomBottom,
			adj,
			adj2,
			lineIndex,
			lineCount,
		);
	const parts: string[] = [];
	for (const cmd of commands) {
		switch (cmd.type) {
			case 'M': {
				const p = map(cmd.x, cmd.y);
				parts.push(`M${formatCoord(p.x)} ${formatCoord(p.y)}`);
				break;
			}
			case 'L': {
				const p = map(cmd.x, cmd.y);
				parts.push(`L${formatCoord(p.x)} ${formatCoord(p.y)}`);
				break;
			}
			case 'Q': {
				const c1 = map(cmd.x1, cmd.y1);
				const p = map(cmd.x, cmd.y);
				parts.push(
					`Q${formatCoord(c1.x)} ${formatCoord(c1.y)} ${formatCoord(p.x)} ${formatCoord(p.y)}`,
				);
				break;
			}
			case 'C': {
				const c1 = map(cmd.x1, cmd.y1);
				const c2 = map(cmd.x2, cmd.y2);
				const p = map(cmd.x, cmd.y);
				parts.push(
					`C${formatCoord(c1.x)} ${formatCoord(c1.y)} ${formatCoord(c2.x)} ${formatCoord(c2.y)} ${formatCoord(p.x)} ${formatCoord(p.y)}`,
				);
				break;
			}
			case 'Z':
				parts.push('Z');
				break;
			default:
				break;
		}
	}
	return parts.length > 0 ? parts.join('') : undefined;
}
