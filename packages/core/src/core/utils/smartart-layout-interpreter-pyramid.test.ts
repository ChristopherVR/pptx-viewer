import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutNode, PptxSmartArtNode } from '../types';
import type { ArrangementPlan } from './smartart-layout-interpreter-model';
import { arrangePyramid } from './smartart-layout-interpreter-pyramid';

function planFor(node: PptxSmartArtLayoutNode): ArrangementPlan {
	return { kind: 'pyramid', node };
}

function nodes(n: number): PptxSmartArtNode[] {
	return Array.from({ length: n }, (_, i) => ({ id: `n${i}`, text: `Band ${i}` }));
}

// G2: `pyraAcctPos` (PowerPoint's "Pyramid List" gallery variant) moves band
// text into a dedicated accent box instead of cramming it into the trapezoid.
describe('arrangePyramid pyraAcctPos', () => {
	it('renders one polygon band per node, carrying its own text, when pyraAcctPos is absent', () => {
		const plan = planFor({ algorithm: { type: 'pyra' } });
		const result = arrangePyramid(
			plan,
			nodes(3),
			{ width: 300, height: 300 },
			['#fff'],
			'flat',
			'e',
		);
		expect(result.nodes).toHaveLength(3);
		expect(result.nodes.every((node) => node.kind === 'polygon' && node.nodeId)).toBeTruthy();
	});

	it('pyraAcctPos=aft splits each band into a decorative trapezoid + a text accent box', () => {
		const plan = planFor({
			algorithm: { type: 'pyra', parameters: [{ type: 'pyraAcctPos', value: 'aft' }] },
		});
		const result = arrangePyramid(
			plan,
			nodes(3),
			{ width: 300, height: 300 },
			['#fff'],
			'flat',
			'e',
		);
		// 3 bands x (decorative polygon + text accent rect) = 6 rendered nodes.
		expect(result.nodes).toHaveLength(6);

		const bands = result.nodes.filter((node) => node.kind === 'polygon');
		const accents = result.nodes.filter((node) => node.kind === 'rect');
		expect(bands).toHaveLength(3);
		expect(accents).toHaveLength(3);
		// The band is decorative: no nodeId, so the decompose bridge won't also
		// project the node's real text onto it (avoiding duplicate text).
		expect(bands.every((band) => band.nodeId === undefined)).toBeTruthy();
		// The accent box is the sole text carrier for its data point.
		expect(accents.map((accent) => accent.nodeId)).toStrictEqual(['n0', 'n1', 'n2']);

		// 'aft': the accent box sits to the RIGHT of its band.
		const band0 = bands[0];
		const accent0 = accents[0];
		if (band0.kind !== 'polygon' || accent0.kind !== 'rect') {
			throw new Error('unexpected kinds');
		}
		const bandRightEdge = Math.max(
			...band0.points
				.trim()
				.split(/\s+/u)
				.map((pair) => Number(pair.split(',')[0])),
		);
		expect(accent0.x).toBeGreaterThan(bandRightEdge);
	});

	it('pyraAcctPos=bef puts the accent box to the LEFT of the band', () => {
		const plan = planFor({
			algorithm: { type: 'pyra', parameters: [{ type: 'pyraAcctPos', value: 'bef' }] },
		});
		const result = arrangePyramid(
			plan,
			nodes(2),
			{ width: 300, height: 200 },
			['#fff'],
			'flat',
			'e',
		);
		const band0 = result.nodes.find((node) => node.kind === 'polygon');
		const accent0 = result.nodes.find((node) => node.kind === 'rect');
		if (!band0 || band0.kind !== 'polygon' || !accent0 || accent0.kind !== 'rect') {
			throw new Error('expected one polygon band and one rect accent');
		}
		const bandLeftEdge = Math.min(
			...band0.points
				.trim()
				.split(/\s+/u)
				.map((pair) => Number(pair.split(',')[0])),
		);
		expect(accent0.x + accent0.width).toBeLessThanOrEqual(bandLeftEdge);
	});
});
