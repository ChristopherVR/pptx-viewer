import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutNode, PptxSmartArtNode } from '../types';
import {
	resolveAnchoredContent,
	resolveAnchoredContentPerAnchor,
} from './smartart-layout-interpreter-composite-anchor';

function node(id: string, text: string, parentId?: string): PptxSmartArtNode {
	return parentId ? { id, text, parentId } : { id, text };
}

describe('resolveAnchoredContentPerAnchor', () => {
	it('returns [] for a node with no presOf', () => {
		const layoutNode: PptxSmartArtLayoutNode = { name: 'bare' };
		expect(resolveAnchoredContentPerAnchor(layoutNode, [])).toStrictEqual([]);
	});

	it('falls back to root-relative resolution, wrapped as ONE group, for a node with no forEachOrigin (cycle-matrix/quadrant1 pattern)', () => {
		const one = node('one', 'Node One');
		const three = node('three', 'Node Three');
		const flat = [one, three];
		const layoutNode: PptxSmartArtLayoutNode = {
			name: 'quadrant1',
			presentationOf: { axis: ['ch'], pointTypes: ['node'], count: [1] },
		};
		const groups = resolveAnchoredContentPerAnchor(layoutNode, flat);
		expect(groups).toHaveLength(1);
		expect(groups[0].map((n) => n.id)).toStrictEqual(['one']);
		// Same result as the folded (non-per-anchor) reading when there is only one group.
		expect(resolveAnchoredContent(layoutNode, flat).map((n) => n.id)).toStrictEqual(
			groups[0].map((n) => n.id),
		);
	});

	it("a single-anchor forEachOrigin (Phased Process's per-phase circ1Tx) still produces exactly ONE group", () => {
		const one = node('one', 'Node One');
		const two = node('two', 'Node Two', 'one');
		const flat = [one, two];
		const layoutNode: PptxSmartArtLayoutNode = {
			name: 'circ1Tx',
			presentationOf: { axis: ['desOrSelf'], pointTypes: ['node'] },
			forEachOrigin: { axis: ['ch'], pointTypes: ['node'], start: [1], count: [1] },
		};
		const groups = resolveAnchoredContentPerAnchor(layoutNode, flat);
		expect(groups).toHaveLength(1);
		expect(groups[0].map((n) => n.id)).toStrictEqual(['one', 'two']);
	});

	/**
	 * `nested-target--hier5.pptx`'s `oChild`: a genuine `dgm:forEach axis="ch
	 * ch" ptType="node node" st="1 1" cnt="1 0"` (hop 1 unbounded - "every
	 * child of point 1") wraps a SINGLE `presOf axis="desOrSelf"` template.
	 * Cached ground truth wants THREE separate boxes ("Node Two" alone,
	 * "Node Three" alone, "Node Four" folded with its own child "Node Five"
	 * via `desOrSelf`) - not one box with all three anchors' text folded
	 * together (`resolveAnchoredContent`'s own single-group reading).
	 */
	it('a multi-anchor forEachOrigin (nested-target oChild) produces ONE group PER anchor, each independently desOrSelf-folded', () => {
		const nodeOne = node('one', 'Node One');
		const two = node('two', 'Node Two', 'one');
		const three = node('three', 'Node Three', 'one');
		const four = node('four', 'Node Four', 'one');
		const five = node('five', 'Node Five', 'four');
		const flat = [nodeOne, two, three, four, five];
		const oChild: PptxSmartArtLayoutNode = {
			name: 'oChild',
			presentationOf: { axis: ['desOrSelf'], pointTypes: ['node'] },
			forEachOrigin: {
				axis: ['ch', 'ch'],
				pointTypes: ['node', 'node'],
				start: [1, 1],
				count: [1, 0],
			},
		};
		const groups = resolveAnchoredContentPerAnchor(oChild, flat);
		expect(groups.map((g) => g.map((n) => n.id))).toStrictEqual([
			['two'],
			['three'],
			['four', 'five'],
		]);
		// The folded (non-per-anchor) reading, for contrast, wrongly combines
		// every anchor's content into ONE array - exactly the bug this function fixes.
		expect(resolveAnchoredContent(oChild, flat).map((n) => n.id)).toStrictEqual([
			'two',
			'three',
			'four',
			'five',
		]);
	});

	it('drops an anchor whose own presOf resolves empty, keeping the others', () => {
		const one = node('one', 'Node One');
		// "two" has its own child ("grandchild"), so its "ch" presOf resolves;
		// "three" is a leaf, so its own "ch" presOf resolves to nothing and is dropped.
		const two = node('two', 'Node Two', 'one');
		const three = node('three', 'Node Three', 'one');
		const grandchild = node('grandchild', 'Grandchild', 'two');
		const flat = [one, two, three, grandchild];
		const layoutNode: PptxSmartArtLayoutNode = {
			name: 'perChildChild',
			presentationOf: { axis: ['ch'], pointTypes: ['node'] },
			// "one's own children" (the anchor set): bare "ch" hop 0 alone would
			// mean "the diagram's own top-level points" ([one] itself, per
			// `resolveAxisNodes`'s own doc comment) - a SECOND "ch" hop is what
			// actually reaches one's children, mirroring nested-target's oChild.
			forEachOrigin: {
				axis: ['ch', 'ch'],
				pointTypes: ['node', 'node'],
				start: [1, 1],
				count: [1, 0],
			},
		};
		const groups = resolveAnchoredContentPerAnchor(layoutNode, flat);
		expect(groups.map((g) => g.map((n) => n.id))).toStrictEqual([['grandchild']]);
	});
});
