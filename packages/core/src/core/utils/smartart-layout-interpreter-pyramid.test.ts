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

// G2 (REVISED, round 3): `pyraAcctPos` (`dgm:param[@type=pyraAcctPos]`,
// `bef`/`aft`) does NOT mean "move this band's text into a dedicated rect
// accent box" - that was this arranger's own earlier model, and it is WRONG.
// COM-verified regression: of the 227-fixture gallery corpus, only
// `basic-pyramid`/`inverted-pyramid` ever declare `pyraAcctPos` at all, and
// their cached ground truth for an accented row (a point with a child) is
// TWO TRAPEZOID shapes sharing one band's slot (`trapezoid` + a
// `nonIsoscelesTrapezoid`), never a `rect` sidebar. "Pyramid List" (the
// layout this arranger's old model was reasoning by analogy with) does not
// even use `dgm:alg type="pyra"` - it is a `composite` of one static
// decorative triangle beside a `lin`-arranged list, structurally unrelated.
// This arranger therefore ignores `pyraAcctPos` entirely and always emits
// one plain trapezoid band per top-level point; the per-item accent split
// (only present when a point has a child) is the item-roles module's job
// (`smartart-layout-interpreter-item-role-stack.ts`'s `stackRoleContent`).
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

	it('pyraAcctPos=aft is a no-op: still one polygon band per node, no accent box (regression test)', () => {
		const withParam = arrangePyramid(
			planFor({
				algorithm: { type: 'pyra', parameters: [{ type: 'pyraAcctPos', value: 'aft' }] },
			}),
			nodes(3),
			{ width: 300, height: 300 },
			['#fff'],
			'flat',
			'e',
		);
		const withoutParam = arrangePyramid(
			planFor({ algorithm: { type: 'pyra' } }),
			nodes(3),
			{ width: 300, height: 300 },
			['#fff'],
			'flat',
			'e',
		);
		expect(withParam.nodes).toStrictEqual(withoutParam.nodes);
		expect(withParam.nodes.filter((node) => node.kind === 'rect')).toHaveLength(0);
	});

	it('pyraAcctPos=bef is also a no-op', () => {
		const result = arrangePyramid(
			planFor({
				algorithm: { type: 'pyra', parameters: [{ type: 'pyraAcctPos', value: 'bef' }] },
			}),
			nodes(2),
			{ width: 300, height: 200 },
			['#fff'],
			'flat',
			'e',
		);
		expect(result.nodes).toHaveLength(2);
		expect(result.nodes.every((node) => node.kind === 'polygon')).toBeTruthy();
	});
});

// COM-verified against "Basic Pyramid" (`basic-pyramid--flat3.pptx`): the
// `pyra` layout node declares no `sibSp`/margin constraint at all, and the
// cached drawing stacks bands edge-to-edge filling the FULL diagram box
// (zero outer inset, zero inter-band gap), not the old hardcoded 8px inset /
// 6% gap this arranger used to apply unconditionally.
describe('arrangePyramid default spacing (no sibSp declared)', () => {
	it('fills the full box with zero gap between bands, matching "Basic Pyramid" ground truth', () => {
		const result = arrangePyramid(
			planFor({ algorithm: { type: 'pyra' } }),
			nodes(3),
			{ width: 867, height: 533 },
			['#fff'],
			'flat',
			'e',
		);
		const heightOf = (points: string): number => {
			const ys = points
				.trim()
				.split(/\s+/u)
				.map((pair) => Number(pair.split(',')[1]));
			return Math.max(...ys) - Math.min(...ys);
		};
		const widthOf = (points: string): number => {
			const xs = points
				.trim()
				.split(/\s+/u)
				.map((pair) => Number(pair.split(',')[0]));
			return Math.max(...xs) - Math.min(...xs);
		};
		const bands = result.nodes.filter((node) => node.kind === 'polygon');
		expect(bands).toHaveLength(3);
		// Cached: each band h=178 (533/3), stacked with no gap: band i's points
		// start exactly where band i-1's end (y = i * 533/3).
		for (const band of bands) {
			if (band.kind !== 'polygon') {
				throw new Error('expected polygon');
			}
			expect(heightOf(band.points)).toBeCloseTo(533 / 3, 0);
		}
		// Cached: bottom band's width equals the full box width (867), the
		// widest band in the stack; no outer inset is applied.
		const bottomBand = bands[2];
		if (bottomBand.kind !== 'polygon') {
			throw new Error('expected polygon');
		}
		expect(widthOf(bottomBand.points)).toBeCloseTo(867, 0);
		// Zero gap: band 1's top y equals band 0's bottom y exactly.
		const ys = (points: string) =>
			points
				.trim()
				.split(/\s+/u)
				.map((pair) => Number(pair.split(',')[1]));
		const band0Bottom = Math.max(...ys((bands[0] as { points: string }).points));
		const band1Top = Math.min(...ys((bands[1] as { points: string }).points));
		expect(band1Top).toBeCloseTo(band0Bottom, 5);
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
