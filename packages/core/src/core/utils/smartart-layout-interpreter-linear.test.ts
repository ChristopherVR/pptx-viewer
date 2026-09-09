import { describe, expect, it } from 'vitest';

import type {
	PptxSmartArtLayoutDefinition,
	PptxSmartArtLayoutNode,
	PptxSmartArtNode,
} from '../types';
import { buildConstraintIndex } from './smartart-constraint-solver';
import { arrangeLinear, arrangeSnake } from './smartart-layout-interpreter-linear';
import type { ArrangementPlan, FlowDirection } from './smartart-layout-interpreter-model';
import { resolveSharedItemFontSize } from './smartart-layout-item-font-size';
import { resolveTieredItemFontSize } from './smartart-layout-item-font-tier';

function planFor(node: PptxSmartArtLayoutNode): ArrangementPlan {
	return { kind: 'snake', node };
}

function nodes(n: number): PptxSmartArtNode[] {
	return Array.from({ length: n }, (_, i) => ({ id: `n${i}`, text: `${i}` }));
}

/**
 * Read back each rendered node's `(col, row)` grid cell from its pixel
 * position, relative to the arrangement's own minimum x/y rather than a
 * hardcoded origin, so this helper stays correct regardless of `arrangeSnake`'s
 * own outer-margin constant.
 */
function cellsOf(
	result: ReturnType<typeof arrangeSnake>,
	cellW: number,
	cellH: number,
): Array<{ col: number; row: number }> {
	const rects = result.nodes.map((rendered) => {
		if (rendered.kind !== 'rect') {
			throw new Error('expected rect nodes');
		}
		return rendered;
	});
	const minX = Math.min(...rects.map((r) => r.x));
	const minY = Math.min(...rects.map((r) => r.y));
	return rects.map((rendered) => ({
		col: Math.round((rendered.x - minX) / cellW) || 0,
		row: Math.round((rendered.y - minY) / cellH) || 0,
	}));
}

