/**
 * The drawn extent of one hierarchy node (a `hierRoot`'s own content parts,
 * usually one `composite`), in the definition's unscaled space.
 */

import { arrangeComposite } from './alg-composite';
import type { EngineNode } from './engine-node';
import { evaluateWithReference } from './layout-driver';

export interface NodeSize {
	/** The drawn extent the node occupies in its tree. */
	w: number;
	h: number;
	/** Each part's own size, and its offset inside that extent. */
	partW: number;
	partH: number;
	dx: number;
	dy: number;
}

/**
 * The node's drawn extent: its content parts' own `w`/`h`, widened to
 * whatever their children reach once the composite lays them out ("Name and
 * Title Organization Chart"'s title box runs from `0.2 w` to `1.1 w`, so the
 * node occupies more than its composite's own width).
 */
export function nodeSize(parts: readonly EngineNode[]): NodeSize {
	let partW = 0;
	let partH = 0;
	for (const part of parts) {
		partW = Math.max(partW, part.values.get('w') ?? 0);
		partH = Math.max(partH, part.values.get('h') ?? 0);
	}
	let x0 = 0;
	let y0 = 0;
	let x1 = partW;
	let y1 = partH;
	for (const part of parts) {
		if (part.alg.type !== 'composite' || !(partW > 0) || !(partH > 0)) {
			continue;
		}
		part.box = { x: 0, y: 0, w: partW, h: partH };
		evaluateWithReference(part, partW, partH);
		arrangeComposite(part);
		for (const child of part.children) {
			const b = child.box;
			if (!b || !(b.w > 0) || !(b.h > 0)) {
				continue;
			}
			x0 = Math.min(x0, b.x);
			y0 = Math.min(y0, b.y);
			x1 = Math.max(x1, b.x + b.w);
			y1 = Math.max(y1, b.y + b.h);
		}
	}
	return { w: x1 - x0, h: y1 - y0, partW, partH, dx: -x0, dy: -y0 };
}
