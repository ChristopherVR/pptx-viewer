import { describe, expect, it } from 'vitest';

import type {
	PptxSmartArtLayoutNode,
	PptxSmartArtNode,
	PptxSmartArtPresLayoutVars,
} from '../types';
import { arrangeHierarchy } from './smartart-layout-interpreter-hierarchy';
import type { BoundingBox, RenderedRectNode, SmartArtLayoutResult } from './smartart-layout-types';

const box: BoundingBox = { width: 600, height: 400 };
const palette = ['#4472C4', '#ED7D31', '#A5A5A5', '#FFC000'];

/** Two-generation tree: a root, two children, and one grandchild each. */
const DEPTH_THREE_TREE: PptxSmartArtNode[] = [
	{ id: 'm', text: 'Manager' },
	{ id: 'c1', text: 'Child One', parentId: 'm' },
	{ id: 'c2', text: 'Child Two', parentId: 'm' },
	{ id: 'g1', text: 'Grandchild One', parentId: 'c1' },
	{ id: 'g2', text: 'Grandchild Two', parentId: 'c2' },
];

/**
 * A four-generation chain: root -> child -> grandchild -> great-grandchild.
 * `hierBranch` only affects generations past the root's own children
 * (measured against genuine PowerPoint output - see the module doc comment on
 * `smartart-layout-interpreter-hierarchy.ts`), and the hanging tail's own
 * indent/direction only shows up starting at the tail's SECOND node: the
 * first node the tail places (the grandchild, `g1`) anchors directly under
 * its generation-1 parent with no indent yet, so the great-grandchild
 * (`gg1`) is the first node whose position actually depends on direction.
 */
const FOUR_GENERATION_CHAIN: PptxSmartArtNode[] = [
	{ id: 'm', text: 'Manager' },
	{ id: 'c1', text: 'Child One', parentId: 'm' },
	{ id: 'g1', text: 'Grandchild One', parentId: 'c1' },
	{ id: 'gg1', text: 'Great-grandchild One', parentId: 'g1' },
];

/**
 * Like {@link FOUR_GENERATION_CHAIN}, but `g1` has TWO great-grandchildren:
 * "hang" alternates tail direction by child index, which needs two siblings
 * under the same parent to distinguish it from a fixed direction.
 */
const FOUR_GENERATION_CHAIN_WITH_TWO_LEAVES: PptxSmartArtNode[] = [
	{ id: 'm', text: 'Manager' },
	{ id: 'c1', text: 'Child One', parentId: 'm' },
	{ id: 'g1', text: 'Grandchild One', parentId: 'c1' },
	{ id: 'gg1', text: 'Great-grandchild One', parentId: 'g1' },
	{ id: 'gg2', text: 'Great-grandchild Two', parentId: 'g1' },
];

function run(
	nodes: PptxSmartArtNode[],
	presLayoutVars?: PptxSmartArtPresLayoutVars,
): SmartArtLayoutResult {
	return arrangeHierarchy(nodes, box, palette, 'flat', 'hier-test', presLayoutVars);
}

function rects(result: SmartArtLayoutResult): RenderedRectNode[] {
	return result.nodes.filter((n): n is RenderedRectNode => n.kind === 'rect');
}

function byId(result: SmartArtLayoutResult, id: string): RenderedRectNode {
	const found = rects(result).find((n) => n.nodeId === id);
	if (!found) {
		throw new Error(`no rendered node for id ${id}`);
	}
	return found;
}

/** A comparable position signature for every rendered node, id-sorted. */
function signature(result: SmartArtLayoutResult): string {
	return JSON.stringify(
		rects(result)
			.map((n) => ({ id: n.nodeId, x: Math.round(n.x), y: Math.round(n.y) }))
			.sort((a, b) => (a.id ?? '').localeCompare(b.id ?? '')),
	);
}

