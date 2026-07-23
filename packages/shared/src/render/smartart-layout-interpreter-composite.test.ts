/**
 * Unit tests for the SmartArt DiagramML `composite` arranger.
 *
 * The composite algorithm positions a fixed set of child slots by their explicit
 * l/t/w/h (or ctrX/ctrY) constraints and maps one data point into each slot.
 * These tests build synthetic composite layout definitions and assert the
 * resolved rect geometry matches the constraint fractions of the box. No
 * framework, no DOM.
 */

import type { PptxSmartArtLayoutNode, PptxSmartArtNode } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { arrangeComposite } from './smartart-layout-interpreter-composite';
import type { ArrangementPlan } from './smartart-layout-interpreter-model';
import type { RenderedRectNode } from './smartart-layout-types';

const PALETTE = ['#3b82f6', '#22c55e', '#f97316', '#eab308'];
const BOX = { width: 400, height: 300 };
const STYLE = 'flat' as const;
const ID = 'el1';

function n(id: string, text: string): PptxSmartArtNode {
	return { id, text };
}

/**
 * Wrap a composite `layoutNode` in an ArrangementPlan. `arrangeComposite` only
 * reads `plan.node`, so the `kind` is a placeholder (the dispatcher owns the
 * real 'composite' kind wiring).
 */
function plan(node: PptxSmartArtLayoutNode): ArrangementPlan {
	return { kind: 'linear', node };
}

const rects = (nodes: ReadonlyArray<{ kind: string }>): RenderedRectNode[] =>
	nodes.filter((node): node is RenderedRectNode => node.kind === 'rect');

/** Every rect lies fully inside the box. */
function withinBounds(boxes: RenderedRectNode[]): boolean {
	return boxes.every(
		(b) =>
			b.x >= -0.001 &&
			b.y >= -0.001 &&
			b.x + b.width <= BOX.width + 0.001 &&
			b.y + b.height <= BOX.height + 0.001,
	);
}

describe('arrangeComposite - left / right slots', () => {
	// Two side-by-side half-width, full-height slots (title + body pattern).
	const node: PptxSmartArtLayoutNode = {
		algorithm: { type: 'composite' },
		children: [
			{
				algorithm: { type: 'sp' },
				constraints: [
					{ type: 'l', referenceType: 'w', factor: 0 },
					{ type: 't', referenceType: 'h', factor: 0 },
					{ type: 'w', referenceType: 'w', factor: 0.5 },
					{ type: 'h', referenceType: 'h', factor: 1 },
				],
			},
			{
				algorithm: { type: 'tx' },
				constraints: [
					{ type: 'l', referenceType: 'w', factor: 0.5 },
					{ type: 't', referenceType: 'h', factor: 0 },
					{ type: 'w', referenceType: 'w', factor: 0.5 },
					{ type: 'h', referenceType: 'h', factor: 1 },
				],
			},
		],
	};
	const nodes = [n('1', 'A'), n('2', 'B')];

	it('maps two data nodes into the two positioned slots', () => {
		const layout = arrangeComposite(plan(node), nodes, BOX, PALETTE, STYLE, ID);
		expect(layout).toBeDefined();
		const boxes = rects(layout!.nodes);
		expect(boxes).toHaveLength(2);
		expect(layout!.family).toBe('list');
	});

	it('resolves l/w/h constraints to box fractions', () => {
		const boxes = rects(arrangeComposite(plan(node), nodes, BOX, PALETTE, STYLE, ID)!.nodes);
		const [left, right] = boxes;
		expect(left.x).toBeCloseTo(0, 3);
		expect(left.width).toBeCloseTo(200, 3);
		expect(left.height).toBeCloseTo(300, 3);
		expect(right.x).toBeCloseTo(200, 3);
		expect(right.width).toBeCloseTo(200, 3);
	});

	it('keeps every slot inside the box', () => {
		const boxes = rects(arrangeComposite(plan(node), nodes, BOX, PALETTE, STYLE, ID)!.nodes);
		expect(withinBounds(boxes)).toBeTruthy();
	});

	it('caps the rendered rects at the slot count when data exceeds slots', () => {
		const many = [n('1', 'A'), n('2', 'B'), n('3', 'C')];
		const boxes = rects(arrangeComposite(plan(node), many, BOX, PALETTE, STYLE, ID)!.nodes);
		expect(boxes).toHaveLength(2);
	});
});