// G1: `grDir`/`flowDir`/`contDir`/`bkpt` algorithm params on `dgm:alg[@type=snake]`.
describe('arrangeSnake DiagramML params', () => {
	it('defaults to a row-major boustrophedon grid when no params are present (no regression)', () => {
		const plan = planFor({ algorithm: { type: 'snake' }, children: [{ name: 'item' }] });
		const result = arrangeSnake(plan, nodes(6), { width: 300, height: 200 }, ['#fff'], 'flat', 'e');
		// 6 nodes, box 300x200 -> heuristic picks cols=3,rows=2 (matches the
		// pre-existing sqrt(n*w/h) guess). Row 1 (index 3..5) should reverse.
		expect(result.nodes).toHaveLength(6);
		const cellW = result.nodes[0].kind === 'rect' ? result.nodes[0].width : 0;
		const cellH = result.nodes[0].kind === 'rect' ? result.nodes[0].height : 0;
		const cells = cellsOf(result, cellW + 1e-9, cellH + 1e-9);
		// Row 0 reads left-to-right; row 1 (the alternate row) reads right-to-left.
		expect(cells[0].row).toBe(0);
		expect(cells[3].row).toBe(1);
		expect(cells[3].col).toBeGreaterThan(cells[5].col);
	});

	it('contDir=sameDir disables the boustrophedon reversal', () => {
		const plan = planFor({
			algorithm: { type: 'snake', parameters: [{ type: 'contDir', value: 'sameDir' }] },
			children: [{ name: 'item' }],
		});
		const result = arrangeSnake(plan, nodes(6), { width: 300, height: 200 }, ['#fff'], 'flat', 'e');
		const cellW = result.nodes[0].kind === 'rect' ? result.nodes[0].width : 0;
		const cellH = result.nodes[0].kind === 'rect' ? result.nodes[0].height : 0;
		const cells = cellsOf(result, cellW + 1e-9, cellH + 1e-9);
		// Every row now reads left-to-right: index 3 (first of row 1) is col 0.
		expect(cells[3]).toStrictEqual({ col: 0, row: 1 });
		expect(cells[5]).toStrictEqual({ col: 2, row: 1 });
	});

	it('flowDir=col fills down each column before moving to the next', () => {
		const plan = planFor({
			algorithm: {
				type: 'snake',
				parameters: [
					{ type: 'flowDir', value: 'col' },
					{ type: 'bkpt', value: 'fixed' },
				],
			},
			constraints: [{ type: 'bkPtFixedVal', value: 3 }],
			children: [{ name: 'item' }],
		});
		const result = arrangeSnake(plan, nodes(6), { width: 200, height: 300 }, ['#fff'], 'flat', 'e');
		const cellW = result.nodes[0].kind === 'rect' ? result.nodes[0].width : 0;
		const cellH = result.nodes[0].kind === 'rect' ? result.nodes[0].height : 0;
		const cells = cellsOf(result, cellW + 1e-9, cellH + 1e-9);
		// bkPtFixedVal=3 -> 3 rows/column; index 3 starts column 1. contDir
		// defaults to reversal, so column 1 (the alternate line) reads bottom-up.
		expect(cells[0]).toStrictEqual({ col: 0, row: 0 });
		expect(cells[2]).toStrictEqual({ col: 0, row: 2 });
		expect(cells[3]).toStrictEqual({ col: 1, row: 2 });
		expect(cells[5]).toStrictEqual({ col: 1, row: 0 });
	});

	it('grDir=tR mirrors the column axis so the grid grows from the top-right', () => {
		const plan = planFor({
			algorithm: {
				type: 'snake',
				parameters: [
					{ type: 'grDir', value: 'tR' },
					{ type: 'contDir', value: 'sameDir' },
					{ type: 'bkpt', value: 'fixed' },
				],
			},
			constraints: [{ type: 'bkPtFixedVal', value: 3 }],
			children: [{ name: 'item' }],
		});
		const result = arrangeSnake(plan, nodes(6), { width: 300, height: 200 }, ['#fff'], 'flat', 'e');
		const cellW = result.nodes[0].kind === 'rect' ? result.nodes[0].width : 0;
		const cellH = result.nodes[0].kind === 'rect' ? result.nodes[0].height : 0;
		const cells = cellsOf(result, cellW + 1e-9, cellH + 1e-9);
		// sameDir + fixed 3-per-row -> row-major reading order, but grDir=tR
		// mirrors columns: item 0 lands at the rightmost column (2), not 0.
		expect(cells[0]).toStrictEqual({ col: 2, row: 0 });
		expect(cells[2]).toStrictEqual({ col: 0, row: 0 });
	});

	it('off=ctr centers an incomplete final row within the grid\'s full width (basic-block-list--flat3.pptx: cached "Gamma" x=280 of an 867-wide frame)', () => {
		// 3 items, sameDir, a 2-column grid (2 items in row 0, 1 lone item in
		// row 1): without `off="ctr"` the lone item sits flush at the grid's
		// own left edge (col 0); with it, it centers under the full row above.
		const plan = planFor({
			algorithm: {
				type: 'snake',
				parameters: [
					{ type: 'contDir', value: 'sameDir' },
					{ type: 'bkpt', value: 'fixed' },
					{ type: 'off', value: 'ctr' },
				],
			},
			constraints: [{ type: 'bkPtFixedVal', value: 2 }],
			children: [{ name: 'item' }],
		});
		const result = arrangeSnake(plan, nodes(3), { width: 300, height: 200 }, ['#fff'], 'flat', 'e');
		const [first, second, third] = result.nodes;
		if (first.kind !== 'rect' || second.kind !== 'rect' || third.kind !== 'rect') {
			throw new Error('expected rect nodes');
		}
		// The lone third item's centre should align with the midpoint of the
		// full two-item row above it (first.x + second.x + second.width) / 2,
		// not sit flush at the grid's own left edge (first.x).
		const rowCentre = (first.x + second.x + second.width) / 2;
		expect(third.x + third.width / 2).toBeCloseTo(rowCentre, 5);
		expect(third.x).toBeGreaterThan(first.x);
	});

	it('without off=ctr, an incomplete final row stays flush at the grid edge (no regression)', () => {
		const plan = planFor({
			algorithm: {
				type: 'snake',
				parameters: [
					{ type: 'contDir', value: 'sameDir' },
					{ type: 'bkpt', value: 'fixed' },
				],
			},
			constraints: [{ type: 'bkPtFixedVal', value: 2 }],
			children: [{ name: 'item' }],
		});
		const result = arrangeSnake(plan, nodes(3), { width: 300, height: 200 }, ['#fff'], 'flat', 'e');
		const [first, , third] = result.nodes;
		if (first.kind !== 'rect' || third.kind !== 'rect') {
			throw new Error('expected rect nodes');
		}
		expect(third.x).toBeCloseTo(first.x, 5);
	});
});

