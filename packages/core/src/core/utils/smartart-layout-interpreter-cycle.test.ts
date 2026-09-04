import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutNode, PptxSmartArtNode } from '../types';
import { arrangeCycle } from './smartart-layout-interpreter-cycle';
import type { ArrangementPlan } from './smartart-layout-interpreter-model';

function planFor(node: PptxSmartArtLayoutNode): ArrangementPlan {
	return { kind: 'cycle', node };
}

function nodes(n: number): PptxSmartArtNode[] {
	return Array.from({ length: n }, (_, i) => ({ id: `n${i}`, text: `${i}` }));
}

// G6: `ctrShpMap="fNode"` (`dgm:param`) places a hub node at the ring's centre
// for "Radial Cycle"-family layouts, instead of on the ring like every other point.
describe('arrangeCycle ctrShpMap', () => {
	it('places every point on the ring when ctrShpMap is absent (no regression)', () => {
		const plan = planFor({ algorithm: { type: 'cycle' } });
		const result = arrangeCycle(plan, nodes(4), { width: 200, height: 200 }, ['#fff'], 'flat', 'e');
		expect(result.nodes).toHaveLength(4);
		const centre = { x: 100, y: 100 };
		for (const rendered of result.nodes) {
			if (rendered.kind !== 'circle') {
				throw new Error('expected circle nodes');
			}
			const dist = Math.hypot(rendered.cx - centre.x, rendered.cy - centre.y);
			expect(dist).toBeGreaterThan(10);
		}
	});

	it('ctrShpMap=fNode pulls the first data point to the box centre', () => {
		const plan = planFor({
			algorithm: { type: 'cycle', parameters: [{ type: 'ctrShpMap', value: 'fNode' }] },
		});
		const result = arrangeCycle(plan, nodes(4), { width: 200, height: 200 }, ['#fff'], 'flat', 'e');
		expect(result.nodes).toHaveLength(4);
		const hub = result.nodes.find((rendered) => rendered.nodeId === 'n0');
		if (!hub || hub.kind !== 'circle') {
			throw new Error('expected hub circle for n0');
		}
		expect(hub.cx).toBeCloseTo(100, 5);
		expect(hub.cy).toBeCloseTo(100, 5);
		// The remaining 3 points are still arranged on the ring, away from centre.
		const ringNodes = result.nodes.filter((rendered) => rendered.nodeId !== 'n0');
		expect(ringNodes).toHaveLength(3);
		for (const rendered of ringNodes) {
			if (rendered.kind !== 'circle') {
				throw new Error('expected circle nodes');
			}
			const dist = Math.hypot(rendered.cx - 100, rendered.cy - 100);
			expect(dist).toBeGreaterThan(hub.r);
		}
	});
});
