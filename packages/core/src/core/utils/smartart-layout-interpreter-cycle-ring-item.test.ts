import { describe, expect, it } from 'vitest';

import type { PptxSmartArtNode } from '../types';
import type { CompositeContentLayout } from './smartart-layout-interpreter-cycle-item-aspect';
import { repositionCycleRingContent } from './smartart-layout-interpreter-cycle-ring-item';
import type { RenderedCircleNode, SmartArtLayoutResult } from './smartart-layout-types';

function circle(overrides: Partial<RenderedCircleNode>): RenderedCircleNode {
	return {
		kind: 'circle',
		key: overrides.key ?? 'k',
		cx: 0,
		cy: 0,
		r: 0,
		fill: '#fff',
		stroke: 'none',
		strokeWidth: 0,
		opacity: 1,
		text: '',
		fontSize: 12,
		...overrides,
	};
}

// `radial-list--hier5.pptx`'s own descriptor (COM-verified, see
// `smartart-layout-interpreter-cycle-item-aspect.ts`'s own doc comment):
// parentNode.w = 0.4*node.w (self-square), childNode.l = 1.1*parentNode.w,
// childNode.w = 0.6*node.w = 1.5*parentNode.w.
const RADIAL_LIST_LAYOUT: CompositeContentLayout = {
	selfName: 'parentNode',
	selfWidthFactor: 0.4,
	childName: 'childNode',
	childLeftFactor: 1.1,
	childWidthFactor: 0.6,
};

describe('repositionCycleRingContent', () => {
	it("positions a point's own child beside its self ellipse using the composite's own declared fractions", () => {
		// Self ellipse: cx=100, cy=50, r=50 (w=h=100).
		const self = circle({
			key: 'self',
			cx: 100,
			cy: 50,
			r: 50,
			rx: 50,
			ry: 50,
			nodeId: 'point1',
			itemRoleName: 'parentNode',
			text: 'One',
		});
		// Unchanged copy: same geometry as self, but nodeId is the CHILD data
		// node's own id (a `des`-axis role resolves to the descendant, not the
		// point itself).
		const child = circle({
			key: 'child',
			cx: 100,
			cy: 50,
			r: 50,
			rx: 50,
			ry: 50,
			nodeId: 'child1',
			itemRoleName: 'childNode',
			text: 'Two',
		});
		const result: SmartArtLayoutResult = {
			nodes: [self, child],
			connectors: [],
			shadowFilter: undefined,
			viewBox: '0 0 800 400',
			family: 'cycle',
		};
		const flatNodes: PptxSmartArtNode[] = [
			{ id: 'point1', text: 'One' },
			{ id: 'child1', text: 'Two', parentId: 'point1' },
		];
		const out = repositionCycleRingContent(result, RADIAL_LIST_LAYOUT, flatNodes);
		const selfOut = out.nodes[0];
		const childOut = out.nodes[1];
		if (selfOut.kind !== 'circle' || childOut.kind !== 'circle') {
			throw new Error('expected circle nodes');
		}
		// Self is untouched.
		expect(selfOut).toStrictEqual(self);
		// Child: selfW=100, childW=(0.6/0.4)*100=150, selfLeft=100-50=50,
		// childLeft=50+1.1*100=160, cx=160+75=235, cy=self.cy=50.
		expect(childOut.cx).toBeCloseTo(235, 5);
		expect(childOut.cy).toBeCloseTo(50, 5);
		expect(childOut.rx).toBeCloseTo(75, 5);
		expect(childOut.ry).toBeCloseTo(50, 5);
	});

	it('is a no-op when contentLayout has no child descriptor (a plain, non-composite ring item)', () => {
		const result: SmartArtLayoutResult = {
			nodes: [circle({ nodeId: 'a' })],
			connectors: [],
			shadowFilter: undefined,
			viewBox: '0 0 800 400',
			family: 'cycle',
		};
		expect(repositionCycleRingContent(result, undefined, [])).toBe(result);
		expect(repositionCycleRingContent(result, { selfName: 'x', selfWidthFactor: 0.5 }, [])).toBe(
			result,
		);
	});

	it("leaves a child entry untouched when its own self sibling can't be found (never drops a shape)", () => {
		const child = circle({
			nodeId: 'orphan',
			itemRoleName: 'childNode',
			cx: 10,
			cy: 10,
			rx: 5,
			ry: 5,
		});
		const result: SmartArtLayoutResult = {
			nodes: [child],
			connectors: [],
			shadowFilter: undefined,
			viewBox: '0 0 800 400',
			family: 'cycle',
		};
		const out = repositionCycleRingContent(result, RADIAL_LIST_LAYOUT, [
			{ id: 'orphan', text: 'x' },
		]);
		expect(out.nodes[0]).toStrictEqual(child);
	});
});