// G2: `basic-block-list--hier5.pptx`'s real declared `constrLst`
// (`smartart-gallery-ground-truth.test.ts`) - reproduced verbatim from
// `ppt/diagrams/layout1.xml`: `sibTrans.w = 0.1 * node.w`, `sp = sibTrans.w`,
// resolved via the reference chain in `smartart-constraint-solver.ts`.
function blockListDefinition(): {
	plan: ArrangementPlan;
	index: ReturnType<typeof buildConstraintIndex>;
} {
	const rootNode: PptxSmartArtLayoutNode = {
		name: 'diagram',
		algorithm: {
			type: 'snake',
			parameters: [
				{ type: 'grDir', value: 'tL' },
				{ type: 'flowDir', value: 'row' },
				{ type: 'contDir', value: 'sameDir' },
				{ type: 'off', value: 'ctr' },
			],
		},
		constraints: [
			{ type: 'w', for: 'ch', forName: 'node', referenceType: 'w' },
			{
				type: 'h',
				for: 'ch',
				forName: 'node',
				referenceType: 'w',
				referenceFor: 'ch',
				referenceForName: 'node',
				factor: 0.6,
			},
			{
				type: 'w',
				for: 'ch',
				forName: 'sibTrans',
				referenceType: 'w',
				referenceFor: 'ch',
				referenceForName: 'node',
				factor: 0.1,
			},
			{ type: 'sp', referenceType: 'w', referenceFor: 'ch', referenceForName: 'sibTrans' },
			{ type: 'primFontSz', for: 'ch', forName: 'node', operator: 'equ', value: 65 },
		],
		children: [{ name: 'node' }, { name: 'sibTrans' }],
	};
	const definition: PptxSmartArtLayoutDefinition = { rootNode };
	return { plan: { kind: 'snake', node: rootNode }, index: buildConstraintIndex(definition) };
}

