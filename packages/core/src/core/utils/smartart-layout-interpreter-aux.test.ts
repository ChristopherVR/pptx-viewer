/**
 * G5 regression coverage: `conn` algorithm params (`begSty`/`endSty`/`connRout`/
 * `dim`) that `smartart-layout-interpreter-aux.test.ts` (packages/shared, which
 * resolves `arrangeConn` through the built `pptx-viewer-core` package) cannot
 * exercise against source until core is rebuilt. Colocated here so it runs
 * against this package's own source directly.
 */

import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutNode, PptxSmartArtNode } from '../types';
import { arrangeConn } from './smartart-layout-interpreter-aux';
import type { ArrangementPlan } from './smartart-layout-interpreter-model';
import type { RenderedRectNode } from './smartart-layout-types';

const PALETTE = ['#3b82f6', '#22c55e', '#f97316'];
const BOX = { width: 400, height: 300 };
const STYLE = 'flat' as const;
const ID = 'el1';

function n(id: string, text: string): PptxSmartArtNode {
	return { id, text };
}

function plan(node: PptxSmartArtLayoutNode): ArrangementPlan {
	return { kind: 'conn', node };
}

const nodes = [n('1', 'A'), n('2', 'B'), n('3', 'C')];

const rects = (list: ReadonlyArray<{ kind: string }>): RenderedRectNode[] =>
	list.filter((node): node is RenderedRectNode => node.kind === 'rect');

describe('arrangeConn algorithm params (G5)', () => {
	it('begSty=arr draws an arrowhead at BOTH ends', () => {
		const withDefault = plan({ algorithm: { type: 'conn' }, children: [{ name: 'item' }] });
		const withBeg = plan({
			algorithm: { type: 'conn', parameters: [{ type: 'begSty', value: 'arr' }] },
			children: [{ name: 'item' }],
		});
		const defaultLayout = arrangeConn(withDefault, nodes, BOX, PALETTE, STYLE, ID)!;
		const bothLayout = arrangeConn(withBeg, nodes, BOX, PALETTE, STYLE, ID)!;
		// Default: one arrowhead (end) => line-M + head-M = 2 'M's per path.
		expect(defaultLayout.connectors[0].d.split('M')).toHaveLength(3);
		// begSty=arr adds a second arrowhead at the start => 3 'M's per path.
		expect(bothLayout.connectors[0].d.split('M')).toHaveLength(4);
	});

	it('endSty=noArr removes the default target arrowhead', () => {
		const noArrows = plan({
			algorithm: {
				type: 'conn',
				parameters: [{ type: 'endSty', value: 'noArr' }],
			},
			children: [{ name: 'item' }],
		});
		const layout = arrangeConn(noArrows, nodes, BOX, PALETTE, STYLE, ID)!;
		// Just the line segment: exactly one 'M'.
		expect(layout.connectors[0].d.split('M')).toHaveLength(2);
	});

	it('connRout=bend draws a 3-point orthogonal elbow instead of a straight line', () => {
		const bendPlan = plan({
			algorithm: { type: 'conn', parameters: [{ type: 'connRout', value: 'bend' }] },
			children: [{ name: 'item' }],
		});
		const layout = arrangeConn(bendPlan, nodes, BOX, PALETTE, STYLE, ID)!;
		// Elbow body has 4 points (M + 3 L) before the arrowhead's own M/L/L.
		const body = layout.connectors[0].d.split('M')[1]; // after the leading 'M'
		expect(body.split('L')).toHaveLength(4);
	});

	it('connRout=curve draws a quadratic curve (Q command)', () => {
		const curvePlan = plan({
			algorithm: { type: 'conn', parameters: [{ type: 'connRout', value: 'curve' }] },
			children: [{ name: 'item' }],
		});
		const layout = arrangeConn(curvePlan, nodes, BOX, PALETTE, STYLE, ID)!;
		expect(layout.connectors[0].d).toContain('Q');
	});

	it('dim=2D connects rect centres instead of facing edges', () => {
		const dim2d = plan({
			algorithm: { type: 'conn', parameters: [{ type: 'dim', value: '2D' }] },
			children: [{ name: 'item' }],
		});
		const default1d = plan({ algorithm: { type: 'conn' }, children: [{ name: 'item' }] });
		const layout2d = arrangeConn(dim2d, nodes, BOX, PALETTE, STYLE, ID)!;
		const layout1d = arrangeConn(default1d, nodes, BOX, PALETTE, STYLE, ID)!;
		const boxes = rects(layout1d.nodes);
		const firstCentreX = boxes[0].x + boxes[0].width / 2;
		// 1D links the trailing EDGE (not the centre) of the first rect.
		expect(layout1d.connectors[0].d.startsWith(`M${boxes[0].x + boxes[0].width},`)).toBeTruthy();
		// 2D links the CENTRE of the first rect.
		expect(layout2d.connectors[0].d.startsWith(`M${firstCentreX},`)).toBeTruthy();
	});
});
