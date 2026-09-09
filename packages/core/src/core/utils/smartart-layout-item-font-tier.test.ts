import { describe, expect, it } from 'vitest';

import type {
	PptxSmartArtLayoutDefinition,
	PptxSmartArtLayoutNode,
	PptxSmartArtNode,
} from '../types';
import { buildConstraintIndex } from './smartart-constraint-solver';
import { arrangeSnake } from './smartart-layout-interpreter-linear';
import type { ArrangementPlan } from './smartart-layout-interpreter-model';
import {
	resolveTieredItemFontSize,
	SMARTART_DESCENDANT_FONT_SCALE,
} from './smartart-layout-item-font-tier';

/** Points per CSS pixel at PowerPoint's 96 DPI convention (matches the source module). */
const PT_TO_PX = 96 / 72;

/**
 * "Basic Block List"'s real `layout1.xml` (`ppt/diagrams/layout1.xml` inside
 * `smartart-gallery/basic-block-list--hier5.pptx`), reproduced verbatim
 * including the item node's own proportional margins and shrink floor -
 * `smartart-layout-interpreter-linear.test.ts`'s own `blockListDefinition`
 * omits those two (it only exercises grid/gap geometry), so this copy adds
 * them for a numerically-faithful font-fit test.
 */
function blockListDefinitionWithItemBounds(): {
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
		children: [itemNode, { name: 'sibTrans' }],
	};
	const definition: PptxSmartArtLayoutDefinition = { rootNode };
	return { plan: { kind: 'snake', node: rootNode }, index: buildConstraintIndex(definition) };
}

describe('the SMARTART_DESCENDANT_FONT_SCALE constant', () => {
	it('is the data-derived FIXED ratio (see module doc comment: round(root*K)===desc for 54/56 real corpus rows), not a gate-tuned value - regression guard against silent drift', () => {
		expect(SMARTART_DESCENDANT_FONT_SCALE).toBeCloseTo(0.78, 5);
	});

	it('reproduces every unique (rootSz, descSz) pair from the corpus scan via simple rounding (see module doc comment for the excluded outliers)', () => {
		// A representative sample of the 34 unique whole-point pairs found
		// across the 53 two-tier fixtures (not every pair - see the module doc
		// comment's own derivation for the full set).
		const pairs: Array<[number, number]> = [
			[48, 37], // basic-block-list--hier5
			[37, 29], // basic-block-list--hier8 (root; see the arrangeSnake test below for the known 1pt gap on the FULL joint search)
			[19, 15], // basic-process--hier8 / picture-caption-list--hier5
			[8, 6], // picture-grid--hier5
			[46, 36], // varying-width-list--hier5
			[5, 4], // meet-the-team--hier8
		];
		for (const [root, desc] of pairs) {
			expect(Math.round(root * SMARTART_DESCENDANT_FONT_SCALE)).toBe(desc);
		}
	});
});

describe('resolveTieredItemFontSize', () => {
	it('degenerates to a plain single-paragraph fit when no item has a folded descendant (no descendantTexts)', () => {
		const { plan, index } = blockListDefinitionWithItemBounds();
		const { rootSizePx, descendantSizePx } = resolveTieredItemFontSize(
			plan,
			index,
			[{ rootText: 'Node Three', descendantTexts: [], width: 413, height: 246 }],
			undefined,
			undefined,
		);
		// A single short word never needs to shrink below the declared ceiling
		// (65pt): with no descendant term at all, the fit degenerates to the
		// item's own root-only content check.
		expect(rootSizePx).toBeCloseTo(65 * PT_TO_PX, 5);
		// descendantSizePx is snapped to the nearest whole point (see
		// `snapToWholePoint`), so compare in POINTS with 0 decimal digits
		// rather than asserting the raw, unsnapped `rootSizePx * SCALE` product.
		expect(descendantSizePx / PT_TO_PX).toBeCloseTo(
			(rootSizePx * SMARTART_DESCENDANT_FONT_SCALE) / PT_TO_PX,
			0,
		);
	});

	it("a folded descendant's resolved size is always smaller than the item's own top-level size (matches every two-tier cached fixture measured - see module doc comment)", () => {
		const { plan, index } = blockListDefinitionWithItemBounds();
		const { rootSizePx, descendantSizePx } = resolveTieredItemFontSize(
			plan,
			index,
			[
				{
					rootText: 'Node One',
					descendantTexts: ['Node Two has a longer label'],
					width: 413,
					height: 246,
				},
				{ rootText: 'Node Three', descendantTexts: [], width: 413, height: 246 },
			],
			undefined,
			undefined,
		);
		expect(descendantSizePx).toBeLessThan(rootSizePx);
	});
});