describe('arrangeSnake shared between-cell gap (basic-block-list--hier5.pptx)', () => {
	const box = { width: 867, height: 533 };
	const items = [
		{ id: 'a', text: 'Node One' },
		{ id: 'b', text: 'Node Three' },
		{ id: 'c', text: 'Node Four' },
	];

	it("resolves the gap as ONE absolute amount shared by both grid axes, not a per-axis fraction of each axis's own cell size (cached: row gap 41px == column gap 41px, cellH 246px, not the 254px a per-axis `sib*cellH` formula gives)", () => {
		const { plan, index } = blockListDefinition();
		const result = arrangeSnake(plan, items, box, ['#fff'], 'flat', 'e', index);
		const rects = result.nodes.map((n) => {
			if (n.kind !== 'rect') {
				throw new Error('expected rect nodes');
			}
			return n;
		});
		const [first, second, third] = rects;
		// Column gap (row 0: item 0 -> item 1) and row gap (item 1 -> the lone,
		// centred item 2 on row 1) must be the SAME absolute pixel amount.
		const colGap = second.x - (first.x + first.width);
		const rowGap = third.y - (first.y + first.height);
		expect(colGap).toBeCloseTo(rowGap, 5);
		// Closed form: sib=0.1 (from the sibTrans->node `w` reference chain
		// above), cols=2 -> gap = sib*usableW/(cols+sib*(cols-1)).
		const expectedGap = (0.1 * 867) / 2.1;
		expect(colGap).toBeCloseTo(expectedGap, 5);
		// cellH solves from that SAME gap, not a fresh `sib*cellH` fraction of
		// its own (smaller) axis: (usableH-(rows-1)*gap)/rows.
		expect(first.height).toBeCloseTo((533 - expectedGap) / 2, 5);
	});

	it('fits the shared font size HEIGHT against the real (shared-gap) display cellH, not the inflated per-axis-independent cross-axis estimate', () => {
		const { plan, index } = blockListDefinition();
		const result = arrangeSnake(plan, items, box, ['#fff'], 'flat', 'e', index);
		const [first] = result.nodes;
		if (first.kind !== 'rect') {
			throw new Error('expected rect node');
		}
		// The independent-axis cross estimate (usableH/(rows+(rows-1)*sib) =
		// 254px) was tried for font-fit's height and REVERTED - once the
		// two-tier fold-aware fit (`smartart-layout-item-font-tier.ts`)
		// accounts for a folded descendant's own demoted size and per-level
		// paragraph spacing, that inflated estimate over-shrinks the box's own
		// real available height and lets the shared size overshoot the cached
		// value (measured against `basic-block-list--hier5.pptx`). Font-fit's
		// WIDTH axis still uses the per-axis-independent `cellWForFont`
		// estimate (algebraically identical to the real `cellW` on the main
		// axis here, so this is a no-op for this grid).
		const cellWForFont = 867 / (2 + 0.1 * 1);
		const cellH = (533 - (0.1 * 867) / 2.1) / 2;
		const expected = resolveSharedItemFontSize(
			plan,
			index,
			items.map((n) => ({ text: n.text, width: cellWForFont, height: cellH })),
			undefined,
			undefined,
		);
		expect(first.fontSize).toBeCloseTo(expected, 5);
	});
});

describe('arrangeLinear cross-axis extent', () => {
	const horizontal: FlowDirection = { orientation: 'horizontal', reverse: false };

	it('fills the full cross-axis extent when NEITHER the arranger NOR the item itself declares an h/w aspect', () => {
		// A genuinely unconstrained item (no arranger-declared `itemAspect`,
		// no item-declared self-scoped `naturalAspect` either) fills the full
		// cross extent - the one case round 9's `naturalAspect`-for-display
		// fix leaves unchanged (see the `naturalAspect display geometry`
		// describe block below for the case that DOES now shape it).
		const plan: ArrangementPlan = { kind: 'linear', node: { algorithm: { type: 'lin' } } };
		const result = arrangeLinear(
			plan,
			horizontal,
			[
				{ id: 'a', text: 'A' },
				{ id: 'b', text: 'B' },
			],
			{ width: 400, height: 200 },
			['#fff'],
			'flat',
			'e',
		);
		for (const rendered of result.nodes) {
			if (rendered.kind !== 'rect') {
				throw new Error('expected rect nodes');
			}
			expect(rendered.height).toBeCloseTo(200, 0);
		}
	});

	it('honours an explicit item h/w aspect the ARRANGER declares for the item role', () => {
		// Per `resolveConstraintDeclaredBy`'s doc comment: only an
		// arranger-declared (`for="ch" forName="item"`) aspect is honoured, not
		// one the item role declares on its own `constrLst`. Measured against
		// `basic-block-list--flat3.pptx` (a real gallery fixture, `snake`
		// algorithm, but the SAME arranger-declared-aspect constraint shape):
		// its `dgm:constr type="h" for="ch" forName="node" refType="w"
		// refFor="ch" refForName="node" fact="0.6"` survives into the cached
		// `dsp:sp` geometry EXACTLY (cached ext 3905808 x 2343484 EMU = aspect
		// 0.60007) - PowerPoint does NOT discard or renormalise an
		// arranger-declared aspect to fill the container; only a genuinely
		// UNCONSTRAINED cross axis (the test above) fills it.
		const itemNode: PptxSmartArtLayoutNode = { name: 'item' };
		const rootNode: PptxSmartArtLayoutNode = {
			algorithm: { type: 'lin' },
			constraints: [
				{ type: 'w', for: 'ch', forName: 'item', value: 100 },
				{ type: 'h', for: 'ch', forName: 'item', value: 40 },
			],
			children: [itemNode],
		};
		const definition: PptxSmartArtLayoutDefinition = { rootNode };
		const index = buildConstraintIndex(definition);
		const plan: ArrangementPlan = { kind: 'linear', node: rootNode };

		const result = arrangeLinear(
			plan,
			horizontal,
			[{ id: 'a', text: 'A' }],
			{ width: 400, height: 200 },
			['#fff'],
			'flat',
			'e',
			index,
		);
		const [rendered] = result.nodes;
		if (rendered.kind !== 'rect') {
			throw new Error('expected rect node');
		}
		// aspect = 40/100 = 0.4, applied to the (single-item) main extent (400).
		expect(rendered.height).toBeCloseTo(rendered.width * 0.4, 0);
		expect(rendered.height).toBeLessThan(200);
	});
});

