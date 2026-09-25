/**
 * `lin` algorithm (ECMA-376 Part 1, 21.4.2.x Linear Flow): children are
 * placed one after another along `linDir` (`fromL` default, `fromR`,
 * `fromT`, `fromB`) at their constraint sizes plus `sibSp` spacing. When the
 * run is longer than the node, the node's reference size along the flow is
 * scaled down and its constraints re-evaluated until the run fits, so every
 * size derived from it (items, transition slots, negative overlaps) shrinks
 * together while sizes tied to the cross axis stay put. A run that is too
 * thick across the flow shrinks the same way. The run is then aligned with
 * `nodeHorzAlign`/`nodeVertAlign` (centred by default).
 */

import type { Box, EngineNode } from './engine-node';
import { evaluateWithReference } from './layout-driver';
import { preferredSize } from './preferred-size';
import type { Size } from './preferred-size';

interface Measure {
	sizes: Size[];
	total: number;
	cross: number;
	spacing: number;
}

/**
 * `uniform` scales both reference axes: "Process List"'s header is `4 x`
 * its own height, which is the whole node's height, so only shrinking the
 * cross axis shortens the row (650pt of 1599pt-wide headers: the cached
 * headers are 198 x 49.5pt, the frame height scaled by 0.124).
 */
function measure(
	node: EngineNode,
	box: Box,
	horizontal: boolean,
	scale: number,
	uniform = false,
): Measure {
	const refW = horizontal || uniform ? box.w * scale : box.w;
	const refH = !horizontal || uniform ? box.h * scale : box.h;
	evaluateWithReference(node, refW, refH);
	const sizes = node.children.map((child) =>
		boundedSize(
			child,
			preferredSize(child, horizontal ? { w: 0, h: refH } : { w: refW, h: 0 }),
			horizontal,
		),
	);
	const spacing = node.values.get('sibSp') ?? 0;
	let total = spacing * Math.max(0, sizes.length - 1);
	let cross = 0;
	for (const size of sizes) {
		total += horizontal ? size.w : size.h;
		cross = Math.max(cross, horizontal ? size.h : size.w);
	}
	return { sizes, total, cross, spacing };
}

/**
 * A child sized `INF` along either axis ("Vertical Box List"'s `parentLin`,
 * `h val="INF"`) takes its content's own extent instead: the tallest of a
 * horizontal run's items, the sum of a vertical one's. So does a nested
 * arrangement no constraint sizes along the flow ("Sub-Step Process"'s
 * `txAndLines` row inside its `fromT` column is as tall as its `desTx`).
 */
function boundedSize(child: EngineNode, size: Size, horizontal: boolean): Size {
	const nested =
		child.children.length > 0 && (child.alg.type === 'lin' || child.alg.type === 'composite');
	// A nested run no constraint sizes across the flow either is as thick as
	// its content ("Process List"'s `vertFlow` columns hang from a band as
	// tall as the tallest column, not the frame).
	const unsizedAlong = nested && !child.values.has(horizontal ? 'w' : 'h');
	const unsizedAcross =
		nested && child.alg.type === 'lin' && !isAssigned(child, horizontal ? 'h' : 'w');
	if (Number.isFinite(size.w) && Number.isFinite(size.h) && !unsizedAlong && !unsizedAcross) {
		return size;
	}
	const unsizedW = horizontal ? unsizedAlong : unsizedAcross;
	const unsizedH = horizontal ? unsizedAcross : unsizedAlong;
	const extent = (alongW: boolean): number =>
		unsizedAlong || unsizedAcross
			? measuredExtent(child, size, alongW)
			: contentExtent(child, alongW);
	return {
		w: Number.isFinite(size.w) && !unsizedW ? size.w : extent(true),
		h: Number.isFinite(size.h) && !unsizedH ? size.h : extent(false),
	};
}

/** Whether an ancestor assigned `node`'s `type`, rather than its own last layout. */
function isAssigned(node: EngineNode, type: 'w' | 'h'): boolean {
	const value = node.values.get(type);
	return value !== undefined && value !== node.selfRef?.[type];
}

/** {@link contentExtent} after evaluating `node`'s own constraints at `size` (then restored). */
function measuredExtent(node: EngineNode, size: Size, horizontal: boolean): number {
	const saved = new Map(node.values);
	evaluateWithReference(node, size.w, size.h);
	const extent = contentExtent(node, horizontal);
	node.values = saved;
	return extent;
}

function contentExtent(node: EngineNode, horizontal: boolean): number {
	const dir = node.alg.params.linDir ?? 'fromL';
	const flowsHorizontally = dir === 'fromL' || dir === 'fromR';
	const sizes = node.children.map((child) => {
		const size = preferredSize(child, { w: 0, h: 0 });
		const value = horizontal ? size.w : size.h;
		return Number.isFinite(value) ? value : 0;
	});
	if (sizes.length === 0) {
		return 0;
	}
	if (node.alg.type === 'lin' && flowsHorizontally === horizontal) {
		const spacing = node.values.get('sibSp') ?? 0;
		return sizes.reduce((sum, v) => sum + v, 0) + spacing * (sizes.length - 1);
	}
	return Math.max(0, ...sizes);
}

