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

// G9: `dgm:shape/@lkTxEntry` on the named level node keeps the decorative
// band's own text (mirroring its paired content node) instead of always
// going blank once `pyraAcctPos` moves text to the accent box.
describe('arrangePyramid lkTxEntry', () => {
	it('blanks the band when the level node has no lkTxEntry (pre-existing behaviour)', () => {
		const plan = planFor({
			algorithm: {
				type: 'pyra',
				parameters: [
					{ type: 'pyraAcctPos', value: 'aft' },
					{ type: 'pyraLvlNode', value: 'level' },
				],
			},
			children: [{ name: 'level' }],
		});
		const result = arrangePyramid(
			plan,
			nodes(1),
			{ width: 200, height: 200 },
			['#fff'],
			'flat',
			'e',
		);
		const band = result.nodes.find((node) => node.kind === 'polygon');
		expect(band?.nodeId).toBeUndefined();
		expect(band?.text).toBe('');
	});

	it('keeps the band\'s own text when the named level node declares lkTxEntry="1"', () => {
		const plan = planFor({
			algorithm: {
				type: 'pyra',
				parameters: [
					{ type: 'pyraAcctPos', value: 'aft' },
					{ type: 'pyraLvlNode', value: 'level' },
				],
			},
			children: [{ name: 'level', shape: { lkTxEntry: true } }],
		});
		const result = arrangePyramid(
			plan,
			nodes(1),
			{ width: 200, height: 200 },
			['#fff'],
			'flat',
			'e',
		);
		const band = result.nodes.find((node) => node.kind === 'polygon');
		expect(band?.nodeId).toBe('n0');
		expect(band?.text).not.toBe('');
		// The accent box still renders too - lkTxEntry mirrors the text, it
		// doesn't remove the accent box.
		expect(result.nodes.filter((node) => node.kind === 'rect')).toHaveLength(1);
	});
});

// pyraLvlNode: the arranger's `dgm:param[@type=pyraLvlNode]` names a nested
// layoutNode as the band's own shape; that node's own w/h constraint ratio
// should size the rendered band within its slot.
describe('arrangePyramid pyraLvlNode', () => {
	function planWithLevelNode(
		levelConstraints: PptxSmartArtLayoutNode['constraints'],
	): ArrangementPlan {
		return planFor({
			algorithm: { type: 'pyra', parameters: [{ type: 'pyraLvlNode', value: 'level' }] },
			children: [{ name: 'level', constraints: levelConstraints }],
		});
	}

	it('shrinks the band to a sub-1 literal `val` ratio declared on the named level node', () => {
		const full = arrangePyramid(
			planFor({ algorithm: { type: 'pyra' } }),
			nodes(2),
			{ width: 200, height: 200 },
			['#fff'],
			'flat',
			'e',
		);
		const shrunk = arrangePyramid(
			planWithLevelNode([{ type: 'h', value: 0.5 }]),
			nodes(2),
			{ width: 200, height: 200 },
			['#fff'],
			'flat',
			'e',
		);
		const fullBand = full.nodes[0];
		const shrunkBand = shrunk.nodes[0];
		if (fullBand.kind !== 'polygon' || shrunkBand.kind !== 'polygon') {
			throw new Error('expected polygon bands');
		}
		const heightOf = (points: string): number => {
			const ys = points
				.trim()
				.split(/\s+/u)
				.map((pair) => Number(pair.split(',')[1]));
			return Math.max(...ys) - Math.min(...ys);
		};
		expect(heightOf(shrunkBand.points)).toBeLessThan(heightOf(fullBand.points));
	});

	it('honours a `fact` ratio on the named level node for width too', () => {
		const shrunk = arrangePyramid(
			planWithLevelNode([{ type: 'w', factor: 0.5 }]),
			nodes(1),
			{ width: 200, height: 200 },
			['#fff'],
			'flat',
			'e',
		);
		const full = arrangePyramid(
			planFor({ algorithm: { type: 'pyra' } }),
			nodes(1),
			{ width: 200, height: 200 },
			['#fff'],
			'flat',
			'e',
		);
		const widthOf = (points: string): number => {
			const xs = points
				.trim()
				.split(/\s+/u)
				.map((pair) => Number(pair.split(',')[0]));
			return Math.max(...xs) - Math.min(...xs);
		};
		const shrunkBand = shrunk.nodes[0];
		const fullBand = full.nodes[0];
		if (shrunkBand.kind !== 'polygon' || fullBand.kind !== 'polygon') {
			throw new Error('expected polygon bands');
		}
		expect(widthOf(shrunkBand.points)).toBeLessThan(widthOf(fullBand.points));
	});

	// COM-verified: real "Basic Pyramid" (ppt/diagrams/layout1.xml) declares
	// `pyraLvlNode val="level"` with the level node's own `w val="1"` / `h
	// val="500"` - neither qualifies as a sub-1 ratio, so output must be
	// byte-identical to the no-pyraLvlNode case (no regression).
	it('is a no-op for real "Basic Pyramid" values (w=1, h=500, not ratios)', () => {
		const basicPyramid = arrangePyramid(
			planWithLevelNode([
				{ type: 'w', value: 1 },
				{ type: 'h', value: 500 },
			]),
			nodes(3),
			{ width: 300, height: 300 },
			['#fff'],
			'flat',
			'e',
		);
		const noParam = arrangePyramid(
			planFor({ algorithm: { type: 'pyra' } }),
			nodes(3),
			{ width: 300, height: 300 },
			['#fff'],
			'flat',
			'e',
		);
		expect(basicPyramid.nodes).toStrictEqual(noParam.nodes);
	});
});
