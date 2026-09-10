/**
 * SmartArt DiagramML interpreter - cycle ring connector arcs.
 *
 * Split out of `smartart-layout-interpreter-cycle.ts` (repo per-file line
 * budget): the light, outward-bulging quadratic-bezier arc drawn between
 * adjacent ring points, pulled away from the ring's own centre. Pure
 * geometry; no framework code.
 */

import type { CycleRingLayout } from './smartart-layout-interpreter-cycle-ring';
import type { RenderedConnector } from './smartart-layout-types';

/**
 * One arc per adjacent ring-point pair (`n` pairs on a full circle, `n - 1`
 * on an open arc), pulled outward from `ringCentre` in proportion to the
 * item size - unchanged from the arranger's own pre-existing connector
 * math, just relocated.
 */
export function buildCycleRingConnectors(
	ring: CycleRingLayout,
	n: number,
	connectorCount: number,
	ringCentre: { x: number; y: number },
	elementId: string,
): RenderedConnector[] {
	return Array.from({ length: connectorCount }, (_, i) => {
		const from = ring.centers[i];
		const to = ring.centers[(i + 1) % n];
		const midX = (from.x + to.x) / 2;
		const midY = (from.y + to.y) / 2;
		const pullRadius = Math.max(ring.nodeWidth, ring.nodeHeight) / 2;
		const pull =
			1 + (pullRadius * 0.15) / Math.max(1, Math.hypot(midX - ringCentre.x, midY - ringCentre.y));
		const controlX = ringCentre.x + (midX - ringCentre.x) * pull;
		const controlY = ringCentre.y + (midY - ringCentre.y) * pull;
		return {
			key: `${elementId}-cycle-conn-${i}`,
			d: `M${from.x},${from.y} Q${controlX},${controlY} ${to.x},${to.y}`,
		};
	});
}
