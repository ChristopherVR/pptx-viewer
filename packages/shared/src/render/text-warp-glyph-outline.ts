/**
 * Per-point glyph-outline warping for the WordArt two-curve envelope.
 *
 * PowerPoint warps a glyph's actual vector outline point by point through
 * the envelope mapping (`text-warp-envelope-map.ts`). This module takes a
 * glyph's outline commands (from a parsed font file, see
 * `text-warp-outline-font-cache.ts`, or traced from the browser's own
 * rendering of the glyph, see `text-warp-glyph-trace.ts`), flattens every
 * straight line and Bezier curve into short segments, and maps each point
 * through the warp. Flattening matters: the warp bends straight lines (a
 * stem's top edge follows the `can` arc), so warping only a segment's end
 * points would keep it straight where PowerPoint curves it.
 */
import type { EnvelopeWarp } from './text-warp-envelope-map';

/**
 * One drawing command of a glyph outline, in the unwarped layout coordinate
 * space (the glyph positioned at its layout origin and scaled to its font
 * size). Mirrors `opentype.js`'s `PathCommand` shape so a caller can pass its
 * commands through with only a field rename, without this module depending
 * on the `opentype.js` type directly.
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

/** A 2-D point. */
export interface OutlinePoint {
	x: number;
	y: number;
}

/** Sub-segments per Bezier curve when flattening. */
const CURVE_STEPS = 8;

/**
 * Flatten `commands` into closed polylines (one per contour), splitting
 * straight lines so no piece is longer than `maxSegment`.
 */
export function flattenOutline(
	commands: readonly GlyphOutlineCommand[],
	maxSegment: number,
): OutlinePoint[][] {
	const contours: OutlinePoint[][] = [];
	let current: OutlinePoint[] = [];
	let pen: OutlinePoint = { x: 0, y: 0 };
	let start: OutlinePoint = pen;
	const lineTo = (to: OutlinePoint): void => {
		const len = Math.hypot(to.x - pen.x, to.y - pen.y);
		const steps = maxSegment > 0 ? Math.max(1, Math.ceil(len / maxSegment)) : 1;
		for (let i = 1; i <= steps; i++) {
			const f = i / steps;
			current.push({ x: pen.x + (to.x - pen.x) * f, y: pen.y + (to.y - pen.y) * f });
		}
		pen = to;
	};
	const closeContour = (): void => {
		if (current.length > 1) {
			contours.push(current);
		}
		current = [];
	};
	for (const cmd of commands) {
		switch (cmd.type) {
			case 'M':
				closeContour();
				pen = { x: cmd.x, y: cmd.y };
				start = pen;
				current.push(pen);
				break;
			case 'L':
				lineTo({ x: cmd.x, y: cmd.y });
				break;
			case 'Q': {
				const p0 = pen;
				for (let i = 1; i <= CURVE_STEPS; i++) {
					const t = i / CURVE_STEPS;
					const mt = 1 - t;
					lineTo({
						x: mt * mt * p0.x + 2 * mt * t * cmd.x1 + t * t * cmd.x,
						y: mt * mt * p0.y + 2 * mt * t * cmd.y1 + t * t * cmd.y,
					});
				}
				break;
			}
			case 'C': {
				const p0 = pen;
				for (let i = 1; i <= CURVE_STEPS; i++) {
					const t = i / CURVE_STEPS;
					const mt = 1 - t;
					const a = mt * mt * mt;
					const b = 3 * mt * mt * t;
					const c = 3 * mt * t * t;
					const d = t * t * t;
					lineTo({
						x: a * p0.x + b * cmd.x1 + c * cmd.x2 + d * cmd.x,
						y: a * p0.y + b * cmd.y1 + c * cmd.y2 + d * cmd.y,
					});
				}
				break;
			}
			case 'Z':
				lineTo(start);
				closeContour();
				pen = start;
				break;
			default:
				break;
		}
	}
	closeContour();
	return contours;
}

/** The ink bounding box of `commands` (curves included), or `undefined` when empty. */
export function outlineBounds(
	commands: readonly GlyphOutlineCommand[],
): { left: number; top: number; right: number; bottom: number } | undefined {
	let left = Infinity;
	let top = Infinity;
	let right = -Infinity;
	let bottom = -Infinity;
	for (const contour of flattenOutline(commands, 0)) {
		for (const p of contour) {
			left = Math.min(left, p.x);
			right = Math.max(right, p.x);
			top = Math.min(top, p.y);
			bottom = Math.max(bottom, p.y);
		}
	}
	return Number.isFinite(left) ? { left, top, right, bottom } : undefined;
}

function formatCoord(n: number): string {
	// Two decimals keeps the emitted `d` compact while staying well under a
	// visible rounding error at any realistic slide scale.
	return Number.isFinite(n) ? (Math.round(n * 100) / 100).toString() : '0';
}

/**
 * Build the warped SVG path `d` for one glyph's outline: every contour is
 * flattened (pieces no longer than `maxSegment` layout units) and each point
 * mapped through `warp`. Returns `undefined` for an empty outline (a
 * whitespace glyph), so a caller can tell "nothing to draw" from "no outline".
 */
export function buildWarpedGlyphOutlinePathD(
	commands: readonly GlyphOutlineCommand[],
	warp: EnvelopeWarp,
	maxSegment: number,
): string | undefined {
	const parts: string[] = [];
	for (const contour of flattenOutline(commands, maxSegment)) {
		contour.forEach((p, i) => {
			const q = warp.map(p.x, p.y);
			parts.push(`${i === 0 ? 'M' : 'L'}${formatCoord(q.x)} ${formatCoord(q.y)}`);
		});
		parts.push('Z');
	}
	return parts.length > 0 ? parts.join('') : undefined;
}