describe('arrangeSnake two-tier fold-aware font fit (basic-block-list--hier5.pptx, EXACT)', () => {
	function nodesFor(): PptxSmartArtNode[] {
		return [
			{ id: 'n1', text: 'Node One' },
			{ id: 'n3', text: 'Node Three' },
			{ id: 'n4', text: 'Node Four' },
		];
	}
	function childrenOf(): Map<string, PptxSmartArtNode[]> {
		return new Map([
			['n1', [{ id: 'n2', text: 'Node Two has a longer label' }]],
			['n4', [{ id: 'n5', text: 'Node Five' }]],
		]);
	}

	it('resolves the cached 48pt root size exactly, using the data-derived K=0.78 (see module doc comment)', () => {
		const { plan, index } = blockListDefinitionWithItemBounds();
		const box = { width: 867, height: 533 };
		const result = arrangeSnake(
			plan,
			nodesFor(),
			box,
			['#fff'],
			'flat',
			'e',
			index,
			childrenOf(),
			'Aptos',
		);
		const [first] = result.nodes;
		if (first.kind !== 'rect') {
			throw new Error('expected rect node');
		}
		expect(first.fontSize / PT_TO_PX).toBeCloseTo(48, 0);
		// Cached descendant size is 37pt; round(48*0.78)=37, exact too.
		expect((first.descendantFontSize ?? 0) / PT_TO_PX).toBeCloseTo(37, 0);
		expect(first.descendantFontSize ?? 0).toBeLessThan(first.fontSize);
	});
});

describe('arrangeSnake two-tier fold-aware font fit (basic-block-list--hier8.pptx, EXACT since round 16)', () => {
	/**
	 * `basic-block-list--hier8.pptx`'s real data: "Branch A Root" (level 0)
	 * folds TWO deeper descendants, "Branch A Child" (level 1) and "Branch A
	 * Grandchild with long text" (level 2) - the cached `drawing1.xml` gives
	 * BOTH descendant paragraphs the SAME size (29pt) regardless of their
	 * different depth, confirming the two-tier split is level-0-vs-everything-
	 * else, not a per-depth cascade (see `smartart-layout-item-font-tier.ts`'s
	 * module doc comment). Cached root/descendant pair: 37pt/29pt.
	 *
	 * Round 6 through 15 pinned this to a documented 1pt-over residual (38pt):
	 * the joint search's continuous convergence (~38.34pt) rounded to 38 and
	 * held there. Round 16 (`smartart-layout-item-font-tier-fit.ts`'s
	 * `descendantIndentPt`, wrapping each descendant paragraph at its own
	 * narrower, hanging-indented column instead of the item's full width)
	 * closes this exactly - the narrower column adds enough height pressure
	 * that the 38pt candidate no longer fits, landing on the cached 37pt.
	 */
	function nodesFor(): PptxSmartArtNode[] {
		return [
			{ id: 'a-root', text: 'Branch A Root' },
			{ id: 'b-root', text: 'Branch B Root' },
			{ id: 'c-root', text: 'Branch C Root' },
		];
	}
	function childrenOf(): Map<string, PptxSmartArtNode[]> {
		return new Map([
			[
				'a-root',
				[
					{ id: 'a-child', text: 'Branch A Child' },
					{ id: 'a-grandchild', text: 'Branch A Grandchild with long text' },
				],
			],
			['b-root', [{ id: 'b-child', text: 'Branch B Child' }]],
		]);
	}

	it('resolves the cached 37pt root size exactly (round 16: fixed the round 6-15 documented 38pt residual)', () => {
		const { plan, index } = blockListDefinitionWithItemBounds();
		const box = { width: 867, height: 533 };
		const result = arrangeSnake(
			plan,
			nodesFor(),
			box,
			['#fff'],
			'flat',
			'e',
			index,
			childrenOf(),
			'Aptos',
		);
		const [first] = result.nodes;
		if (first.kind !== 'rect') {
			throw new Error('expected rect node');
		}
		expect(first.fontSize / PT_TO_PX).toBeCloseTo(37, 0);
		expect(first.descendantFontSize ?? 0).toBeLessThan(first.fontSize);
	});
});

