import { describe, expect, it } from 'vitest';

import type {
	PptxSmartArtIteratorAttributes,
	PptxSmartArtLayoutNode,
	PptxSmartArtNode,
} from '../types';
import { EMPTY_CONSTRAINT_INDEX } from './smartart-constraint-solver';
import {
	expandRecursiveItemRoles,
	hasRecursiveItemTemplate,
	resolveRecursiveItemRoleContent,
} from './smartart-layout-interpreter-item-roles-recursive';
import type { RenderedRectNode } from './smartart-layout-types';

const CH_NODE_FOREACH: PptxSmartArtIteratorAttributes = { axis: ['ch'], pointTypes: ['node'] };

/** A `dgm:presOf`-bearing text role: `alg type="tx"` + a non-empty axis. */
function textRole(
	name: string,
	axis: string,
	forEachOrigin?: PptxSmartArtIteratorAttributes,
): PptxSmartArtLayoutNode {
	return { name, algorithm: { type: 'tx' }, presentationOf: { axis: [axis] }, forEachOrigin };
}

/** A decorative/positioning node: no `presOf`, not a text algorithm. */
function auxRole(
	name: string,
	children?: PptxSmartArtLayoutNode[],
	forEachOrigin?: PptxSmartArtIteratorAttributes,
): PptxSmartArtLayoutNode {
	return { name, algorithm: { type: 'sp' }, children, forEachOrigin };
}

function childrenOf(entries: Record<string, PptxSmartArtNode[]>): Map<string, PptxSmartArtNode[]> {
	return new Map(Object.entries(entries));
}

/**
 * `LinedList`'s shape, trimmed to the structural essentials measured against
 * `lined-list--hier5.pptx`: `horz1` nests `tx1` (self) + `vert1`, and `vert1`
 * is a nested arranger whose OWN `dgm:forEach axis="ch"` repeats `horz2`
 * (wrapping `tx2`, self) once per child of the point being rendered - see
 * `packages/core/src/__tests__/fixtures/smartart-gallery/lined-list--hier5
 * .pptx`'s `layout1.xml` (`vert1`'s `forEach name="Name16" axis="ch"
 * ptType="node"`).
 */
function linedListArranger(): PptxSmartArtLayoutNode {
	const tx1 = textRole('tx1', 'self');
	// `tx2` itself is a DIRECT child of `horz2`, not found through a forEach -
	// only `horz2` (repeated by `vert1`'s OWN `dgm:forEach axis="ch"`) carries
	// `.forEachOrigin`. Matches `lined-list--hier5.pptx`'s `layout1.xml`
	// exactly: `vert1`'s `forEach name="Name16"` wraps `horz2`, `tx2` sits
	// inside `horz2`'s own (unwrapped) body.
	const tx2 = textRole('tx2', 'self');
	const horz2 = auxRole('horz2', [tx2], CH_NODE_FOREACH);
	const vert1 = auxRole('vert1', [horz2]);
	const horz1 = auxRole('horz1', [tx1, vert1]);
	return { name: 'vert0', children: [horz1] };
}

const RECT_BASE: Omit<RenderedRectNode, 'key' | 'x' | 'y' | 'width' | 'height' | 'nodeId'> = {
	kind: 'rect',
	rx: 6,
	fill: '#123456',
	stroke: '#000000',
	strokeWidth: 1,
	opacity: 1,
	text: '',
	fontSize: 18,
	textX: 0,
	textY: 0,
};

describe('hasRecursiveItemTemplate', () => {
	it('finds a ch-axis forEach reachable below the top-level item template (Lined List)', () => {
		expect(hasRecursiveItemTemplate(linedListArranger())).toBeTruthy();
	});

	it('ignores the top level items own forEachOrigin (the outer arranger already consumed it)', () => {
		// A plain single-role arranger, where the item itself happens to carry
		// the SAME ch-axis origin the outer arranger's own forEach produced it
		// with - never a recursion boundary on its own.
		const arranger: PptxSmartArtLayoutNode = {
			name: 'vert0',
			children: [textRole('tx1', 'self', CH_NODE_FOREACH)],
		};
		expect(hasRecursiveItemTemplate(arranger)).toBeFalsy();
	});

	it('declines when two top-level roles both target a ch/des axis (Continuous Cycle)', () => {
		// cycle3 "Continuous Cycle": `Name0.children` unions its 2-point
		// branch's `node1`/`node2` (both `ch`) with its general-N branch's
		// `cycle` sub-arranger (which DOES nest a genuine ch-axis forEach) -
		// both `dgm:choose` branches flattened together. Recursing would
		// conflate the two branches' item counts, so this must decline even
		// though `cycle`'s own subtree looks recursive in isolation.
		const node1 = textRole('node1', 'ch');
		const node2 = textRole('node2', 'ch');
		const nodeFirstNode = textRole('nodeFirstNode', 'desOrSelf', CH_NODE_FOREACH);
		const cycle = auxRole('cycle', [nodeFirstNode]);
		const arranger: PptxSmartArtLayoutNode = { name: 'Name0', children: [node1, node2, cycle] };
		expect(hasRecursiveItemTemplate(arranger)).toBeFalsy();
	});

	it('does not flag lProcess1-style multi-forEach node (only one of its own forEach entries is ch-axis)', () => {
		// `vertFlow` (Process List) has TWO forEach children of its own
		// (`parTrans`, cnt=1; `child`, axis=ch) - only `child` should ever be
		// treated as a recursion boundary, decided per-node via its OWN
		// `.forEachOrigin`, never by asking `vertFlow` "do any of your
		// forEach elements use axis=ch".
		const header = textRole('header', 'self');
		const child = textRole('child', 'desOrSelf', CH_NODE_FOREACH);
		const vertFlow = auxRole('vertFlow', [header, child]);
		const arranger: PptxSmartArtLayoutNode = { name: 'Name0', children: [vertFlow] };
		expect(hasRecursiveItemTemplate(arranger)).toBeTruthy();
	});
});

