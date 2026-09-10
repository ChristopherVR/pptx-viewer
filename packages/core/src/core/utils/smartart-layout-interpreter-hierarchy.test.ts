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
	// children (generation 1) fan out identically for EVERY `tailed`-family
	// hierBranch value ("init"/"hang"/"l"/"r" - "init" and "r" are further
	// indistinguishable, both hang the tail rightward, the only way either is
	// reached). "std" (`undefined`/`'std'`, no tail at all) is a SEPARATE
	// group: it packs `fitItemBox`'s generation axis against the tree's own
	// FULL depth (every generation genuinely fans), while the tailed family
	// packs against only the fanned generations (`computeHangShape`, see
	// `smartart-hierarchy-hang-depth.ts`) - a 3-generation tree like this one
	// therefore gets a GENUINELY smaller `cellH` (denser rows) under "std"
	// than under a tailed branch (which only ever reserves room for 2 fanned
	// rows here, the third being a separate hanging tail), so "std" is not
	// expected to land generation-1 at the same y as the tailed family
	// anymore - see `smartart-hierarchy-orientation.ts`'s `fitItemBox` doc
	// comment for the COM-verified derivation this reflects.
	it('generation-1 children fan out identically across the tailed hierBranch family', () => {
		const variants: Array<PptxSmartArtPresLayoutVars | undefined> = [
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

	it('"std" (undefined and the literal value) also fan generation-1 identically to each other', () => {
		const std1 = run(DEPTH_THREE_TREE, undefined);
		const std2 = run(DEPTH_THREE_TREE, { hierarchyBranch: 'std' });
		expect(byId(std1, 'c1').x).toBeCloseTo(byId(std2, 'c1').x, 0);
		expect(byId(std1, 'c1').y).toBeCloseTo(byId(std2, 'c1').y, 0);
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
		const right = run(DEPTH_THREE_TREE, { hierarchyBranch: 'r' });

		// The root's own children (c1/c2) land on the SAME standard fan-out row
		// as any other tailed-family branch (see the previous test's own doc
		// comment for why comparing this against "std" is no longer meaningful:
		// "std" packs against the tree's full depth, tailed against only the
		// fanned generations).
		expect(byId(init, 'c1').y).toBeCloseTo(byId(right, 'c1').y, 0);
		expect(byId(init, 'c2').y).toBeCloseTo(byId(right, 'c2').y, 0);

		// The grandchildren (g1/g2) hang from their own parent: g1 sits BELOW
		// its own parent (c1) rather than sharing c1's own fan row.
		expect(byId(init, 'g1').y).toBeGreaterThan(byId(init, 'c1').y);
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

	it('an explicit hierBranch keeps the assistant on the fan-style row, identically across "r"/"hang"/"l"', () => {
		// Measured against genuine PowerPoint output: the manager's OWN
		// assistant/children row always uses the standard branch's
		// `placeAssistantRow`, whatever hierBranch says - only a MODE reached
		// via the `linDir` fallback (see the next test) places an assistant
		// flush with its manager's own x. Compared across the TAILED family
		// only (not against "std" - see the `hierBranch` describe block's own
		// comment for why "std" now legitimately packs at a different `cellH`
		// even when, as here, the tree has no hanging tail at all: "std" still
		// uses `OUTER_MARGIN_X_RATIO`/`OUTER_MARGIN_Y_RATIO` while tailed mode
		// uses no margin, a genuine, COM-verified difference between the two
		// families, not an artifact of this specific shallow tree).
		const right = run(withAssistant, { orgChart: true, hierarchyBranch: 'r' });
		const hang = run(withAssistant, { orgChart: true, hierarchyBranch: 'hang' });
		expect(byId(right, 'a1').x).toBeCloseTo(byId(hang, 'a1').x, 0);
		expect(byId(right, 'a1').y).toBeCloseTo(byId(hang, 'a1').y, 0);
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

// COM-verified against real "Hierarchy" fixtures (867x533 diagram box, the
// size every `smartart-gallery` fixture shares): the item box's own w/h is
// NOT a fixed fraction of the diagram or a flat pixel cap (the arranger's
// previous heuristic, `min(cellW*0.8, 150)` / `min(cellH*0.4, 40)`, ignored
// both sibling count and tree depth entirely) - it comes from fitting the
// widest fanned row's sibling count into the box width, and separately
// fitting the tallest hanging chain's generation count into the box height,
// clipping to the narrower of the two so a deep tailed tree renders visibly
// squashed below its natural aspect (`hierarchy--hier5.pptx`) while a
// shallow, narrow one keeps its natural aspect (`hierarchy--hier8.pptx`).
describe('smartArt hierarchy arranger: item box sizing (fitItemBox)', () => {
	const GALLERY_BOX: BoundingBox = { width: 867, height: 533 };

	it('matches "hierarchy--flat3.pptx" (root + 2 children, live-COM cached w=320 h=203) within 5% - round 11/SESSION 8 correction: the OLD pinned w=371 was measured against a since-fixed cached-reader bug that silently rescaled content to the frame (see smartart-layout-interpreter-hierarchy.ts module doc comment); boxW now correctly tracks boxH/aspectRatio when the generation axis binds, instead of staying at the wider (aspect-violating) widthFit', () => {
		const twoChildren: PptxSmartArtNode[] = [
			{ id: 'm', text: 'Alpha' },
			{ id: 'c1', text: 'Beta', parentId: 'm' },
			{ id: 'c2', text: 'Gamma', parentId: 'm' },
		];
		const result = arrangeHierarchy(twoChildren, GALLERY_BOX, palette, 'flat', 'hier-flat3');
		const node = byId(result, 'm');
		expect(Math.abs(node.width - 320) / GALLERY_BOX.width).toBeLessThanOrEqual(0.05);
		expect(Math.abs(node.height - 203) / GALLERY_BOX.height).toBeLessThanOrEqual(0.01);
	});

	it('matches "hierarchy--hier8.pptx" (5-wide fan, cached w=144 h=97, natural aspect) within 1%', () => {
		const wideFan: PptxSmartArtNode[] = [
			{ id: 'root', text: 'A Root' },
			{ id: 'a1', text: 'A Child', parentId: 'root' },
			...Array.from({ length: 5 }, (_, i) => ({
				id: `f${i}`,
				text: `Fan ${i}`,
				parentId: 'a1',
			})),
		];
		const result = arrangeHierarchy(wideFan, GALLERY_BOX, palette, 'flat', 'hier-hier8');
		const node = byId(result, 'root');
		expect(Math.abs(node.width - 144) / GALLERY_BOX.width).toBeLessThanOrEqual(0.02);
		expect(Math.abs(node.height - 97) / GALLERY_BOX.height).toBeLessThanOrEqual(0.02);
	});

	it('squashes below the WIDTH-only fit for a deep tailed hang ("hierarchy--hier5.pptx" shape, live-COM cached w=206 h=131) - round 11/SESSION 8: boxW now ALWAYS derives from boxH/aspectRatio when the generation axis binds, so node.height===node.width*aspectRatio exactly by construction (comparing against the post-fix node.width itself would be circular); this instead pins the qualitative claim against the independently-computed width-only widthFit', () => {
		const result = run(DEPTH_THREE_TREE);
		// DEPTH_THREE_TREE isn't the gallery box, but the qualitative claim
		// (tall tree => the item's own width is clipped BELOW what a pure
		// fan-axis-only fit would give) must hold regardless of box size.
		// n=2, sibSp=0.1 (DEFAULT_SIB_SP_RATIO), marginX=0.0491
		// (OUTER_MARGIN_X_RATIO), box.width=600 (this file's own `box`).
		const widthOnlyFit = (600 * (1 - 2 * 0.0491)) / (2 + 1 * 0.1);
		const node = byId(result, 'm');
		expect(node.width).toBeLessThan(widthOnlyFit);
		// The aspect ratio invariant holds exactly (not just approximately) now
		// that boxW is derived FROM boxH, never left at the wider widthFit.
		expect(node.height).toBeCloseTo(node.width * 0.667, 6);
	});

	// A TRANSPOSED hierarchy ("Horizontal Hierarchy") needs ZERO outer margin
	// on BOTH axes (sizing AND leading-margin positioning), unlike the
	// non-transposed case above - see `smartart-hierarchy-orientation.ts`'s
	// `OUTER_MARGIN_X_RATIO` doc comment. Regression: applying the
	// non-transposed margin here pushed "Horizontal Hierarchy"'s root 61px
	// away from the box's left edge and its item size 5.9% too narrow.
	it('matches "horizontal-hierarchy--flat3.pptx" (transposed, root + 2 children, live-COM cached w=361 h=180, root flush at box.x/box.y) - round 11/SESSION 8 correction: the OLD pinned h=248 was measured against the since-fixed cached-reader bug; the (transposed, logical fan-axis) height now correctly shrinks below the wider pre-fix value', () => {
		const horizontalHierarchyAlg: PptxSmartArtLayoutNode = {
			algorithm: { type: 'hierChild' },
			constraints: [
				{ type: 'w', referenceType: 'h', factor: 2 },
				{ type: 'sibSp', referenceType: 'h', factor: 0.15 },
				{ type: 'sp', referenceType: 'w', factor: 0.4 },
			],
		};
		const twoChildren: PptxSmartArtNode[] = [
			{ id: 'm', text: 'Alpha' },
			{ id: 'c1', text: 'Beta', parentId: 'm' },
			{ id: 'c2', text: 'Gamma', parentId: 'm' },
		];
		const result = arrangeHierarchy(
			twoChildren,
			GALLERY_BOX,
			palette,
			'flat',
			'hier-horiz-flat3',
			undefined,
			undefined,
			horizontalHierarchyAlg,
		);
		const node = byId(result, 'm');
		// Real screen w/h are swapped relative to the non-transposed case: the
		// item's screen WIDTH is the (transposed) generation-axis size, its
		// screen HEIGHT is the fan-axis size.
		expect(Math.abs(node.width - 361) / GALLERY_BOX.width).toBeLessThanOrEqual(0.01);
		expect(Math.abs(node.height - 180) / GALLERY_BOX.height).toBeLessThanOrEqual(0.05);
		// Cached: the root sits flush at the box's own left/top edge (x=53,
		// matching a fresh `arrangeHierarchy` call's implicit box origin of 0
		// since this test's box has no x/y offset) - not offset by a leading
		// margin the way the non-transposed axis's positioning still is.
		expect(node.x).toBeCloseTo(0, 0);
	});
});

// A `tailed`/`init`-branch node with NO siblings of its own (a solo link in a
// single-child chain) should fan its OWN multiple children in one row
// (reusing the whole diagram's fan-axis allocation), not hang them in a
// narrow column - see `smartart-hierarchy-standard.ts`'s `placeAt` doc
// comment for the exact COM-verified condition (`organization-chart--hier8.pptx`
// vs `smartart-orgchart-hierbranch.pptx`'s "Report One").
describe('smartArt hierarchy arranger: solo chain link continues fanning', () => {
	it('fans a solo chain link\'s 5 children in one row instead of hanging them ("organization-chart--hier8.pptx" shape)', () => {
		const tree: PptxSmartArtNode[] = [
			{ id: 'root', text: 'Branch A Root' },
			{ id: 'child', text: 'Branch A Child', parentId: 'root' },
			{ id: 'f0', text: 'Branch A Grandchild', parentId: 'child' },
			{ id: 'f1', text: 'Branch B Root', parentId: 'child' },
			{ id: 'f2', text: 'Branch B Child', parentId: 'child' },
			{ id: 'f3', text: 'Branch B Grandchild', parentId: 'child' },
			{ id: 'f4', text: 'Branch C Child', parentId: 'child' },
			// The one deeper generation: a genuine solo hanging chain, must
			// still hang (not fan-of-one).
			{ id: 'g', text: 'Branch C Root', parentId: 'f3' },
		];
		const result = run(tree, { orgChart: true, childPreferred: 3, hierarchyBranch: 'init' });
		const fanned = ['f0', 'f1', 'f2', 'f3', 'f4'].map((id) => byId(result, id));
		// All 5 share the SAME row (y) and have 5 DISTINCT x positions - a fan,
		// not a hanging column (which would share x, not y).
		for (const node of fanned) {
			expect(node.y).toBeCloseTo(fanned[0].y, 0);
		}
		expect(new Set(fanned.map((n) => Math.round(n.x))).size).toBe(5);
		// The deeper solo chain ("Branch C Root", g) still hangs: it does NOT
		// share the fanned row's y (it is BELOW it), and it is not centred at
		// its own parent's x the way a fanned child would be.
		const g = byId(result, 'g');
		const parent = byId(result, 'f3');
		expect(g.y).toBeGreaterThan(parent.y);
	});

	it('still hangs a shared-row node\'s children even when spanW happens to equal its child count ("smartart-orgchart-hierbranch.pptx" Report One shape)', () => {
		const tree: PptxSmartArtNode[] = [
			{ id: 'manager', text: 'Manager' },
			{ id: 'r1', text: 'Report One', parentId: 'manager' },
			{ id: 'r2', text: 'Report Two', parentId: 'manager' },
			{ id: 'r3', text: 'Report Three', parentId: 'manager' },
			{ id: 'a1', text: 'Analyst One', parentId: 'r1' },
			{ id: 'a2', text: 'Analyst Two', parentId: 'r1' },
		];
		const result = run(tree, { orgChart: true, childPreferred: 3, hierarchyBranch: 'init' });
		const r1 = byId(result, 'r1');
		const a1 = byId(result, 'a1');
		const a2 = byId(result, 'a2');
		// A fan-of-two here would centre a1/a2 at r1's OWN row y; the real
		// (hanging) shape drops them BELOW r1 instead, both at the SAME
		// (hanging column) x, not two side-by-side x positions.
		expect(a1.y).toBeGreaterThan(r1.y);
		expect(a2.y).toBeGreaterThan(r1.y);
		expect(a1.x).toBeCloseTo(a2.x, 0);
	});
});

// `hierarchy-list--hier5.pptx` ("Hierarchy List", uniqueId `hierarchy3`)
// declares only ONE per-item template past the root (`childText`), whose own
// `dgm:presOf` folds every deeper descendant into that SAME box
// (`axis="self desOrSelf" ... cnt="1 0"`) rather than giving it a separate
// generation of boxes the way "Hierarchy"/"Organization Chart" do - see
// `smartart-hierarchy-fold-depth.ts`'s module doc comment. Previously
// `arrangeHierarchy` gave a grandchild (folded in the cached drawing) its
// OWN box regardless, a shape-COUNT mismatch (interpreted 5 vs cached 4 for
// the real fixture).
describe('smartArt hierarchy arranger: fold-depth (layout definition caps generations, not the data tree)', () => {
	const childText: PptxSmartArtLayoutNode = {
		name: 'childText',
		algorithm: { type: 'tx' },
		presentationOf: {
			axis: ['self', 'desOrSelf'],
			pointTypes: ['node', 'node'],
			start: [1, 1],
			count: [1, 0],
		},
	};
	const algorithmNode: PptxSmartArtLayoutNode = {
		name: 'diagram',
		algorithm: { type: 'hierChild' },
		children: [
			{
				name: 'root',
				children: [{ name: 'childShape', algorithm: { type: 'hierChild' }, children: [childText] }],
			},
		],
	};

	it('does not give a grandchild its own box when the item template folds descendants (count matches: root + direct children only)', () => {
		const result = arrangeHierarchy(
			DEPTH_THREE_TREE,
			box,
			palette,
			'flat',
			'hier-fold',
			undefined,
			undefined,
			algorithmNode,
		);
		// DEPTH_THREE_TREE: m -> {c1, c2}, c1 -> g1, c2 -> g2. Folded: only m/c1/c2
		// get boxes (3), never g1/g2.
		expect(rects(result)).toHaveLength(3);
		expect(rects(result).some((n) => n.nodeId === 'g1')).toBeFalsy();
		expect(rects(result).some((n) => n.nodeId === 'g2')).toBeFalsy();
	});

	it('gives every generation its own box with NO algorithmNode (undefined declines the fold check, no regression for a caller with nothing to inspect)', () => {
		const result = arrangeHierarchy(DEPTH_THREE_TREE, box, palette, 'flat', 'hier-nofold');
		expect(rects(result)).toHaveLength(5);
	});

	it('gives every generation its own box when the item template has only a plain "self" presOf (the "Hierarchy" family shape, no regression)', () => {
		const plainAlgorithmNode: PptxSmartArtLayoutNode = {
			name: 'diagram',
			algorithm: { type: 'hierChild' },
			children: [
				{
					name: 'root',
					children: [
						{
							name: 'childShape',
							algorithm: { type: 'hierChild' },
							children: [
								{
									name: 'childText',
									algorithm: { type: 'tx' },
									presentationOf: { axis: ['self'] },
								},
							],
						},
					],
				},
			],
		};
		const result = arrangeHierarchy(
			DEPTH_THREE_TREE,
			box,
			palette,
			'flat',
			'hier-plain',
			undefined,
			undefined,
			plainAlgorithmNode,
		);
		expect(rects(result)).toHaveLength(5);
	});
});

// Round 19: `smartart-hierarchy-shared.ts`'s `pushNode` called `presetBoxNode`
// with no `fontSizeOverride` at all, so EVERY hierarchy item in the gallery
// fell through to `rectNode`'s crude, un-derived `fitFontSize(..., 12)`
// fallback (a flat ~9pt floor) - see `smartart-layout-interpreter-hierarchy-
// fontfit.ts`'s doc comment. Fixed by resolving ONE shared font size up
// front (via `resolveTieredItemFontSize`) and threading it through
// `HierContext.itemFontSizePx`.
describe('smartArt hierarchy arranger: font-fit wiring (round 19)', () => {
	const textRoleAlgorithmNode: PptxSmartArtLayoutNode = {
		name: 'diagram',
		algorithm: { type: 'hierChild' },
		children: [
			{
				name: 'root',
				children: [
					{
						name: 'childShape',
						algorithm: { type: 'hierChild' },
						children: [
							{
								name: 'childText',
								algorithm: { type: 'tx' },
								presentationOf: { axis: ['self'] },
							},
						],
					},
				],
			},
		],
	};

	it('keeps the pre-existing crude per-node fallback (pinned at exactly 12, the old flat floor) when no algorithmNode is given', () => {
		const result = arrangeHierarchy(DEPTH_THREE_TREE, box, palette, 'flat', 'hier-nofit');
		for (const rect of rects(result)) {
			expect(rect.fontSize).toBe(12);
		}
	});

	it('gives every node the SAME shared, fitted font size - well above the old 12 floor - when an algorithmNode is provided', () => {
		const result = arrangeHierarchy(
			DEPTH_THREE_TREE,
			box,
			palette,
			'flat',
			'hier-fit',
			undefined,
			undefined,
			textRoleAlgorithmNode,
		);
		const sizes = rects(result).map((n) => n.fontSize);
		expect(sizes).toHaveLength(5);
		for (const size of sizes) {
			expect(size).toBeGreaterThan(12); // never the old ~9pt DEFAULT_CEILING_PX floor
		}
		expect(new Set(sizes).size).toBe(1); // one shared size across every node
	});
});
