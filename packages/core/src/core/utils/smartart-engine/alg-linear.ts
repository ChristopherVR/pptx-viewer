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

function measure(node: EngineNode, box: Box, horizontal: boolean, scale: number): Measure {
	const refW = horizontal ? box.w * scale : box.w;
	const refH = horizontal ? box.h : box.h * scale;
	evaluateWithReference(node, refW, refH);
	const sizes = node.children.map((child) =>
		preferredSize(child, horizontal ? { w: 0, h: refH } : { w: refW, h: 0 }),
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

/** Fit the run: shrink the flow-axis reference until length and thickness fit. */
export function fitLinear(node: EngineNode, box: Box, horizontal: boolean): Measure {
	const along = horizontal ? box.w : box.h;
	const across = horizontal ? box.h : box.w;
	let scale = 1;
	let current = measure(node, box, horizontal, scale);
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
	return current;
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
	let cursor = groupOffset;
	node.children.forEach((child, index) => {
		const size = fitted.sizes[index];
		const length = horizontal ? size.w : size.h;
		const thickness = horizontal ? size.h : size.w;
		const crossOffset = horizontal
			? alignOffset(across - thickness, params.nodeVertAlign, 't', 'b')
			: alignOffset(across - thickness, params.nodeHorzAlign, 'l', 'r');
		const start = reverse ? along - cursor - length : cursor;
		child.box = horizontal
			? { x: box.x + start, y: box.y + crossOffset, w: size.w, h: size.h }
			: { x: box.x + crossOffset, y: box.y + start, w: size.w, h: size.h };
		cursor += length + fitted.spacing;
	});
}
