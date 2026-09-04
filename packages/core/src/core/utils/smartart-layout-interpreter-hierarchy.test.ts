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
	it('every hierBranch value produces a genuinely distinct arrangement', () => {
		const variants: Array<PptxSmartArtPresLayoutVars | undefined> = [
			undefined,
			{ hierarchyBranch: 'std' },
			{ hierarchyBranch: 'init' },
			{ hierarchyBranch: 'hang' },
			{ hierarchyBranch: 'l' },
			{ hierarchyBranch: 'r' },
		];
		const signatures = variants.map((vars) => signature(run(DEPTH_THREE_TREE, vars)));

		// undefined and "std" are the same (std is the default).
		expect(signatures[0]).toBe(signatures[1]);

		// Every OTHER pair must differ: init, hang, l, r, and std are all
		// distinguishable from one another.
		const distinct = [signatures[1], signatures[2], signatures[3], signatures[4], signatures[5]];
		for (let i = 0; i < distinct.length; i++) {
			for (let j = i + 1; j < distinct.length; j++) {
				expect(distinct[i]).not.toBe(distinct[j]);
			}
		}
	});

	it('"l" and "r" mirror each other horizontally (same magnitude, opposite indent)', () => {
		const left = run(DEPTH_THREE_TREE, { hierarchyBranch: 'l' });
		const right = run(DEPTH_THREE_TREE, { hierarchyBranch: 'r' });
		const leftRootX = byId(left, 'm').x;
		const leftChildX = byId(left, 'c1').x;
		const rightRootX = byId(right, 'm').x;
		const rightChildX = byId(right, 'c1').x;
		// Left hanging indents further LEFT (smaller x); right hanging indents
		// further RIGHT (larger x) - both relative to their own root.
		expect(leftChildX - leftRootX).toBeLessThan(0);
		expect(rightChildX - rightRootX).toBeGreaterThan(0);
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

	it('renders an assistant at the same x as its manager in a hanging branch', () => {
		const result = run(withAssistant, { orgChart: true, hierarchyBranch: 'r' });
		const manager = byId(result, 'm');
		const assistant = byId(result, 'a1');
		const child = byId(result, 'c1');
		expect(assistant.x).toBeCloseTo(manager.x, 0);
		expect(child.x).not.toBeCloseTo(manager.x, 0);
	});
});

describe('smartArt hierarchy arranger: chMax / chPref row wrapping', () => {
	const sixChildren: PptxSmartArtNode[] = [
		{ id: 'm', text: 'Manager' },
		...Array.from({ length: 6 }, (_, i) => ({
			id: `c${i + 1}`,
			text: `Child ${i + 1}`,
			parentId: 'm',
		})),
	];

	it('wraps children into two rows when chMax=3', () => {
		const result = run(sixChildren, { childMax: 3 });
		const ys = Array.from({ length: 6 }, (_, i) => byId(result, `c${i + 1}`).y);
		const distinctRows = new Set(ys.map((y) => Math.round(y)));
		expect(distinctRows.size).toBe(2);
	});

	it('wraps children into three rows when chPref=2 (preferred over a larger chMax)', () => {
		const result = run(sixChildren, { childMax: 6, childPreferred: 2 });
		const ys = Array.from({ length: 6 }, (_, i) => byId(result, `c${i + 1}`).y);
		const distinctRows = new Set(ys.map((y) => Math.round(y)));
		expect(distinctRows.size).toBe(3);
	});

	it('renders a single row (no wrapping) when the child count is within chMax', () => {
		const result = run(sixChildren, { childMax: 10 });
		const ys = Array.from({ length: 6 }, (_, i) => byId(result, `c${i + 1}`).y);
		const distinctRows = new Set(ys.map((y) => Math.round(y)));
		expect(distinctRows.size).toBe(1);
	});
});