describe('resolveRecursiveItemRoleContent', () => {
	const arranger = linedListArranger();
	// Mirrors lined-list--hier5.pptx's tree: doc -> NodeOne(child: NodeTwo),
	// NodeThree, NodeFour(child: NodeFive) - 5 nodes, matching the cached
	// drawing's 5 text-bearing shapes (tx1 x3 + tx2 x2).
	const nodeOne: PptxSmartArtNode = { id: 'one', text: 'Node One' };
	const nodeTwo: PptxSmartArtNode = { id: 'two', text: 'Node Two has a longer label' };
	const nodeThree: PptxSmartArtNode = { id: 'three', text: 'Node Three' };
	const map = childrenOf({ one: [nodeTwo] });

	it('gives an item WITH a child two roles: tx1 (self) and tx2 (the child)', () => {
		const content = resolveRecursiveItemRoleContent(arranger, nodeOne, map);
		expect(content).toHaveLength(2);
		expect(content[0].role.name).toBe('tx1');
		expect(content[0].nodeIds).toStrictEqual(['one']);
		expect(content[1].role.name).toBe('tx2');
		expect(content[1].nodeIds).toStrictEqual(['two']);
	});

	it('gives a childless item exactly one role: tx1 only (the ch-axis forEach runs zero times)', () => {
		const content = resolveRecursiveItemRoleContent(arranger, nodeThree, map);
		expect(content).toHaveLength(1);
		expect(content[0].role.name).toBe('tx1');
		expect(content[0].nodeIds).toStrictEqual(['three']);
	});
});

describe('expandRecursiveItemRoles', () => {
	const arranger = linedListArranger();
	const nodeOne: PptxSmartArtNode = { id: 'one', text: 'Node One' };
	const nodeTwo: PptxSmartArtNode = { id: 'two', text: 'Node Two has a longer label' };
	const nodeThree: PptxSmartArtNode = { id: 'three', text: 'Node Three' };
	const map = childrenOf({ one: [nodeTwo] });
	const box: RenderedRectNode = {
		...RECT_BASE,
		key: 'k',
		x: 10,
		y: 20,
		width: 100,
		height: 80,
		nodeId: 'one',
	};

	it('splits an item with a child into two stacked boxes covering the full height', () => {
		const result = expandRecursiveItemRoles(
			arranger,
			'linear',
			box,
			nodeOne,
			map,
			EMPTY_CONSTRAINT_INDEX,
		);
		expect(result).toHaveLength(2);
		const [first, second] = result as RenderedRectNode[];
		expect(first.nodeId).toBe('one');
		expect(second.nodeId).toBe('two');
		expect(first.y).toBe(20);
		expect(second.y).toBeCloseTo(first.y + first.height, 5);
		expect(second.y + second.height).toBeCloseTo(100, 5);
	});

	it('keeps the original single box for a childless item (one role, nothing to split)', () => {
		const leafBox: RenderedRectNode = { ...box, nodeId: 'three' };
		expect(
			expandRecursiveItemRoles(arranger, 'linear', leafBox, nodeThree, map, EMPTY_CONSTRAINT_INDEX),
		).toBeUndefined();
	});

	it('recovers a rect split from a circle-kind original when every role EXPLICITLY declares a rect shape', () => {
		// A composite-of-composites can collapse to `kind: 'circle'` when its
		// merged preset prefers a decorative accent shape over the item's real
		// text roles ("Meet the Team"'s `compNode`/`photoCircle`) - the
		// recursive item-template split must recover a rect box from the
		// circle's OWN bounding box just like the flat scan does. Real
		// `nameText`/`roleText` write `<dgm:shape type="rect">` explicitly -
		// `tx1`/`tx2` here declare no shape at all by default, so this test
		// builds its OWN arranger with explicit shapes rather than reusing
		// `linedListArranger()`'s bare roles.
		const tx1 = { ...textRole('tx1', 'self'), shape: { presetGeometry: 'rect' } };
		const tx2 = { ...textRole('tx2', 'self'), shape: { presetGeometry: 'rect' } };
		const horz2 = auxRole('horz2', [tx2], CH_NODE_FOREACH);
		const vert1 = auxRole('vert1', [horz2]);
		const horz1 = auxRole('horz1', [tx1, vert1]);
		const rectShapedArranger: PptxSmartArtLayoutNode = { name: 'vert0', children: [horz1] };
		const circle = {
			kind: 'circle' as const,
			key: 'k',
			cx: 0,
			cy: 0,
			r: 10,
			fill: '#fff',
			stroke: '#000',
			strokeWidth: 1,
			opacity: 1,
			text: '',
			fontSize: 12,
			nodeId: 'one',
		};
		const result = expandRecursiveItemRoles(
			rectShapedArranger,
			'linear',
			circle,
			nodeOne,
			map,
			EMPTY_CONSTRAINT_INDEX,
		) as RenderedRectNode[];
		expect(result).toHaveLength(2);
		expect(result[0].kind).toBe('rect');
		expect(result[1].kind).toBe('rect');
	});
});