describe('arrangeComposite - centre-based slot', () => {
	// A single slot centred on the box via ctrX / ctrY at 40% x 40% size.
	const node: PptxSmartArtLayoutNode = {
		algorithm: { type: 'composite' },
		children: [
			{
				algorithm: { type: 'sp' },
				constraints: [
					{ type: 'ctrX', referenceType: 'w', factor: 0.5 },
					{ type: 'ctrY', referenceType: 'h', factor: 0.5 },
					{ type: 'w', referenceType: 'w', factor: 0.4 },
					{ type: 'h', referenceType: 'h', factor: 0.4 },
				],
			},
		],
	};

	it('centres the slot from ctrX / ctrY', () => {
		const boxes = rects(
			arrangeComposite(plan(node), [n('1', 'A')], BOX, PALETTE, STYLE, ID)!.nodes,
		);
		expect(boxes).toHaveLength(1);
		const slot = boxes[0];
		expect(slot.width).toBeCloseTo(160, 3);
		expect(slot.height).toBeCloseTo(120, 3);
		// centre 0.5*400 = 200, so x = 200 - 80 = 120; centre 0.5*300 = 150, y = 90.
		expect(slot.x).toBeCloseTo(120, 3);
		expect(slot.y).toBeCloseTo(90, 3);
		expect(slot.textX).toBeCloseTo(200, 3);
		expect(slot.textY).toBeCloseTo(150, 3);
	});
});

describe('arrangeComposite - degrade paths', () => {
	it('returns undefined when no child positions itself', () => {
		const node: PptxSmartArtLayoutNode = {
			algorithm: { type: 'composite' },
			children: [{ algorithm: { type: 'sp' } }, { algorithm: { type: 'tx' } }],
		};
		expect(arrangeComposite(plan(node), [n('1', 'A')], BOX, PALETTE, STYLE, ID)).toBeUndefined();
	});

	it('returns undefined when the composite has no children', () => {
		const node: PptxSmartArtLayoutNode = { algorithm: { type: 'composite' } };
		expect(arrangeComposite(plan(node), [n('1', 'A')], BOX, PALETTE, STYLE, ID)).toBeUndefined();
	});

	it('returns undefined when there are no data points', () => {
		const node: PptxSmartArtLayoutNode = {
			algorithm: { type: 'composite' },
			children: [{ constraints: [{ type: 'w', referenceType: 'w', factor: 0.5 }] }],
		};
		expect(arrangeComposite(plan(node), [], BOX, PALETTE, STYLE, ID)).toBeUndefined();
	});
});

describe('arrangeComposite - absolute values degrade within bounds', () => {
	// EMU-ish absolute constraints (val > 1) are normalised against the widest
	// slot so everything still fits the box.
	const node: PptxSmartArtLayoutNode = {
		algorithm: { type: 'composite' },
		children: [
			{
				constraints: [
					{ type: 'l', value: 0 },
					{ type: 't', value: 0 },
					{ type: 'w', value: 5000 },
					{ type: 'h', value: 10000 },
				],
			},
			{
				constraints: [
					{ type: 'l', value: 5000 },
					{ type: 't', value: 0 },
					{ type: 'w', value: 5000 },
					{ type: 'h', value: 10000 },
				],
			},
		],
	};

	it('scales absolute slots to fit and stays in bounds', () => {
		const boxes = rects(
			arrangeComposite(plan(node), [n('1', 'A'), n('2', 'B')], BOX, PALETTE, STYLE, ID)!.nodes,
		);
		expect(boxes).toHaveLength(2);
		expect(withinBounds(boxes)).toBeTruthy();
		// Widest X edge is left(5000)+width(5000) = 10000 -> maps to box.width 400.
		// So each 5000-wide slot resolves to 200 px, second slot starts at 200.
		expect(boxes[0].width).toBeCloseTo(200, 1);
		expect(boxes[1].x).toBeCloseTo(200, 1);
	});
});
