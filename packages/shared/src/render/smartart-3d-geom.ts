/**
 * Three.js SmartArt renderer - pure geometry & colour helpers.
 *
 * Outline builders (rect, rounded-rect, circle), colour-contrast picking, and
 * SVG-path/polygon-point parsing used by `buildSmartArt3DModel`. No `three`
 * import; fully unit-testable.
 */

import type { Point2 } from './smartart-3d-types';

/** Parse a `"0 0 W H"` viewBox string into `{ width, height }`. */
export function parseViewBox(viewBox: string): { width: number; height: number } {
	const parts = viewBox.trim().split(/\s+/u).map(Number);
	const width = parts[2];
	const height = parts[3];
	return {
		width: Number.isFinite(width) && width > 0 ? width : 1,
		height: Number.isFinite(height) && height > 0 ? height : 1,
	};
}

/**
 * Build a (optionally rounded) rectangle outline centred on the origin (y-up).
 *
 * @param width  Full footprint width.
 * @param height Full footprint height.
 * @param radius Corner radius; 0 yields sharp corners.
 * @param segments Arc segments per rounded corner.
 */
export function roundedRectOutline(
	width: number,
	height: number,
	radius: number,
	segments = 4,
): Point2[] {
	const hw = width / 2;
	const hh = height / 2;
	const r = Math.max(0, Math.min(radius, hw, hh));
	if (r <= 0) {
		return [
			{ x: -hw, y: -hh },
			{ x: hw, y: -hh },
			{ x: hw, y: hh },
			{ x: -hw, y: hh },
		];
	}
	const pts: Point2[] = [];
	// Corner centres, counter-clockwise from bottom-right.
	const corners: Array<{ cx: number; cy: number; start: number }> = [
		{ cx: hw - r, cy: -hh + r, start: -Math.PI / 2 },
		{ cx: hw - r, cy: hh - r, start: 0 },
		{ cx: -hw + r, cy: hh - r, start: Math.PI / 2 },
		{ cx: -hw + r, cy: -hh + r, start: Math.PI },
	];
	for (const { cx, cy, start } of corners) {
		for (let s = 0; s <= segments; s++) {
			const a = start + (s / segments) * (Math.PI / 2);
			pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
		}
	}
	return pts;
}

/** Build a circle outline centred on the origin. */
export function circleOutline(radius: number, segments = 48): Point2[] {
	const pts: Point2[] = [];
	for (let s = 0; s < segments; s++) {
		const a = (s / segments) * Math.PI * 2;
		pts.push({ x: Math.cos(a) * radius, y: Math.sin(a) * radius });
	}
	return pts;
}

/** Parse an SVG polygon `points` string (`"x,y x,y …"`) into points (y-down). */
export function parsePolygonPoints(points: string): Point2[] {
	const out: Point2[] = [];
	for (const pair of points.trim().split(/\s+/u)) {
		const [xs, ys] = pair.split(',');
		const x = Number(xs);
		const y = Number(ys);
		if (Number.isFinite(x) && Number.isFinite(y)) {
			out.push({ x, y });
		}
	}
	return out;
}

/**
 * Parse a simple SVG path (`M`/`L`/`H`/`V`, with curve commands reduced to
 * their end point) into a poly-line of absolute points (y-down). The SmartArt
 * layout engine only emits straight-segment connector paths, so this covers the
 * real input without a full path parser.
 */
export function parsePathPoints(d: string): Point2[] {
	const out: Point2[] = [];
	const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/gu);
	if (!tokens) {
		return out;
	}
	let i = 0;
	let cmd = '';
	let cur: Point2 = { x: 0, y: 0 };
	const num = (): number => Number(tokens[i++]);
	while (i < tokens.length) {
		const t = tokens[i];
		if (/[a-zA-Z]/u.test(t)) {
			cmd = t;
			i++;
		}
		const rel = cmd === cmd.toLowerCase();
		switch (cmd.toUpperCase()) {
			case 'M':
			case 'L': {
				const x = num();
				const y = num();
				cur = rel ? { x: cur.x + x, y: cur.y + y } : { x, y };
				out.push(cur);
				break;
			}
			case 'H': {
				const x = num();
				cur = { x: rel ? cur.x + x : x, y: cur.y };
				out.push(cur);
				break;
			}
			case 'V': {
				const y = num();
				cur = { x: cur.x, y: rel ? cur.y + y : y };
				out.push(cur);
				break;
			}
			case 'C': {
				// Skip the two control points; keep the curve end point.
				num();
				num();
				num();
				num();
				const x = num();
				const y = num();
				cur = rel ? { x: cur.x + x, y: cur.y + y } : { x, y };
				out.push(cur);
				break;
			}
			case 'Q': {
				num();
				num();
				const x = num();
				const y = num();
				cur = rel ? { x: cur.x + x, y: cur.y + y } : { x, y };
				out.push(cur);
				break;
			}
			default:
				i++;
		}
	}
	return out;
}

/** Axis-aligned bounding box / centroid of a set of points. */
export function boundsOf(points: Point2[]): {
	cx: number;
	cy: number;
	width: number;
	height: number;
} {
	if (points.length === 0) {
		return { cx: 0, cy: 0, width: 0, height: 0 };
	}
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (const p of points) {
		if (p.x < minX) {
			minX = p.x;
		}
		if (p.y < minY) {
			minY = p.y;
		}
		if (p.x > maxX) {
			maxX = p.x;
		}
		if (p.y > maxY) {
			maxY = p.y;
		}
	}
	return {
		cx: (minX + maxX) / 2,
		cy: (minY + maxY) / 2,
		width: maxX - minX,
		height: maxY - minY,
	};
}

/** Parse `#rgb`/`#rrggbb` into `[r, g, b]` (0..255); falls back to mid-grey. */
export function parseHex(hex: string): [number, number, number] {
	let h = hex.trim().replace(/^#/u, '');
	if (h.length === 3) {
		h = h
			.split('')
			.map((c) => c + c)
			.join('');
	}
	if (h.length !== 6 || /[^0-9a-fA-F]/u.test(h)) {
		return [128, 128, 128];
	}
	return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/**
 * Pick a readable text colour (near-black or near-white) for a given fill,
 * using the WCAG relative-luminance threshold.
 */
export function contrastTextColor(fill: string): string {
	const [r, g, b] = parseHex(fill);
	const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
	return lum > 0.6 ? '#1a1a1a' : '#ffffff';
}