// Round 9: a self-scoped (item-declared, NOT arranger-declared) aspect now
// shapes DISPLAY geometry too, not just font-fit - see `arrangeLinear`'s own
// `naturalAspect`/`crossExtent` doc comment for the full derivation
// (`vertical-process--hier5.pptx`'s real cached box, after fixing
// `smartart-decompose.ts`'s scale-to-fit bug that had masked this).
describe('arrangeLinear naturalAspect display geometry (round 9)', () => {
	const horizontal: FlowDirection = { orientation: 'horizontal', reverse: false };
	const vertical: FlowDirection = { orientation: 'vertical', reverse: false };

	function definitionWithSelfScopedAspect(constraint: PptxSmartArtLayoutNode['constraints']): {
		plan: ArrangementPlan;
		index: ReturnType<typeof buildConstraintIndex>;
	} {
		const itemNode: PptxSmartArtLayoutNode = { name: 'item', constraints: constraint };
		const rootNode: PptxSmartArtLayoutNode = { algorithm: { type: 'lin' }, children: [itemNode] };
		const definition: PptxSmartArtLayoutDefinition = { rootNode };
		return { plan: { kind: 'linear', node: rootNode }, index: buildConstraintIndex(definition) };
	}

	it('a self-scoped h-over-w aspect (no arranger aspect) shrinks the HORIZONTAL cross axis (height) to match', () => {
		const { plan, index } = definitionWithSelfScopedAspect([
			{ type: 'h', referenceType: 'w', factor: 0.6 },
		]);
		const result = arrangeLinear(
			plan,
			horizontal,
			[{ id: 'a', text: 'A' }],
			{ width: 400, height: 400 },
			['#fff'],
			'flat',
			'e',
			index,
		);
		const [rendered] = result.nodes;
		if (rendered.kind !== 'rect') {
			throw new Error('expected rect node');
		}
		expect(rendered.height).toBeCloseTo(rendered.width * 0.6, 1);
		expect(rendered.height).toBeLessThan(400);
	});

	it("a self-scoped w-over-h aspect (no arranger aspect) shrinks the VERTICAL cross axis (width) via the INVERTED h/w ratio - vertical-process--hier5.pptx's exact case", () => {
		// Real layoutDef: `<dgm:constr type="w" refType="h" fact="1.8"/>`
		// (self-scoped, no `for`) -> h/w = 1/1.8 = 0.5556. Real cached box
		// 180x100pt: h/w = 100/180 = 0.5556, matching exactly.
		const { plan, index } = definitionWithSelfScopedAspect([
			{ type: 'w', referenceType: 'h', factor: 1.8 },
		]);
		const result = arrangeLinear(
			plan,
			vertical,
			[{ id: 'a', text: 'A' }],
			{ width: 867, height: 400 },
			['#fff'],
			'flat',
			'e',
			index,
		);
		const [rendered] = result.nodes;
		if (rendered.kind !== 'rect') {
			throw new Error('expected rect node');
		}
		// mainExtent (height, the divided axis) = ~400pt for 1 item; crossExtent
		// (width) should be mainExtent / (h/w) = mainExtent * 1.8, matching the
		// cached 180x100pt ratio (1.8), NOT the naive un-inverted
		// `mainExtent * 0.5556` (which would give 55.5pt-scale width instead).
		expect(rendered.width).toBeCloseTo(rendered.height * 1.8, 0);
	});

	it('an ARRANGER-declared aspect still wins over a self-scoped one when BOTH are present (no behaviour change for that case)', () => {
		const itemNode: PptxSmartArtLayoutNode = {
			name: 'item',
			constraints: [{ type: 'h', referenceType: 'w', factor: 0.6 }],
		};
		const rootNode: PptxSmartArtLayoutNode = {
			algorithm: { type: 'lin' },
			constraints: [
				{ type: 'w', for: 'ch', forName: 'item', value: 100 },
				{ type: 'h', for: 'ch', forName: 'item', value: 40 },
			],
			children: [itemNode],
		};
		const definition: PptxSmartArtLayoutDefinition = { rootNode };
		const index = buildConstraintIndex(definition);
		const plan: ArrangementPlan = { kind: 'linear', node: rootNode };
		const result = arrangeLinear(
			plan,
			horizontal,
			[{ id: 'a', text: 'A' }],
			{ width: 400, height: 200 },
			['#fff'],
			'flat',
			'e',
			index,
		);
		const [rendered] = result.nodes;
		if (rendered.kind !== 'rect') {
			throw new Error('expected rect node');
		}
		// The ARRANGER's own 40/100=0.4 aspect wins, not the item's self-scoped 0.6.
		expect(rendered.height).toBeCloseTo(rendered.width * 0.4, 0);
	});
});

