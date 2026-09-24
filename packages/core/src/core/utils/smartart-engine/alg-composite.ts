/**
 * `composite` algorithm (ECMA-376 Part 1, 21.4.2.x): every child is placed by
 * its own `l`/`t`/`r`/`b`/`w`/`h`/`ctrX`/`ctrY` values (plus the `*Off`
 * offsets), relative to the composite's top-left corner. A dimension no
 * constraint fixes defaults to the composite's own; an unset position
 * defaults to the origin.
 */

import type { Box, EngineNode } from './engine-node';
import { evaluateWithReference } from './layout-driver';
import { preferredSize } from './preferred-size';

function resolveAxis(
	values: Map<string, number>,
	size: number,
	near: string,
	far: string,
	center: string,
): number {
	const start = values.get(near);
	if (start !== undefined) {
		return start;
	}
	const end = values.get(far);
	if (end !== undefined) {
		return end - size;
	}
	const mid = values.get(center);
	if (mid !== undefined) {
		return mid - size / 2;
	}
	return 0;
}

function resolveSize(
	values: Map<string, number>,
	preferred: number,
	hasOwn: boolean,
	near: string,
	far: string,
	center: string,
): number {
	if (hasOwn) {
		return preferred;
	}
	const start = values.get(near);
	const end = values.get(far);
	if (start !== undefined && end !== undefined) {
		return end - start;
	}
	const mid = values.get(center);
	if (mid !== undefined && start !== undefined) {
		return (mid - start) * 2;
	}
	if (mid !== undefined && end !== undefined) {
		return (end - mid) * 2;
	}
	return preferred;
}

/** Place every child relative to `box`'s top-left corner. */
export function compositeChildBoxes(node: EngineNode, box: Box): void {
	for (const child of node.children) {
		const hasW = child.values.has('w');
		const hasH = child.values.has('h');
		const preferred = preferredSize(child, { w: box.w, h: box.h });
		const values = child.values;
		const w =
			resolveSize(values, preferred.w, hasW || values.has('w'), 'l', 'r', 'ctrX') +
			(values.get('wOff') ?? 0);
		const h =
			resolveSize(values, preferred.h, hasH || values.has('h'), 't', 'b', 'ctrY') +
			(values.get('hOff') ?? 0);
		const l =
			resolveAxis(values, w, 'l', 'r', 'ctrX') +
			(values.get('lOff') ?? 0) +
			(values.get('ctrXOff') ?? 0);
		const t =
			resolveAxis(values, h, 't', 'b', 'ctrY') +
			(values.get('tOff') ?? 0) +
			(values.get('ctrYOff') ?? 0);
		child.box = { x: box.x + l, y: box.y + t, w, h };
	}
}

function alignStart(free: number, align: string | undefined, start: string, end: string): number {
	if (align === start) {
		return 0;
	}
	if (align === end) {
		return free;
	}
	return free / 2;
}

/**
 * The composite's working box: the whole node, or, with an `ar` (aspect
 * ratio, width / height) parameter, the largest box of that aspect that fits,
 * aligned by `horzAlign`/`vertAlign` (centred by default).
 */
export function compositeFrame(node: EngineNode, box: Box): Box {
	const ratio = Number(node.alg.params.ar);
	if (!Number.isFinite(ratio) || ratio <= 0 || box.w <= 0 || box.h <= 0) {
		return box;
	}
	const w = Math.min(box.w, box.h * ratio);
	const h = w / ratio;
	return {
		x: box.x + alignStart(box.w - w, node.alg.params.horzAlign, 'l', 'r'),
		y: box.y + alignStart(box.h - h, node.alg.params.vertAlign, 't', 'b'),
		w,
		h,
	};
}

export function arrangeComposite(node: EngineNode): void {
	const box = node.box;
	if (!box) {
		return;
	}
	const frame = compositeFrame(node, box);
	if (frame !== box) {
		evaluateWithReference(node, frame.w, frame.h);
	}
	compositeChildBoxes(node, frame);
	alignChildren(node, frame);
}

/**
 * Align the children's bounding box inside the frame per `horzAlign`/
 * `vertAlign` (centred by default; `none` leaves the constraint positions).
 */
function alignChildren(node: EngineNode, frame: Box): void {
	const boxes = node.children.map((child) => child.box).filter((b): b is Box => Boolean(b));
	if (boxes.length === 0) {
		return;
	}
	const left = Math.min(...boxes.map((b) => b.x));
	const top = Math.min(...boxes.map((b) => b.y));
	const right = Math.max(...boxes.map((b) => b.x + b.w));
	const bottom = Math.max(...boxes.map((b) => b.y + b.h));
	const horz = node.alg.params.horzAlign;
	const vert = node.alg.params.vertAlign;
	const dx =
		horz === 'none' ? 0 : frame.x + alignStart(frame.w - (right - left), horz, 'l', 'r') - left;
	const dy =
		vert === 'none' ? 0 : frame.y + alignStart(frame.h - (bottom - top), vert, 't', 'b') - top;
	if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) {
		return;
	}
	for (const b of boxes) {
		b.x += dx;
		b.y += dy;
	}
}