describe('smartArt hierarchy arranger: hierBranch', () => {
	// Measured against genuine PowerPoint output (see the module doc comment
	// on smartart-layout-interpreter-hierarchy.ts): the root's own direct
	// children (generation 1) fan out identically for EVERY hierBranch value,
	// including "hang"/"l"/"r". "std", "init", "hang", "l" and "r" therefore
	// do NOT all produce mutually distinct arrangements on a shallow tree:
	// "init" and "r" are indistinguishable (both hang the tail rightward, the
	// only way either is reached), and only "std" (no tail at all) is
	// guaranteed to differ from the other four.
	it('generation-1 children fan out identically for every hierBranch value', () => {
		const variants: Array<PptxSmartArtPresLayoutVars | undefined> = [
			undefined,
			{ hierarchyBranch: 'std' },
			{ hierarchyBranch: 'init' },
			{ hierarchyBranch: 'hang' },
			{ hierarchyBranch: 'l' },
			{ hierarchyBranch: 'r' },
		];
		const positions = variants.map((vars) => {
			const result = run(DEPTH_THREE_TREE, vars);
			return { c1: byId(result, 'c1'), c2: byId(result, 'c2') };
		});
		for (const { c1, c2 } of positions) {
			expect(c1.x).toBeCloseTo(positions[0].c1.x, 0);
			expect(c1.y).toBeCloseTo(positions[0].c1.y, 0);
			expect(c2.x).toBeCloseTo(positions[0].c2.x, 0);
			expect(c2.y).toBeCloseTo(positions[0].c2.y, 0);
		}
	});

	it('"init" and "r" are the same arrangement (both hang the tail rightward)', () => {
		const init = signature(run(DEPTH_THREE_TREE, { hierarchyBranch: 'init' }));
		const right = signature(run(DEPTH_THREE_TREE, { hierarchyBranch: 'r' }));
		expect(init).toBe(right);
	});

	it('"std" installs no tail at all, unlike "init"/"hang"/"l"/"r"', () => {
		const std = signature(run(DEPTH_THREE_TREE, { hierarchyBranch: 'std' }));
		for (const branch of ['init', 'hang', 'l', 'r'] as const) {
			expect(signature(run(DEPTH_THREE_TREE, { hierarchyBranch: branch }))).not.toBe(std);
		}
	});

	// The "Left"/"Both Hanging" names suggest "l" should mirror "r" and "hang"
	// should alternate per sibling, but genuine PowerPoint output measured
	// directly refutes both (see `HIER_TAIL_OFFSET_RATIO`'s doc comment in
	// smartart-hierarchy-shared.ts, and `placeHangingTree`'s doc comment in
	// smartart-hierarchy-hanging.ts): every sampled hierBranch variant hangs
	// the SAME direction, and multiple ordinary children of one node always
	// share ONE column. These two tests were corrected to that measurement.
	it('"l" hangs the tail the SAME direction as "r"/"init" (measured, despite the "Left Hanging" name)', () => {
		const left = run(FOUR_GENERATION_CHAIN, { hierarchyBranch: 'l' });
		const right = run(FOUR_GENERATION_CHAIN, { hierarchyBranch: 'r' });
		// g1 (the tail's first node) anchors directly under c1 either way; gg1
		// (g1's own child) is where the indent direction would show if "l" and
		// "r" differed.
		const leftParentX = byId(left, 'g1').x;
		const leftChildX = byId(left, 'gg1').x;
		const rightParentX = byId(right, 'g1').x;
		const rightChildX = byId(right, 'gg1').x;
		expect(leftChildX - leftParentX).toBeGreaterThan(0);
		expect(rightChildX - rightParentX).toBeGreaterThan(0);
	});

	it('"hang" keeps multiple ordinary children of one node in ONE column, same as "r" (measured, despite the "Both Hanging" name)', () => {
		const hang = run(FOUR_GENERATION_CHAIN_WITH_TWO_LEAVES, { hierarchyBranch: 'hang' });
		const right = run(FOUR_GENERATION_CHAIN_WITH_TWO_LEAVES, { hierarchyBranch: 'r' });
		const parentX = byId(hang, 'g1').x;
		// "hang": both of g1's leaves land in the same column, right of g1.
		expect(byId(hang, 'gg1').x - parentX).toBeGreaterThan(0);
		expect(byId(hang, 'gg2').x).toBeCloseTo(byId(hang, 'gg1').x, 5);
		// "r": likewise both leaves right of g1, in one shared column.
		const rightParentX = byId(right, 'g1').x;
		expect(byId(right, 'gg1').x - rightParentX).toBeGreaterThan(0);
		expect(byId(right, 'gg2').x).toBeCloseTo(byId(right, 'gg1').x, 5);
	});

	it('"init" fans the root\'s direct children out but hangs the grandchildren', () => {
		const init = run(DEPTH_THREE_TREE, { hierarchyBranch: 'init' });
		const std = run(DEPTH_THREE_TREE, { hierarchyBranch: 'std' });

		// The root's own children (c1/c2) still land on the standard fan-out
		// row, same as "std".
		expect(byId(init, 'c1').y).toBeCloseTo(byId(std, 'c1').y, 0);
		expect(byId(init, 'c2').y).toBeCloseTo(byId(std, 'c2').y, 0);

		// But the grandchildren (g1/g2) do NOT land on "std"'s third standard
		// row - they hang from their own parent instead.
		expect(byId(init, 'g1').y).not.toBeCloseTo(byId(std, 'g1').y, 0);
	});
});