// G6: shared item `primFontSz` (`smartart-layout-item-font-size.ts`), per
// ECMA-376 21.4.2.x - a `dgm:ruleLst` shrink rule governs every point sharing
// it, so every item renders at ONE size (the diagram-wide minimum), not its
// own independent best fit.
describe('arrangeLinear/arrangeSnake shared item font size', () => {
	const horizontal: FlowDirection = { orientation: 'horizontal', reverse: false };

	function definitionWithDeclaredFontSize(declaredVal: number): {
		plan: ArrangementPlan;
		index: ReturnType<typeof buildConstraintIndex>;
	} {
		const itemNode: PptxSmartArtLayoutNode = { name: 'item' };
		const rootNode: PptxSmartArtLayoutNode = {
			algorithm: { type: 'lin' },
			constraints: [{ type: 'primFontSz', for: 'ch', forName: 'item', value: declaredVal }],
			children: [itemNode],
		};
		const definition: PptxSmartArtLayoutDefinition = { rootNode };
		return {
			plan: { kind: 'linear', node: rootNode },
			index: buildConstraintIndex(definition),
		};
	}

	it('uses the arranger-declared primFontSz as the ceiling instead of a hardcoded default', () => {
		const { plan, index } = definitionWithDeclaredFontSize(48);
		const result = arrangeLinear(
			plan,
			horizontal,
			[{ id: 'a', text: 'Hi' }],
			{ width: 400, height: 400 },
			['#fff'],
			'flat',
			'e',
			index,
		);
		const [rendered] = result.nodes;
		if (rendered.kind !== 'rect') {
			throw new Error('expected rect node');
		}
		// Short text in a big box: the declared ceiling wins outright, converted
		// from the DiagramML points unit to this codebase's pixel geometry.
		expect(rendered.fontSize).toBeCloseTo(48 * (96 / 72), 5);
	});

	it('shares ONE size across every item: a long label in one item shrinks every item, even short ones', () => {
		const { plan, index } = definitionWithDeclaredFontSize(48);
		const result = arrangeLinear(
			plan,
			horizontal,
			[
				{ id: 'a', text: 'Hi' },
				{ id: 'b', text: 'A much longer label that will not fit at the declared size' },
			],
			{ width: 200, height: 60 },
			['#fff'],
			'flat',
			'e',
			index,
		);
		expect(result.nodes).toHaveLength(2);
		const [short, long] = result.nodes;
		if (short.kind !== 'rect' || long.kind !== 'rect') {
			throw new Error('expected rect nodes');
		}
		expect(short.fontSize).toBe(long.fontSize);
		expect(short.fontSize).toBeLessThan(48 * (96 / 72));
	});

	it('arrangeSnake shares the same font size across its grid cells too', () => {
		const { plan, index } = definitionWithDeclaredFontSize(40);
		const result = arrangeSnake(
			plan,
			[
				{ id: 'a', text: 'Short' },
				{ id: 'b', text: 'A somewhat longer piece of label text here' },
				{ id: 'c', text: 'Ok' },
			],
			{ width: 300, height: 90 },
			['#fff'],
			'flat',
			'e',
			index,
		);
		const sizes = result.nodes.map((n) => (n.kind === 'rect' ? n.fontSize : -1));
		expect(new Set(sizes).size).toBe(1);
	});

	it('falls back to the pre-existing 12pt/6pt heuristic bounds when the layoutDef declares no primFontSz', () => {
		const plan: ArrangementPlan = { kind: 'linear', node: { algorithm: { type: 'lin' } } };
		const result = arrangeLinear(
			plan,
			horizontal,
			[{ id: 'a', text: 'Hi' }],
			{ width: 400, height: 400 },
			['#fff'],
			'flat',
			'e',
		);
		const [rendered] = result.nodes;
		if (rendered.kind !== 'rect') {
			throw new Error('expected rect node');
		}
		expect(rendered.fontSize).toBeLessThanOrEqual(12);
		expect(rendered.fontSize).toBeGreaterThanOrEqual(6);
	});
});

