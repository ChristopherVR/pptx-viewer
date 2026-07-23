/**
 * Unit tests for the SmartArt DiagramML auxiliary arrangers (conn / sp / tx).
 *
 * Pure geometry - no framework, no DOM. These verify the standalone best-effort
 * behaviour documented in `smartart-layout-interpreter-aux.ts`.
 */

import type { PptxSmartArtLayoutNode, PptxSmartArtNode } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { arrangeConn, arrangeSpacer, arrangeText } from './smartart-layout-interpreter-aux';
import type { ArrangementPlan } from './smartart-layout-interpreter-model';
import type { RenderedRectNode } from './smartart-layout-types';

const PALETTE = ['#3b82f6', '#22c55e', '#f97316', '#eab308', '#a855f7'];
const BOX = { width: 400, height: 300 };
const STYLE = 'flat' as const;
const ID = 'el1';

function n(id: string, text: string): PptxSmartArtNode {
	return { id, text };
}

function plan(node: PptxSmartArtLayoutNode): ArrangementPlan {
	return { kind: 'linear', node };
}

const LIN_PLAN = plan({
	algorithm: { type: 'conn', parameters: [{ type: 'linDir', value: 'fromL' }] },
	children: [{ algorithm: { type: 'tx' } }],
});

const rects = (nodes: ReadonlyArray<{ kind: string }>): RenderedRectNode[] =>
	nodes.filter((node): node is RenderedRectNode => node.kind === 'rect');

// -- conn -----------------------------------------------------------------------

describe('arrangeConn', () => {
	const nodes = [n('1', 'A'), n('2', 'B'), n('3', 'C')];

	it('produces N-1 connectors for N nodes', () => {
		const layout = arrangeConn(LIN_PLAN, nodes, BOX, PALETTE, STYLE, ID);
		expect(layout).toBeDefined();
		expect(rects(layout!.nodes)).toHaveLength(3);
		expect(layout!.connectors).toHaveLength(2);
		expect(layout!.family).toBe('process');
	});

	it('emits a single connector for two nodes and none for one', () => {
		const two = arrangeConn(LIN_PLAN, [n('1', 'A'), n('2', 'B')], BOX, PALETTE, STYLE, ID);
		expect(two!.connectors).toHaveLength(1);
		const one = arrangeConn(LIN_PLAN, [n('1', 'A')], BOX, PALETTE, STYLE, ID);
		expect(one!.connectors).toHaveLength(0);
	});

	it('returns undefined when there are no nodes', () => {
		expect(arrangeConn(LIN_PLAN, [], BOX, PALETTE, STYLE, ID)).toBeUndefined();
	});

	it('draws each connector as a non-empty SVG path with an arrowhead', () => {
		const layout = arrangeConn(LIN_PLAN, nodes, BOX, PALETTE, STYLE, ID);
		for (const conn of layout!.connectors) {
			expect(conn.d.startsWith('M')).toBeTruthy();
			// Line segment + arrowhead chevron => at least two sub-paths.
			expect(conn.d.split('M').length).toBeGreaterThan(2);
		}
		expect(layout!.connectors[0].key).toBe(`${ID}-conn-0`);
	});

	it('links consecutive rects along the horizontal flow axis', () => {
		const layout = arrangeConn(LIN_PLAN, nodes, BOX, PALETTE, STYLE, ID);
		const boxes = rects(layout!.nodes);
		// First connector should start at the trailing edge of the first rect.
		const trailing = boxes[0].x + boxes[0].width;
		expect(layout!.connectors[0].d.startsWith(`M${trailing},`)).toBeTruthy();
	});

	it('honours reversed linDir (fromR) for the connector geometry', () => {
		const revPlan = plan({
			algorithm: { type: 'conn', parameters: [{ type: 'linDir', value: 'fromR' }] },
			children: [{ algorithm: { type: 'tx' } }],
		});
		const layout = arrangeConn(revPlan, nodes, BOX, PALETTE, STYLE, ID);
		const boxes = rects(layout!.nodes);
		// Data node '1' sits to the right of node '3' when reversed.
		const first = boxes.find((b) => b.key.includes('-lin-1-'))!;
		const third = boxes.find((b) => b.key.includes('-lin-3-'))!;
		expect(first.x).toBeGreaterThan(third.x);
		expect(layout!.connectors).toHaveLength(2);
	});
});

// -- sp -------------------------------------------------------------------------

describe('arrangeSpacer', () => {
	it('produces no drawn nodes and no connectors', () => {
		const layout = arrangeSpacer(LIN_PLAN, [n('1', 'A')], BOX, PALETTE, STYLE, ID);
		expect(layout).toBeDefined();
		expect(layout!.nodes).toHaveLength(0);
		expect(layout!.connectors).toHaveLength(0);
	});

	it('still reports a viewBox matching the box', () => {
		const layout = arrangeSpacer(LIN_PLAN, [], BOX, PALETTE, STYLE, ID);
		expect(layout!.viewBox).toBe('0 0 400 300');
	});
});

// -- tx -------------------------------------------------------------------------

describe('arrangeText', () => {
	it('fills the box with a single rect for the first point', () => {
		const layout = arrangeText(LIN_PLAN, [n('1', 'Hello')], BOX, PALETTE, STYLE, ID);
		expect(layout).toBeDefined();
		const boxes = rects(layout!.nodes);
		expect(boxes).toHaveLength(1);
		const rect = boxes[0];
		// Rect spans (almost) the whole box, inset by a small margin.
		expect(rect.x).toBeLessThan(BOX.width * 0.05);
		expect(rect.y).toBeLessThan(BOX.height * 0.05);
		expect(rect.width).toBeGreaterThan(BOX.width * 0.9);
		expect(rect.height).toBeGreaterThan(BOX.height * 0.9);
		expect(rect.text).toBe('Hello');
	});

	it('ignores extra points (only the first fills the region)', () => {
		const layout = arrangeText(LIN_PLAN, [n('1', 'A'), n('2', 'B')], BOX, PALETTE, STYLE, ID);
		expect(rects(layout!.nodes)).toHaveLength(1);
		expect(layout!.connectors).toHaveLength(0);
	});

	it('returns undefined when there is no point to render', () => {
		expect(arrangeText(LIN_PLAN, [], BOX, PALETTE, STYLE, ID)).toBeUndefined();
	});
});