// G7: a hand-authored layoutDef expressing orientation only via the
// algorithm's own `linDir` (no `presLayoutVars.hierBranch`) should still
// produce a hanging tree, not fall back to the top-down standard branch.
describe('smartArt hierarchy arranger: linDir fallback (no presLayoutVars.hierBranch)', () => {
	function algNode(linDir: string): PptxSmartArtLayoutNode {
		return { algorithm: { type: 'hierChild', parameters: [{ type: 'linDir', value: linDir }] } };
	}

	it('linDir=fromR hangs the tree leftward, same direction as hierBranch="l"', () => {
		const viaLinDir = arrangeHierarchy(
			DEPTH_THREE_TREE,
			box,
			palette,
			'flat',
			'hier-test',
			undefined,
			undefined,
			algNode('fromR'),
		);
		const viaHierBranch = run(DEPTH_THREE_TREE, { hierarchyBranch: 'l' });
		const linDirDelta = byId(viaLinDir, 'c1').x - byId(viaLinDir, 'm').x;
		const hierBranchDelta = byId(viaHierBranch, 'c1').x - byId(viaHierBranch, 'm').x;
		expect(linDirDelta).toBeLessThan(0);
		expect(Math.sign(linDirDelta)).toBe(Math.sign(hierBranchDelta));
	});

	it('linDir=fromL hangs the tree rightward, same direction as hierBranch="r"', () => {
		const viaLinDir = arrangeHierarchy(
			DEPTH_THREE_TREE,
			box,
			palette,
			'flat',
			'hier-test',
			undefined,
			undefined,
			algNode('fromL'),
		);
		const delta = byId(viaLinDir, 'c1').x - byId(viaLinDir, 'm').x;
		expect(delta).toBeGreaterThan(0);
	});

	it('an explicit presLayoutVars.hierBranch always wins over linDir', () => {
		const result = arrangeHierarchy(
			DEPTH_THREE_TREE,
			box,
			palette,
			'flat',
			'hier-test',
			{ hierarchyBranch: 'std' },
			undefined,
			algNode('fromR'),
		);
		const std = run(DEPTH_THREE_TREE, { hierarchyBranch: 'std' });
		// Still the standard top-down fan-out: children share the root's row 1
		// vertical band, not a hanging column beside it.
		expect(byId(result, 'c1').y).toBeCloseTo(byId(std, 'c1').y, 0);
	});
});