/** Fit the run: shrink the flow-axis reference until length and thickness fit. */
export function fitLinear(node: EngineNode, box: Box, horizontal: boolean): Measure {
	const along = horizontal ? box.w : box.h;
	const across = horizontal ? box.h : box.w;
	let scale = 1;
	let current = measure(node, box, horizontal, scale);
	const full = current;
	let crossLimited = true;
	for (let iteration = 0; iteration < 12; iteration++) {
		const fitAlong = current.total > along + 1e-6 ? along / current.total : 1;
		const fitAcross = crossLimited && current.cross > across + 1e-6 ? across / current.cross : 1;
		const factor = Math.min(fitAlong, fitAcross);
		if (factor >= 0.99999) {
			break;
		}
		const next = measure(node, box, horizontal, scale * factor);
		if (factor === fitAcross && next.cross >= current.cross - 1e-6) {
			// Thickness does not follow the flow reference; stop chasing it.
			crossLimited = false;
			current = measure(node, box, horizontal, scale);
			continue;
		}
		scale *= factor;
		current = next;
	}
	// Only a run the flow reference left clearly too long (the loop above
	// stops within 0.001% of an exact fit).
	if (current.total > along * 1.001) {
		const uniform = fitUniform(node, box, horizontal, current);
		if (uniform) {
			return uniform;
		}
	}
	return refineAlong(node, box, horizontal, scale, current, full, crossLimited);
}

/** Shrink both reference axes until a run the flow reference cannot shorten fits. */
function fitUniform(
	node: EngineNode,
	box: Box,
	horizontal: boolean,
	stuck: Measure,
): Measure | undefined {
	const along = horizontal ? box.w : box.h;
	let scale = 1;
	let current = measure(node, box, horizontal, 1, true);
	for (let iteration = 0; iteration < 12 && current.total > along + 1e-3; iteration++) {
		const next = measure(node, box, horizontal, scale * (along / current.total), true);
		if (next.total >= current.total - 1e-6) {
			break;
		}
		scale *= along / current.total;
		current = next;
	}
	if (current.total >= stuck.total - 1e-6) {
		return undefined;
	}
	return current;
}

/**
 * Shrinking by `along / total` undershoots when part of the run does not
 * scale with the reference (a fixed or negative `sibSp`, a literal spacer
 * width): "Basic Chevron Process"'s `-6mm` overlaps leave the three chevrons
 * 23pt short of the 650pt row after one step. The run's length is linear in
 * the reference scale, so a secant step between the unscaled measure and the
 * shrunk one lands on the exact scale that fills the row.
 */
function refineAlong(
	node: EngineNode,
	box: Box,
	horizontal: boolean,
	scale: number,
	current: Measure,
	full: Measure,
	crossLimited: boolean,
): Measure {
	const along = horizontal ? box.w : box.h;
	const across = horizontal ? box.h : box.w;
	let best = current;
	let s0 = 1;
	let t0 = full.total;
	let s1 = scale;
	let t1 = current.total;
	for (let i = 0; i < 6 && s1 < 1 && Math.abs(t1 - along) > 1e-3 && Math.abs(t0 - t1) > 1e-9; i++) {
		const next = Math.min(1, Math.max(1e-6, s1 + ((along - t1) * (s0 - s1)) / (t0 - t1)));
		const measured = measure(node, box, horizontal, next);
		if (measured.total > along + 1e-3 || (crossLimited && measured.cross > across + 1e-6)) {
			break;
		}
		best = measured;
		s0 = s1;
		t0 = t1;
		s1 = next;
		t1 = measured.total;
	}
	if (best !== current) {
		return best;
	}
	// Leave the node's values as the kept measure evaluated them.
	return measure(node, box, horizontal, scale);
}

function alignOffset(free: number, align: string | undefined, start: string, end: string): number {
	if (align === start) {
		return 0;
	}
	if (align === end) {
		return free;
	}
	return free / 2;
}

export function arrangeLinear(node: EngineNode): void {
	const box = node.box;
	if (!box || node.children.length === 0) {
		return;
	}
	const params = node.alg.params;
	const dir = params.linDir ?? 'fromL';
	const horizontal = dir === 'fromL' || dir === 'fromR';
	const reverse = dir === 'fromR' || dir === 'fromB';
	const fitted = fitLinear(node, box, horizontal);
	const along = horizontal ? box.w : box.h;
	const across = horizontal ? box.h : box.w;
	const groupOffset = horizontal
		? alignOffset(along - fitted.total, params.nodeHorzAlign, 'l', 'r')
		: alignOffset(along - fitted.total, params.nodeVertAlign, 't', 'b');
	// The run's own band (its thickest item) sits in the node per
	// `vertAlign`/`horzAlign` (centred by default), and each item in the band
	// per `nodeVertAlign`/`nodeHorzAlign`: "Process List"'s columns hang from
	// the top of a band centred in the frame.
	const band = Math.min(across, fitted.cross);
	const bandOffset = horizontal
		? alignOffset(across - band, params.vertAlign, 't', 'b')
		: alignOffset(across - band, params.horzAlign, 'l', 'r');
	let cursor = groupOffset;
	node.children.forEach((child, index) => {
		const size = fitted.sizes[index];
		const length = horizontal ? size.w : size.h;
		const thickness = horizontal ? size.h : size.w;
		const crossOffset =
			bandOffset +
			(horizontal
				? alignOffset(band - thickness, params.nodeVertAlign, 't', 'b')
				: alignOffset(band - thickness, params.nodeHorzAlign, 'l', 'r'));
		const start = reverse ? along - cursor - length : cursor;
		child.box = horizontal
			? { x: box.x + start, y: box.y + crossOffset, w: size.w, h: size.h }
			: { x: box.x + crossOffset, y: box.y + start, w: size.w, h: size.h };
		cursor += length + fitted.spacing;
	});
}
