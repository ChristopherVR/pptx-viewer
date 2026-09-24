/**
 * Marching-squares iso-contouring of a coverage raster, for
 * `text-warp-glyph-trace.ts`. Pure (no DOM): takes a `w` x `h` array of
 * coverage values in `[0, 1]` (row-major, sampled at pixel centres) and
 * returns closed rings at `level`, with edge crossings linearly interpolated
 * for sub-pixel accuracy.
 *
 * Rings are oriented for the SVG `nonzero` fill rule: a ring nested inside
 * an even number of other rings (an outer contour) winds one way, one nested
 * inside an odd number (a counter, like the hole of an `o`) the other way.
 */
import type { OutlinePoint } from './text-warp-glyph-outline';

type EdgeKey = number;

function signedArea(ring: OutlinePoint[]): number {
	let area = 0;
	for (let i = 0; i < ring.length; i++) {
		const a = ring[i];
		const b = ring[(i + 1) % ring.length];
		area += a.x * b.y - b.x * a.y;
	}
	return area / 2;
}

function pointInRing(p: OutlinePoint, ring: OutlinePoint[]): boolean {
	let inside = false;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		const a = ring[i];
		const b = ring[j];
		if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
			inside = !inside;
		}
	}
	return inside;
}

/**
 * Contour `values` at `level`. The outermost row/column are treated as
 * below `level`, so every ring closes.
 */
export function contourRaster(
	values: Float32Array,
	w: number,
	h: number,
	level: number,
): OutlinePoint[][] {
	const at = (x: number, y: number): number =>
		x < 0 || y < 0 || x >= w || y >= h ? 0 : values[y * w + x];
	// Edge keys: horizontal edge (x,y)-(x+1,y) and vertical edge (x,y)-(x,y+1),
	// over the padded grid [-1, w] x [-1, h].
	const stride = w + 2;
	const hKey = (x: number, y: number): EdgeKey => ((y + 1) * stride + (x + 1)) * 2;
	const vKey = (x: number, y: number): EdgeKey => ((y + 1) * stride + (x + 1)) * 2 + 1;
	const points = new Map<EdgeKey, OutlinePoint>();
	const point = (key: EdgeKey, x: number, y: number, horizontal: boolean): EdgeKey => {
		if (!points.has(key)) {
			const a = at(x, y);
			const b = horizontal ? at(x + 1, y) : at(x, y + 1);
			const t = b !== a ? (level - a) / (b - a) : 0.5;
			points.set(key, horizontal ? { x: x + t, y } : { x, y: y + t });
		}
		return key;
	};
	type Side = 'top' | 'bottom' | 'left' | 'right';
	const edge = (side: Side, x: number, y: number): EdgeKey => {
		switch (side) {
			case 'top':
				return point(hKey(x, y), x, y, true);
			case 'bottom':
				return point(hKey(x, y + 1), x, y + 1, true);
			case 'left':
				return point(vKey(x, y), x, y, false);
			default:
				return point(vKey(x + 1, y), x + 1, y, false);
		}
	};
	const links = new Map<EdgeKey, EdgeKey[]>();
	const link = (a: EdgeKey, b: EdgeKey): void => {
		(links.get(a) ?? links.set(a, []).get(a) ?? []).push(b);
		(links.get(b) ?? links.set(b, []).get(b) ?? []).push(a);
	};
	for (let y = -1; y < h; y++) {
		for (let x = -1; x < w; x++) {
			const tl = at(x, y) >= level ? 1 : 0;
			const tr = at(x + 1, y) >= level ? 1 : 0;
			const br = at(x + 1, y + 1) >= level ? 1 : 0;
			const bl = at(x, y + 1) >= level ? 1 : 0;
			const code = tl * 8 + tr * 4 + br * 2 + bl;
			if (code === 0 || code === 15) {
				continue;
			}
			const centre = (at(x, y) + at(x + 1, y) + at(x + 1, y + 1) + at(x, y + 1)) / 4 >= level;
			switch (code) {
				case 1:
				case 14:
					link(edge('left', x, y), edge('bottom', x, y));
					break;
				case 2:
				case 13:
					link(edge('bottom', x, y), edge('right', x, y));
					break;
				case 3:
				case 12:
					link(edge('left', x, y), edge('right', x, y));
					break;
				case 4:
				case 11:
					link(edge('top', x, y), edge('right', x, y));
					break;
				case 6:
				case 9:
					link(edge('top', x, y), edge('bottom', x, y));
					break;
				case 7:
				case 8:
					link(edge('left', x, y), edge('top', x, y));
					break;
				case 5:
					if (centre) {
						link(edge('left', x, y), edge('top', x, y));
						link(edge('bottom', x, y), edge('right', x, y));
					} else {
						link(edge('left', x, y), edge('bottom', x, y));
						link(edge('top', x, y), edge('right', x, y));
					}
					break;
				case 10:
					if (centre) {
						link(edge('left', x, y), edge('bottom', x, y));
						link(edge('top', x, y), edge('right', x, y));
					} else {
						link(edge('left', x, y), edge('top', x, y));
						link(edge('bottom', x, y), edge('right', x, y));
					}
					break;
				default:
					break;
			}
		}
	}
	const rings: OutlinePoint[][] = [];
	const visited = new Set<EdgeKey>();
	for (const startKey of links.keys()) {
		if (visited.has(startKey)) {
			continue;
		}
		const ring: OutlinePoint[] = [];
		let prev: EdgeKey | undefined;
		let current: EdgeKey | undefined = startKey;
		while (current !== undefined && !visited.has(current)) {
			visited.add(current);
			ring.push(points.get(current) as OutlinePoint);
			let next: EdgeKey | undefined;
			for (const k of links.get(current) ?? []) {
				if (k !== prev && !visited.has(k)) {
					next = k;
					break;
				}
			}
			prev = current;
			current = next;
		}
		if (ring.length >= 3) {
			rings.push(ring);
		}
	}
	return rings.map((ring, i) => {
		const depth = rings.reduce(
			(n, other, j) => (j !== i && pointInRing(ring[0], other) ? n + 1 : n),
			0,
		);
		const wantPositive = depth % 2 === 0;
		return signedArea(ring) > 0 === wantPositive ? ring : ring.slice().reverse();
	});
}