describe('smartArt hierarchy arranger: orgChart assistants', () => {
	const withAssistant: PptxSmartArtNode[] = [
		{ id: 'm', text: 'Manager' },
		{ id: 'a1', text: 'Assistant', parentId: 'm', nodeType: 'asst' },
		{ id: 'c1', text: 'Child One', parentId: 'm' },
		{ id: 'c2', text: 'Child Two', parentId: 'm' },
	];

	it('renders an assistant with different geometry than an ordinary child (standard branch)', () => {
		const result = run(withAssistant, { orgChart: true });
		const assistant = byId(result, 'a1');
		const child = byId(result, 'c1');

		expect(assistant.width).not.toBeCloseTo(child.width, 0);
		expect(assistant.height).not.toBeCloseTo(child.height, 0);
		// The assistant sits closer to the manager than the ordinary children's
		// fan-out row.
		const manager = byId(result, 'm');
		expect(assistant.y - manager.y).toBeLessThan(child.y - manager.y);
	});

	it('without orgChart, an "asst" node is treated as an ordinary child', () => {
		const result = run(withAssistant, undefined);
		const assistant = byId(result, 'a1');
		const child = byId(result, 'c1');
		expect(assistant.width).toBeCloseTo(child.width, 0);
		expect(assistant.height).toBeCloseTo(child.height, 0);
	});

	it('an explicit hierBranch keeps the assistant on the fan-style row, even for "r"/"hang"/"l"', () => {
		// Measured against genuine PowerPoint output: the manager's OWN
		// assistant/children row always uses the standard branch's
		// `placeAssistantRow`, whatever hierBranch says - only a MODE reached
		// via the `linDir` fallback (see the next test) places an assistant
		// flush with its manager's own x.
		const std = run(withAssistant, { orgChart: true });
		const right = run(withAssistant, { orgChart: true, hierarchyBranch: 'r' });
		expect(byId(right, 'a1').x).toBeCloseTo(byId(std, 'a1').x, 0);
		expect(byId(right, 'a1').y).toBeCloseTo(byId(std, 'a1').y, 0);
	});

	it('renders an assistant at the same x as its manager in the full linDir-hanging fallback', () => {
		// Only reached when `presLayoutVars.hierBranch` is absent entirely and
		// the algorithm's own `linDir` param requests a hanging tree (a
		// hand-authored, non-Office layoutDef) - see the module doc comment on
		// smartart-layout-interpreter-hierarchy.ts.
		const algNode: PptxSmartArtLayoutNode = {
			algorithm: { type: 'hierChild', parameters: [{ type: 'linDir', value: 'fromL' }] },
		};
		const result = arrangeHierarchy(
			withAssistant,
			box,
			palette,
			'flat',
			'hier-test',
			{ orgChart: true },
			undefined,
			algNode,
		);
		const manager = byId(result, 'm');
		const assistant = byId(result, 'a1');
		const child = byId(result, 'c1');
		expect(assistant.x).toBeCloseTo(manager.x, 0);
		expect(child.x).not.toBeCloseTo(manager.x, 0);
	});
});

describe('smartArt hierarchy arranger: chMax / chPref column grouping', () => {
	// Genuine PowerPoint output (`smartart-orgchart-many.pptx` in the corpus)
	// does NOT wrap excess children into additional FANNED rows: it chunks
	// them into `chPref`/`chMax`-sized GROUPS, each rendered as its own
	// vertical hanging column, columns fanned out side by side. So a manager
	// with 6 reports and chMax=3 renders as two side-by-side 3-tall columns:
	// two distinct x positions (the columns) and three distinct y positions
	// (each column's own stack), not the other way around.
	const sixChildren: PptxSmartArtNode[] = [
		{ id: 'm', text: 'Manager' },
		...Array.from({ length: 6 }, (_, i) => ({
			id: `c${i + 1}`,
			text: `Child ${i + 1}`,
			parentId: 'm',
		})),
	];

	it('groups children into two columns of three when chMax=3', () => {
		const result = run(sixChildren, { childMax: 3 });
		const xs = Array.from({ length: 6 }, (_, i) => byId(result, `c${i + 1}`).x);
		const ys = Array.from({ length: 6 }, (_, i) => byId(result, `c${i + 1}`).y);
		expect(new Set(xs.map((x) => Math.round(x))).size).toBe(2);
		expect(new Set(ys.map((y) => Math.round(y))).size).toBe(3);
	});

	it('groups children into three columns of two when chPref=2 (preferred over a larger chMax)', () => {
		const result = run(sixChildren, { childMax: 6, childPreferred: 2 });
		const xs = Array.from({ length: 6 }, (_, i) => byId(result, `c${i + 1}`).x);
		const ys = Array.from({ length: 6 }, (_, i) => byId(result, `c${i + 1}`).y);
		expect(new Set(xs.map((x) => Math.round(x))).size).toBe(3);
		expect(new Set(ys.map((y) => Math.round(y))).size).toBe(2);
	});

	it('renders a single row (no grouping) when the child count is within chMax', () => {
		const result = run(sixChildren, { childMax: 10 });
		const ys = Array.from({ length: 6 }, (_, i) => byId(result, `c${i + 1}`).y);
		const distinctRows = new Set(ys.map((y) => Math.round(y)));
		expect(distinctRows.size).toBe(1);
	});
});
