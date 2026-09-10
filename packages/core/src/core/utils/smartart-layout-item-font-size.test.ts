import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutDefinition, PptxSmartArtLayoutNode } from '../types';
import { buildConstraintIndex, roleOf } from './smartart-constraint-solver';
import type { ArrangementPlan } from './smartart-layout-interpreter-model';
import {
	proportionalMarginFraction,
	resolveSharedItemFontSize,
	snapToWholePoint,
} from './smartart-layout-item-font-size';

/** Points per CSS pixel at PowerPoint's 96 DPI convention (matches the source module). */
const PT_TO_PX = 96 / 72;

function planWithItem(
	itemNode: PptxSmartArtLayoutNode,
	extraConstraints: PptxSmartArtLayoutNode['constraints'] = [],
) {
	const rootNode: PptxSmartArtLayoutNode = {
		algorithm: { type: 'lin' },
		constraints: [
			{ type: 'primFontSz', for: 'ch', forName: 'item', value: 65 },
			...(extraConstraints ?? []),
		],
		children: [itemNode],
	};
	const definition: PptxSmartArtLayoutDefinition = { rootNode };
	const plan: ArrangementPlan = { kind: 'linear', node: rootNode };
	return { plan, index: buildConstraintIndex(definition) };
}

describe('resolveSharedItemFontSize', () => {
	it('converts the declared primFontSz ceiling from POINTS to PIXELS (dgm:constr is in points; box geometry is in pixels)', () => {
		const itemNode: PptxSmartArtLayoutNode = { name: 'item' };
		const { plan, index } = planWithItem(itemNode);
		const size = resolveSharedItemFontSize(plan, index, [
			{ text: 'Short', width: 200, height: 500 },
		]);
		expect(size).toBeCloseTo(65 * PT_TO_PX, 5);
	});

	it('picks the minimum of the ruleLst primFontSz rules as the floor (5pt, not 18pt), also converted to pixels', () => {
		const itemNode: PptxSmartArtLayoutNode = {
			name: 'item',
			rules: [
				{ type: 'primFontSz', value: 18 },
				{ type: 'h', factor: 1.5 },
				{ type: 'primFontSz', value: 5 },
				{ type: 'h', value: Number.POSITIVE_INFINITY },
			],
		};
		const { plan, index } = planWithItem(itemNode);
		const longText = 'word '.repeat(60).trim();
		const size = resolveSharedItemFontSize(plan, index, [
			{ text: longText, width: 40, height: 20 },
		]);
		expect(size).toBeCloseTo(5 * PT_TO_PX, 5);
	});

	it('returns the diagram-wide minimum across every item, not each item its own fit', () => {
		const itemNode: PptxSmartArtLayoutNode = {
			name: 'item',
			rules: [{ type: 'primFontSz', value: 6 }],
		};
		const { plan, index } = planWithItem(itemNode);
		const size = resolveSharedItemFontSize(plan, index, [
			{ text: 'Hi', width: 300, height: 300 },
			{
				text: 'A very long piece of label text that will not fit at the ceiling',
				width: 150,
				height: 40,
			},
		]);
		expect(size).toBeLessThan(65 * PT_TO_PX);
	});

	it('falls back to the legacy 12px/6px bounds when nothing declares primFontSz', () => {
		const rootNode: PptxSmartArtLayoutNode = {
			algorithm: { type: 'lin' },
			children: [{ name: 'item' }],
		};
		const definition: PptxSmartArtLayoutDefinition = { rootNode };
		const plan: ArrangementPlan = { kind: 'linear', node: rootNode };
		const index = buildConstraintIndex(definition);
		const size = resolveSharedItemFontSize(plan, index, [{ text: 'Hi', width: 300, height: 300 }]);
		expect(size).toBeLessThanOrEqual(12);
	});

	it("subtracts the item's OWN dgm:constr lMarg/rMarg/tMarg/bMarg insets, not just the default textbox margin", () => {
		const itemNode: PptxSmartArtLayoutNode = { name: 'item' };
		// A huge declared margin (relative to the box) leaves almost no room,
		// forcing a much smaller fit than the default 0.1in/0.05in would.
		const { plan, index } = planWithItem(itemNode, [
			{ type: 'lMarg', for: 'ch', forName: 'item', value: 40 },
			{ type: 'rMarg', for: 'ch', forName: 'item', value: 40 },
		]);
		const withBigMargin = resolveSharedItemFontSize(plan, index, [
			{ text: 'A somewhat long label here', width: 150, height: 80 },
		]);
		const { plan: planNoMargin, index: indexNoMargin } = planWithItem({ name: 'item' });
		const withDefaultMargin = resolveSharedItemFontSize(planNoMargin, indexNoMargin, [
			{ text: 'A somewhat long label here', width: 150, height: 80 },
		]);
		expect(withBigMargin).toBeLessThan(withDefaultMargin);
	});

	it('every returned size is an exact whole point in pixels (no fractional-point result)', () => {
		const itemNode: PptxSmartArtLayoutNode = {
			name: 'item',
			rules: [{ type: 'primFontSz', value: 5 }],
		};
		const { plan, index } = planWithItem(itemNode);
		const size = resolveSharedItemFontSize(plan, index, [
			{ text: 'A moderately long label that needs some shrinking', width: 140, height: 60 },
		]);
		const pointValue = size / PT_TO_PX;
		expect(pointValue).toBeCloseTo(Math.round(pointValue), 5);
	});

	it('resolves for an unmeasured font via the cross-font default table without throwing', () => {
		const itemNode: PptxSmartArtLayoutNode = { name: 'item' };
		const { plan, index } = planWithItem(itemNode);
		const size = resolveSharedItemFontSize(
			plan,
			index,
			[{ text: 'Some label', width: 200, height: 100 }],
			'Some Obscure Font Nobody Measured',
		);
		expect(size).toBeGreaterThan(0);
	});
});

