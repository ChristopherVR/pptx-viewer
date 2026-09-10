import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutNode, PptxSmartArtNode } from '../types';
import { EMPTY_CONSTRAINT_INDEX } from './smartart-constraint-solver';
import type { RawSlotCandidate } from './smartart-layout-interpreter-composite-group-slots';
import { resolveGroupedSlots } from './smartart-layout-interpreter-composite-group-slots';
import type { BoundingBox } from './smartart-layout-types';

const BOX: BoundingBox = { width: 400, height: 300 };

function layoutNode(overrides: Partial<PptxSmartArtLayoutNode>): PptxSmartArtLayoutNode {
	return { name: 'slot', ...overrides };
}

function dataNode(id: string, text: string): PptxSmartArtNode {
	return { id, text };
}

describe('smartArt choose-aware slot grouping (resolveGroupedSlots)', () => {
	/**
	 * Round 39: `basic-venn--flat3.pptx`'s exact shape - `circ1` (`dgm:alg
	 * type="sp"`, a PAINTED, visible ellipse) and `circ1Tx` (`dgm:alg
	 * type="tx"`, `dgm:shape type="rect" hideGeom="1"` - a text-only sizing
	 * box) share the SAME resolved content, so they merge into one group.
	 * PowerPoint's own cached drawing renders the point's text INSIDE the
	 * painted ellipse's own box, never as a separate small text rectangle -
	 * the winning candidate must be the VISIBLE shape (`circ1`), not the
	 * `hideGeom` one, even though both resolve a real, different rect here.
	 */
	it('prefers a visible (non-hideGeom) shape over a hideGeom text-sizing sibling with the SAME content', () => {
		const point = dataNode('p1', 'Alpha');
		const visibleShape = layoutNode({
			name: 'circ1',
			algorithm: { type: 'sp' },
			shape: { presetGeometry: 'ellipse' },
			constraints: [
				{ type: 'ctrX', factor: 0.5 },
				{ type: 'ctrY', factor: 0.5 },
				{ type: 'w', factor: 0.6 },
				{ type: 'h', factor: 0.6 },
			],
		});
		const hiddenTextBox = layoutNode({
			name: 'circ1Tx',
			algorithm: { type: 'tx' },
			shape: { presetGeometry: 'rect', hideGeometry: true },
			constraints: [
				{ type: 'l', factor: 0.1 },
				{ type: 't', factor: 0.12 },
				{ type: 'w', factor: 0.32 },
				{ type: 'h', factor: 0.76 },
			],
		});
		const candidates: RawSlotCandidate[] = [
			{
				node: visibleShape,
				declaringRole: 'composite',
				content: [point],
				iteration: 0,
				iterationCount: 1,
			},
			{
				node: hiddenTextBox,
				declaringRole: 'composite',
				content: [point],
				iteration: 0,
				iterationCount: 1,
			},
		];
		const [slot] = resolveGroupedSlots(candidates, BOX, EMPTY_CONSTRAINT_INDEX);
		expect(slot.node.name).toBe('circ1');
		// The visible ellipse's own box (centred, 60% of the diagram), not the
		// smaller inset text rectangle.
		expect(slot.rect).toMatchObject({ x: 80, y: 60, width: 240, height: 180 });
	});

	/** `Staggered Process`'s `ThreeNodes_3_text` (`hideGeom`, no positioned
	 * constraint of its own at all) must still fall back to its visible `sp`
	 * sibling's OWN geometry when that sibling is the only one that resolves
	 * - merging must never drop a slot just because ordering changed. */
	it('falls back to a hideGeom member when no visible member resolves a position at all', () => {
		const point = dataNode('p1', 'Node');
		const visibleNoGeometry = layoutNode({
			name: 'ThreeNodes_3',
			algorithm: { type: 'sp' },
			shape: { presetGeometry: 'roundRect' },
			constraints: [
				{ type: 'l', factor: 0.2 },
				{ type: 't', factor: 0.2 },
				{ type: 'w', factor: 0.3 },
				{ type: 'h', factor: 0.3 },
			],
		});
		const hiddenText = layoutNode({
			name: 'ThreeNodes_3_text',
			algorithm: { type: 'tx' },
			shape: { presetGeometry: 'rect', hideGeometry: true },
			constraints: [],
		});
		const candidates: RawSlotCandidate[] = [
			{
				node: hiddenText,
				declaringRole: 'composite',
				content: [point],
				iteration: 0,
				iterationCount: 1,
			},
			{
				node: visibleNoGeometry,
				declaringRole: 'composite',
				content: [point],
				iteration: 0,
				iterationCount: 1,
			},
		];
		const [slot] = resolveGroupedSlots(candidates, BOX, EMPTY_CONSTRAINT_INDEX);
		expect(slot.node.name).toBe('ThreeNodes_3');
		expect(slot.rect).toMatchObject({ x: 80, y: 60, width: 120, height: 90 });
	});

	it('prefers a non-sp (text) member over an equally-visible sp sibling when both tie on visibility', () => {
		const point = dataNode('p1', 'Node');
		const spSibling = layoutNode({
			name: 'accent',
			algorithm: { type: 'sp' },
			shape: { presetGeometry: 'roundRect' },
			constraints: [
				{ type: 'l', factor: 0.1 },
				{ type: 't', factor: 0.1 },
				{ type: 'w', factor: 0.1 },
				{ type: 'h', factor: 0.1 },
			],
		});
		const txSibling = layoutNode({
			name: 'label',
			algorithm: { type: 'tx' },
			shape: { presetGeometry: 'rect' },
			constraints: [
				{ type: 'l', factor: 0.2 },
				{ type: 't', factor: 0.2 },
				{ type: 'w', factor: 0.4 },
				{ type: 'h', factor: 0.4 },
			],
		});
		const candidates: RawSlotCandidate[] = [
			{
				node: spSibling,
				declaringRole: 'composite',
				content: [point],
				iteration: 0,
				iterationCount: 1,
			},
			{
				node: txSibling,
				declaringRole: 'composite',
				content: [point],
				iteration: 0,
				iterationCount: 1,
			},
		];
		const [slot] = resolveGroupedSlots(candidates, BOX, EMPTY_CONSTRAINT_INDEX);
		expect(slot.node.name).toBe('label');
	});
});
