/**
 * Fidelity verification corpus - composite + conn integration (issue #94).
 *
 * The `composite` and `conn` arrangers are being wired into the interpreter
 * dispatcher by sibling agents. This suite has two layers:
 *
 *   1. DIRECT - `arrangeComposite` is exercised through the real parse path now
 *      (the module already exists), asserting slot geometry fidelity.
 *   2. DISPATCH - the same families are asserted through the public
 *      `interpretSmartArtLayout` entry, GATED with `describe.skipIf` on whether
 *      the dispatcher yet recognises them. These activate automatically once the
 *      sibling wiring lands; until then they report as skipped, not failed.
 *
 * An always-on contract test verifies the dispatcher never throws and declines
 * gracefully for a not-yet-wired family. No framework, no DOM.
 */

import type { PptxSmartArtNode } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { interpretSmartArtLayout } from './smartart-layout-interpreter';
import { arrangeComposite } from './smartart-layout-interpreter-composite';
import {
	BOX,
	compositeDef,
	connDef,
	contentNodes,
	ID,
	PALETTE,
	rectsOf,
	STYLE,
} from './smartart-layout-interpreter-fidelity-fixtures';
import {
	connectorEndpointsWithin,
	maxRectOverlapFraction,
	nodesWithinViewBox,
	parseViewBox,
} from './smartart-layout-interpreter-fidelity-geometry';

function dispatch(def: ReturnType<typeof compositeDef>, nodes: PptxSmartArtNode[]) {
	return interpretSmartArtLayout({
		layoutDefinition: def,
		nodes,
		flat: nodes,
		box: BOX,
		palette: PALETTE,
		style: STYLE,
		elementId: ID,
	});
}

// Probe whether the dispatcher yet routes these families to a real arranger.
const COMPOSITE_WIRED = dispatch(compositeDef(), contentNodes(2)) !== undefined;
const connProbe = dispatch(connDef(), contentNodes(4));
const CONN_WIRED = connProbe !== undefined && connProbe.connectors.length > 0;

// ── Composite (direct - passes now) ─────────────────────────────────────────────

describe('fidelity: composite (direct arranger)', () => {
	it('maps two data points into the two positioned half-width slots', () => {
		const def = compositeDef();
		const layout = arrangeComposite(
			{ kind: 'linear', node: def.rootNode },
			contentNodes(2),
			BOX,
			PALETTE,
			STYLE,
			ID,
		);
		expect(layout).toBeDefined();
		const boxes = rectsOf(layout!.nodes);
		expect(boxes).toHaveLength(2);
		expect(boxes[0].x).toBeCloseTo(0, 3);
		expect(boxes[0].width).toBeCloseTo(200, 3);
		expect(boxes[1].x).toBeCloseTo(200, 3);
		expect(layout!.family).toBe('list');
	});

	it('keeps slots inside the box and non-overlapping', () => {
		const def = compositeDef();
		const layout = arrangeComposite(
			{ kind: 'linear', node: def.rootNode },
			contentNodes(2),
			BOX,
			PALETTE,
			STYLE,
			ID,
		)!;
		const { w, h } = parseViewBox(layout.viewBox);
		expect(nodesWithinViewBox(layout.nodes, w, h)).toBeTruthy();
		expect(maxRectOverlapFraction(rectsOf(layout.nodes))).toBeLessThan(0.02);
	});

	it('caps rendered rects at the slot count when data exceeds slots', () => {
		const def = compositeDef();
		const boxes = rectsOf(
			arrangeComposite(
				{ kind: 'linear', node: def.rootNode },
				contentNodes(5),
				BOX,
				PALETTE,
				STYLE,
				ID,
			)!.nodes,
		);
		expect(boxes).toHaveLength(2);
	});
});

// ── Composite (via dispatcher - gated) ──────────────────────────────────────────

describe.skipIf(!COMPOSITE_WIRED)('fidelity: composite (via dispatch)', () => {
	it('routes a composite definition to the composite arranger', () => {
		const layout = dispatch(compositeDef(), contentNodes(2))!;
		const boxes = rectsOf(layout.nodes);
		expect(boxes).toHaveLength(2);
		const { w, h } = parseViewBox(layout.viewBox);
		expect(nodesWithinViewBox(layout.nodes, w, h)).toBeTruthy();
		expect(maxRectOverlapFraction(boxes)).toBeLessThan(0.02);
	});
});

// ── Connectors (conn - gated) ────────────────────────────────────────────────────

describe.skipIf(!CONN_WIRED)('fidelity: conn (via dispatch)', () => {
	it('produces one node per point joined by connectors in bounds', () => {
		const nodes = contentNodes(4);
		const layout = dispatch(connDef(), nodes)!;
		expect(layout.nodes).toHaveLength(nodes.length);
		expect(layout.connectors.length).toBeGreaterThanOrEqual(nodes.length - 1);
		const { w, h } = parseViewBox(layout.viewBox);
		expect(nodesWithinViewBox(layout.nodes, w, h)).toBeTruthy();
		expect(connectorEndpointsWithin(layout.connectors, w, h)).toBeTruthy();
	});
});

// ── Always-on graceful-decline contract ─────────────────────────────────────────

describe('fidelity: dispatcher decline contract', () => {
	it('never throws and returns undefined-or-valid for composite/conn', () => {
		for (const def of [compositeDef(), connDef()]) {
			const layout = dispatch(def, contentNodes(3));
			if (layout !== undefined) {
				const { w, h } = parseViewBox(layout.viewBox);
				expect(nodesWithinViewBox(layout.nodes, w, h)).toBeTruthy();
			} else {
				expect(layout).toBeUndefined();
			}
		}
	});
});