// Round 8: the `cornerInsetPx` vertical budget is anchor-conditioned (see
// `resolveTieredItemFontSize`'s own doc comment for the full derivation from
// `basic-process--hier5.pptx`'s/`--flat3.pptx`'s cached `dsp:txXfrm`/`anchor`),
// and the final continuous-to-whole-point snap can round UP past a size that
// does not itself fit. Both exercised directly here (not through
// `arrangeLinear`/`arrangeSnake`) with a hand-built box, isolated from real
// fixture geometry noise.
describe('resolveTieredItemFontSize cornerInsetPx vertical budget (round 8)', () => {
	function definitionWithCeiling(ceiling: number): {
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
			constraints: [{ type: 'primFontSz', for: 'ch', forName: 'node', value: ceiling }],
			children: [itemNode],
		};
		const definition: PptxSmartArtLayoutDefinition = { rootNode };
		return { plan: { kind: 'linear', node: rootNode }, index: buildConstraintIndex(definition) };
	}

	it('a non-folded item with cornerInsetPx > 0 uses avail = naturalHeight - 2*cornerInsetPx (NO margin subtraction)', () => {
		const { plan, index } = definitionWithCeiling(65);
		// naturalHeight=1000px, cornerInsetPx=100px: avail should be exactly 800px.
		// A single-line item easily fits at any size within [floor, ceiling]
		// regardless of margin, so this only distinguishes the two models when
		// margin would otherwise dominate - use a near-ceiling height budget
		// that a margin-inclusive model (naturalHeight - marginsV - 2*100) would
		// reject at the ceiling but the margin-EXCLUSIVE model accepts.
		const { rootSizePx } = resolveTieredItemFontSize(
			plan,
			index,
			[{ rootText: 'Hi', descendantTexts: [], width: 1000, height: 780 }],
			undefined,
			undefined,
			100,
		);
		// naturalHeight=780, avail=780-200=580px; a short line at the 65pt
		// ceiling (86.67px) easily fits either way - assert the ceiling wins,
		// confirming the non-folded branch did not spuriously shrink it via an
		// unintended margin subtraction on top of the corner inset.
		expect(rootSizePx).toBeCloseTo(65 * PT_TO_PX, 5);
	});

	it('a non-folded item with cornerInsetPx === 0 (plain rect) keeps the ORIGINAL margins-only reduction, not "no reduction at all"', () => {
		const { plan, index } = definitionWithCeiling(65);
		// height=100px total, no corner inset: if margins were (wrongly) also
		// dropped here, the item would trivially fit the 65pt ceiling; the
		// ORIGINAL (margins-only) model shrinks it well below the ceiling.
		const { rootSizePx } = resolveTieredItemFontSize(
			plan,
			index,
			[
				{
					rootText: 'A very much longer line of label text here',
					descendantTexts: [],
					width: 200,
					height: 100,
				},
			],
			undefined,
			undefined,
			0,
		);
		expect(rootSizePx).toBeLessThan(65 * PT_TO_PX);
	});

	it("the final snap never rounds UP to a whole-point size that does not itself fit (basic-process--flat3.pptx's real box/text: continuous convergence ~19.9pt, cached 19pt)", () => {
		// Real cached geometry (smartart-gallery/basic-process--flat3.pptx):
		// 170.75x102.45pt roundRect box, adj=10% (cornerInsetPx ~= 3.01pt =
		// 4.01px), self-scoped h/w aspect 0.6, "Beta has a noticeably longer
		// label than the others" (non-folded, `anchor="ctr"`). Math.round on
		// the raw continuous convergence (~19.9pt) would give 20pt, which does
		// NOT fit its own budget - only the round-down correction lands on the
		// cached 19pt.
		const { plan, index } = definitionWithCeiling(65);
		const boxWpx = 170.75 * PT_TO_PX;
		const boxHpx = 102.45 * PT_TO_PX;
		const cornerInsetPx = 0.1 * Math.min(boxWpx, boxHpx) * (1 - Math.SQRT2 / 2);
		const { rootSizePx } = resolveTieredItemFontSize(
			plan,
			index,
			[
				{
					rootText: 'Beta has a noticeably longer label than the others',
					descendantTexts: [],
					width: boxWpx,
					height: boxHpx,
				},
			],
			'Aptos',
			0.6,
			cornerInsetPx,
		);
		expect(rootSizePx / PT_TO_PX).toBeCloseTo(19, 0);
	});
});