// See `smartart-layout-shape-preset.ts`'s `roundRectCornerInsetPx` doc
// comment: a `roundRect`-family item's real text-fit box is inset further
// than its margins alone. `resolveTieredItemFontSize`'s own `cornerInsetPx`
// parameter (threaded from `arrangeLinear`/`arrangeSnake` via
// `roundRectCornerInsetPx`) is what applies it - exercised directly here at
// `basic-process--hier5.pptx`'s/`--hier8.pptx`'s REAL cached box (170.75 x
// 102.45pt) and text, since reproducing that exact box through the full
// `arrangeLinear` grid math would additionally require the real fixture's
// `sibSp`/`begPad`/`endPad` (unrelated to this fix) just to arrive at the
// same width.
describe('resolveTieredItemFontSize roundRect corner inset (basic-process--hier5.pptx/--hier8.pptx)', () => {
	const PT_TO_PX = 96 / 72;
	const BOX_W_PT = 170.75;
	const BOX_H_PT = 102.45;

	function basicProcessBounds(): {
		plan: ArrangementPlan;
		index: ReturnType<typeof buildConstraintIndex>;
	} {
		const itemNode: PptxSmartArtLayoutNode = {
			name: 'node',
			constraints: [
				{ type: 'lMarg', referenceType: 'primFontSz', factor: 0.3 },
				{ type: 'rMarg', referenceType: 'primFontSz', factor: 0.3 },
				{ type: 'tMarg', referenceType: 'primFontSz', factor: 0.3 },
				{ type: 'bMarg', referenceType: 'primFontSz', factor: 0.3 },
			],
			rules: [{ type: 'primFontSz', value: 5 }],
		};
		const rootNode: PptxSmartArtLayoutNode = {
			algorithm: { type: 'lin' },
			constraints: [{ type: 'primFontSz', for: 'ch', forName: 'node', value: 65 }],
			children: [itemNode],
		};
		const definition: PptxSmartArtLayoutDefinition = { rootNode };
		return { plan: { kind: 'linear', node: rootNode }, index: buildConstraintIndex(definition) };
	}

	/** `roundRectCornerInsetPx` at `basic-process`'s real box/adjustment (see `smartart-layout-shape-preset.test.ts`). */
	const cornerInsetPx = 0.1 * Math.min(BOX_W_PT, BOX_H_PT) * (1 - Math.SQRT2 / 2) * PT_TO_PX;

	it("resolves basic-process--hier5.pptx to 25pt (round 13: 1pt over cached 24pt, COM-confirmed WIDTH-bound; round 16's descendantIndentPt fixed --hier8.pptx's identical-shaped residual but NOT this one - see resolveTieredItemFontSize's own doc comment)", () => {
		const { plan, index } = basicProcessBounds();
		const { rootSizePx } = resolveTieredItemFontSize(
			plan,
			index,
			[
				{
					rootText: 'Node One',
					descendantTexts: ['Node Two has a longer label'],
					width: BOX_W_PT * PT_TO_PX,
					height: BOX_H_PT * PT_TO_PX,
				},
				{
					rootText: 'Node Three',
					descendantTexts: [],
					width: BOX_W_PT * PT_TO_PX,
					height: BOX_H_PT * PT_TO_PX,
				},
				{
					rootText: 'Node Four',
					descendantTexts: ['Node Five'],
					width: BOX_W_PT * PT_TO_PX,
					height: BOX_H_PT * PT_TO_PX,
				},
			],
			'Aptos',
			0.6,
			cornerInsetPx,
		);
		expect(rootSizePx / PT_TO_PX).toBeCloseTo(25, 0);
	});

	it('resolves basic-process--hier8.pptx to 19pt exactly (round 16: descendantIndentPt closes the round-13 1pt-over residual - see smartart-layout-item-font-tier-fit.ts)', () => {
		const { plan, index } = basicProcessBounds();
		const { rootSizePx } = resolveTieredItemFontSize(
			plan,
			index,
			[
				{
					rootText: 'Branch A Root',
					descendantTexts: ['Branch A Child', 'Branch A Grandchild with long text'],
					width: BOX_W_PT * PT_TO_PX,
					height: BOX_H_PT * PT_TO_PX,
				},
				{
					rootText: 'Branch B Root',
					descendantTexts: ['Branch B Child'],
					width: BOX_W_PT * PT_TO_PX,
					height: BOX_H_PT * PT_TO_PX,
				},
				{
					rootText: 'Branch C Root',
					descendantTexts: [],
					width: BOX_W_PT * PT_TO_PX,
					height: BOX_H_PT * PT_TO_PX,
				},
			],
			'Aptos',
			0.6,
			cornerInsetPx,
		);
		expect(rootSizePx / PT_TO_PX).toBeCloseTo(19, 0);
	});

	it("without the corner inset (cornerInsetPx=0), resolves to 26pt (round 13: the margin-only budget, now applied unconditionally, is generous enough that only the round-down-if-the-rounded-candidate-does-not-fit correction still bounds it - was 24pt before round 13's unconditional-margin/line-spacing rewrite)", () => {
		const { plan, index } = basicProcessBounds();
		const { rootSizePx } = resolveTieredItemFontSize(
			plan,
			index,
			[
				{
					rootText: 'Node One',
					descendantTexts: ['Node Two has a longer label'],
					width: BOX_W_PT * PT_TO_PX,
					height: BOX_H_PT * PT_TO_PX,
				},
				{
					rootText: 'Node Three',
					descendantTexts: [],
					width: BOX_W_PT * PT_TO_PX,
					height: BOX_H_PT * PT_TO_PX,
				},
				{
					rootText: 'Node Four',
					descendantTexts: ['Node Five'],
					width: BOX_W_PT * PT_TO_PX,
					height: BOX_H_PT * PT_TO_PX,
				},
			],
			'Aptos',
			0.6,
			// no cornerInsetPx argument: defaults to 0.
		);
		expect(rootSizePx / PT_TO_PX).toBeCloseTo(26, 0);
	});
});