describe('proportionalMarginFraction', () => {
	it("defaults to 0.56 per side (1.12 per axis) when a role declares NO lMarg/rMarg/tMarg/bMarg constraint at all - COM-verified against repeating-bending-process--hier5.pptx's real 'node' role (TextFrame2.Margin{Left,Right,Top,Bottom} all 21.28pt at cached Font.Size=38, exactly 0.56*38; cached a:bodyPr lIns=270256 EMU confirms it)", () => {
		const itemNode: PptxSmartArtLayoutNode = {
			name: 'node',
			// Only a non-margin constraint declared, matching the real fixture.
			constraints: [{ type: 'h', referenceType: 'w', factor: 0.6 }],
		};
		const rootNode: PptxSmartArtLayoutNode = {
			algorithm: { type: 'lin' },
			constraints: [],
			children: [itemNode],
		};
		const definition: PptxSmartArtLayoutDefinition = { rootNode };
		const index = buildConstraintIndex(definition);
		const result = proportionalMarginFraction(index, roleOf(itemNode));
		expect(result?.horizontal).toBeCloseTo(1.12, 5);
		expect(result?.vertical).toBeCloseTo(1.12, 5);
	});

	it('does NOT apply the no-constraint default when a margin constraint is declared but not primFontSz-proportional (a literal val, e.g. the round 10/12 connectorText pattern) - the caller keeps its own fixed fallback for that axis instead', () => {
		const itemNode: PptxSmartArtLayoutNode = {
			name: 'connectorText',
			constraints: [
				{ type: 'lMarg', value: 1 },
				{ type: 'rMarg', value: 1 },
				{ type: 'tMarg', value: 1 },
				{ type: 'bMarg', value: 1 },
			],
		};
		const rootNode: PptxSmartArtLayoutNode = {
			algorithm: { type: 'lin' },
			constraints: [],
			children: [itemNode],
		};
		const definition: PptxSmartArtLayoutDefinition = { rootNode };
		const index = buildConstraintIndex(definition);
		expect(proportionalMarginFraction(index, roleOf(itemNode))).toBeUndefined();
	});

	it('still resolves an explicitly declared primFontSz-proportional margin exactly as before (unaffected by the new default)', () => {
		const itemNode: PptxSmartArtLayoutNode = {
			name: 'node',
			constraints: [
				{ type: 'lMarg', referenceType: 'primFontSz', factor: 0.3 },
				{ type: 'rMarg', referenceType: 'primFontSz', factor: 0.3 },
				{ type: 'tMarg', referenceType: 'primFontSz', factor: 0.3 },
				{ type: 'bMarg', referenceType: 'primFontSz', factor: 0.3 },
			],
		};
		const rootNode: PptxSmartArtLayoutNode = {
			algorithm: { type: 'lin' },
			constraints: [],
			children: [itemNode],
		};
		const definition: PptxSmartArtLayoutDefinition = { rootNode };
		const index = buildConstraintIndex(definition);
		const result = proportionalMarginFraction(index, roleOf(itemNode));
		expect(result?.horizontal).toBeCloseTo(0.6, 5);
		expect(result?.vertical).toBeCloseTo(0.6, 5);
	});
});

describe('snapToWholePoint', () => {
	it('snaps a pixel size to the nearest whole-point pixel equivalent', () => {
		expect(snapToWholePoint(10 * PT_TO_PX + 0.3)).toBeCloseTo(10 * PT_TO_PX, 5);
		expect(snapToWholePoint(10 * PT_TO_PX - 0.3)).toBeCloseTo(10 * PT_TO_PX, 5);
	});
});
