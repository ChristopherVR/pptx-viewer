import { describe, expect, it } from 'vitest';

import type {
	PptxSmartArtLayoutNode,
	PptxSmartArtNode,
	PptxSmartArtPresLayoutVars,
} from '../types';
import { buildConstraintIndex } from './smartart-constraint-solver';
import type { ConstraintIndex } from './smartart-constraint-solver';
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

/** Root + 3 direct children, one of which has its own child - matches `hierarchy-list--hier5.pptx`'s own real `data1.xml` exactly. */
const HIERARCHY_LIST_TREE: PptxSmartArtNode[] = [
	{ id: 'n1', text: 'Node One' },
	{ id: 'n2', text: 'Node Two has a longer label', parentId: 'n1' },
	{ id: 'n3', text: 'Node Three', parentId: 'n1' },
	{ id: 'n4', text: 'Node Four', parentId: 'n1' },
	{ id: 'n5', text: 'Node Five', parentId: 'n4' },
];

/**
 * The declared "corner-anchored hierarchy" construct
 * (`smartart-hierarchy-corner-plan.ts`), transcribed from `hierarchy-list--
 * hier5.pptx`'s own real `ppt/diagrams/layout1.xml`: `root(hierRoot,
 * hierAlign) -> [rootComposite -> [rootText, rootConnector], childShape
 * (hierChild, linDir=fromT, chAlign) -> [Name13 (conn), childText]]`, with
 * `childText`'s own `presOf axis="self desOrSelf" ... cnt="1 0"` (the
 * unbounded-descendant-hop shape `hierarchyLeafFoldsDescendants` looks for)
 * and the SAME `w`/`h` constraints (`rootComposite` `w=1,h=0.5`; `childText`
 * `w=0.8*rootComposite.w,h=rootComposite.h`) that give `resolveHierarchy
 * GenerationTemplates` a genuine root-vs-descendant size split (COM-verified
 * against the real fixture's own cached drawing - see that module's doc
 * comment). Builds a real `ConstraintIndex` (`buildConstraintIndex`, not the
 * `EMPTY_CONSTRAINT_INDEX` `arrangeHierarchy`'s own default param falls back
 * to) so `resolveCornerHangPlan`'s gate genuinely engages, not just the
 * count-preserving `foldDeeperGenerations` mechanism `std`/`tailed` mode
 * already has on its own.
 */
function cornerAlgorithmNode(
	hierAlign: string,
	chAlign: string,
): { algorithmNode: PptxSmartArtLayoutNode; index: ConstraintIndex } {
	const algorithmNode: PptxSmartArtLayoutNode = {
		name: 'diagram',
		algorithm: { type: 'hierChild', parameters: [{ type: 'linDir', value: 'fromL' }] },
		constraints: [
			{ type: 'w', for: 'des', forName: 'rootComposite', referenceType: 'w' },
			{ type: 'h', for: 'des', forName: 'rootComposite', referenceType: 'w', factor: 0.5 },
			{
				type: 'w',
				for: 'des',
				forName: 'childText',
				referenceType: 'w',
				referenceFor: 'des',
				referenceForName: 'rootComposite',
				factor: 0.8,
			},
			{
				type: 'h',
				for: 'des',
				forName: 'childText',
				referenceType: 'h',
				referenceFor: 'des',
				referenceForName: 'rootComposite',
			},
		],
		children: [
			{
				name: 'root',
				algorithm: { type: 'hierRoot', parameters: [{ type: 'hierAlign', value: hierAlign }] },
				children: [
					{
						name: 'rootComposite',
						algorithm: { type: 'composite' },
						// `rootText` fills its wrapping composite exactly (the real
						// fixture's own shape: `l`/`t` default to 0, `w`/`h` chain back
						// to `rootComposite`'s own declared `w`/`h` above) - this is
						// what actually gives `rootText` a resolvable size at all, not
						// the outer `diagram`-level constraints alone.
						constraints: [
							{ type: 'w', for: 'ch', forName: 'rootText', referenceType: 'w' },
							{ type: 'h', for: 'ch', forName: 'rootText', referenceType: 'h' },
						],
						children: [
							{
								name: 'rootText',
								algorithm: { type: 'tx' },
								shape: { presetGeometry: 'roundRect' },
							},
							{ name: 'rootConnector', algorithm: { type: 'sp' } },
						],
					},
					{
						name: 'childShape',
						algorithm: {
							type: 'hierChild',
							parameters: [
								{ type: 'chAlign', value: chAlign },
								{ type: 'linDir', value: 'fromT' },
							],
						},
						children: [
							{ name: 'Name13', algorithm: { type: 'conn' } },
							{
								name: 'childText',
								algorithm: { type: 'tx' },
								shape: { presetGeometry: 'roundRect' },
								presentationOf: {
									axis: ['self', 'desOrSelf'],
									pointTypes: ['node', 'node'],
									start: [1, 1],
									count: [1, 0],
								},
							},
						],
					},
				],
			},
		],
	};
	return { algorithmNode, index: buildConstraintIndex({ rootNode: algorithmNode }) };
}

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

// G7 (corrected, SESSION 37 - see `smartart-hierarchy-corner-plan.ts`'s own
// module doc comment): a BARE outermost `linDir` with no `hierAlign`-bearing
// nested `hierRoot` does NOT select a hanging tree - full-227-fixture corpus
// verification (`hierarchy--hier5/flat3/hier8.pptx`, `circle-picture-
// hierarchy--hier5.pptx`, `labeled-hierarchy--hier5.pptx`) shows this exact
// shape (a `hierChild1` choose wrapping ONLY a `dir=norm/rev` left/right
// mirror, no nested `hierChild` under its own `hierRoot`) is the REAL,
// common "plain fanning" construct, not a hand-authored hanging one - see
// that module's doc comment for the full derivation. The genuine hanging
// fallback needs the full declared construct: `hierAlign="tL"/"tR"` on a
// nested `hierRoot`, THAT node's own nested `hierChild` declaring a VERTICAL
// `linDir` (`fromT`/`fromB`), and a genuinely distinct root-vs-descendant
// item size (`resolveHierarchyGenerationTemplates`'s own `root` entry) -
// `hierarchy-list--hier5.pptx`'s own real shape, transcribed here.
describe('smartArt hierarchy arranger: linDir fallback (no presLayoutVars.hierBranch)', () => {
	function bareLinDirAlgNode(linDir: string): PptxSmartArtLayoutNode {
		return { algorithm: { type: 'hierChild', parameters: [{ type: 'linDir', value: linDir }] } };
	}

	it('a bare outermost linDir with no hierAlign-bearing hierRoot does NOT hang (falls back to std, matching the plain fanning family)', () => {
		const result = arrangeHierarchy(
			DEPTH_THREE_TREE,
			box,
			palette,
			'flat',
			'hier-test',
			undefined,
			undefined,
			bareLinDirAlgNode('fromL'),
		);
		const std = run(DEPTH_THREE_TREE, undefined);
		// Same top-down fan-out as the plain std branch: children share the
		// root's own fan row, not a hanging column indented sideways.
		expect(byId(result, 'c1').y).toBeCloseTo(byId(std, 'c1').y, 0);
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
			bareLinDirAlgNode('fromR'),
		);
		const std = run(DEPTH_THREE_TREE, { hierarchyBranch: 'std' });
		expect(byId(result, 'c1').y).toBeCloseTo(byId(std, 'c1').y, 0);
	});

	it('chAlign="r" mirrors the corner-anchored column to the LEFT edge instead of the right (hierAlign="tL"/"tR" + a genuine root-vs-descendant size split)', () => {
		const { algorithmNode, index } = cornerAlgorithmNode('tL', 'r');
		const result = arrangeHierarchy(
			HIERARCHY_LIST_TREE,
			box,
			palette,
			'flat',
			'hier-corner-mirror',
			undefined,
			undefined,
			algorithmNode,
			index,
		);
		const root = byId(result, 'n1');
		const child = byId(result, 'n2');
		// Mirrored (`side: 'left'`): every row shares the column's LEFT edge -
		// `chAlign="l"` (the real hierarchy-list--hier5.pptx shape, its own
		// forced-mode describe block below) shares the RIGHT edge instead.
		expect(root.x).toBeCloseTo(child.x, 0);
		expect(root.width).toBeGreaterThan(child.width); // the distinctly-templated, wider root
	});
});

/**
 * `square-accent-list--hier5.pptx`'s own shape, transcribed from its real
 * `ppt/diagrams/layout1.xml`: a FOREST (the outer `hierChild` fans one
 * `hierRoot` instance per top-level data node, `linDir="fromL"`), each
 * `hierRoot` nesting its OWN `hierChild` (`linDir="fromT"`, `chAlign="r"`)
 * hanging its own descendants - see `smartart-hierarchy-fanned-hang.ts`'s
 * own module doc comment. `Parent`/`Child` are `tx`+shape descendants
 * declared entirely inside a `dir="norm"/"rev"` `dgm:choose` (real
 * PowerPoint content, mirroring text alignment), exercising the
 * choose-wrapped-tx detection fix end to end, not just the direct-alg shape
 * `cornerAlgorithmNode` above already covers.
 */
function squareAccentListAlgorithmNode(): {
	algorithmNode: PptxSmartArtLayoutNode;
	index: ConstraintIndex;
} {
	const txChoose = (side: 'l' | 'r') => [
		{
			when: [
				{
					function: 'var' as const,
					operator: 'equ' as const,
					value: 'norm',
					argument: 'dir',
					rawXml: {
						'dgm:alg': {
							'@_type': 'tx',
							'dgm:param': [{ '@_type': 'parTxLTRAlign', '@_val': side }],
						},
					},
				},
			],
			otherwise: { rawXml: { 'dgm:alg': { '@_type': 'tx' } } },
		},
	];
	const algorithmNode: PptxSmartArtLayoutNode = {
		name: 'layout',
		algorithm: { type: 'hierChild', parameters: [{ type: 'linDir', value: 'fromL' }] },
		constraints: [
			{
				type: 'w',
				for: 'des',
				forName: 'rootComposite',
				referenceType: 'h',
				referenceFor: 'des',
				referenceForName: 'rootComposite',
				factor: 3.0396,
			},
			{ type: 'h', for: 'des', forName: 'rootComposite', referenceType: 'h' },
			{
				type: 'w',
				for: 'des',
				forName: 'childComposite',
				referenceType: 'w',
				referenceFor: 'des',
				referenceForName: 'rootComposite',
			},
			{
				type: 'h',
				for: 'des',
				forName: 'childComposite',
				referenceType: 'h',
				referenceFor: 'des',
				referenceForName: 'rootComposite',
				factor: 0.5205,
			},
			{
				type: 'sibSp',
				referenceType: 'w',
				referenceFor: 'des',
				referenceForName: 'rootComposite',
				factor: 0.05,
			},
		],
		children: [
			{
				name: 'root',
				algorithm: { type: 'hierRoot', parameters: [{ type: 'hierAlign', value: 'tL' }] },
				children: [
					{
						name: 'rootComposite',
						algorithm: { type: 'composite' },
						constraints: [
							{ type: 'w', for: 'ch', forName: 'Parent', referenceType: 'w' },
							{ type: 'h', for: 'ch', forName: 'Parent', referenceType: 'h', factor: 0.6424 },
						],
						children: [
							{ name: 'Parent', choose: txChoose('l'), shape: { presetGeometry: 'rect' } },
						],
					},
					{
						name: 'childShape',
						algorithm: {
							type: 'hierChild',
							parameters: [
								{ type: 'chAlign', value: 'r' },
								{ type: 'linDir', value: 'fromT' },
							],
						},
						children: [
							{
								name: 'childComposite',
								algorithm: { type: 'composite' },
								constraints: [
									{ type: 'w', for: 'ch', forName: 'Child', referenceType: 'w', factor: 0.93 },
									{ type: 'h', for: 'ch', forName: 'Child', referenceType: 'h' },
								],
								children: [
									{ name: 'Child', choose: txChoose('l'), shape: { presetGeometry: 'rect' } },
								],
							},
						],
					},
				],
			},
		],
	};
	return { algorithmNode, index: buildConstraintIndex({ rootNode: algorithmNode }) };
}

describe('smartArt hierarchy arranger: fanned root row with per-branch hanging columns (square-accent-list)', () => {
	// Matches square-accent-list--hier8.pptx's own real data1.xml: 3
	// independent top-level roots (a FOREST, `roots.length > 1`), branches A
	// and B each hang two descendants, branch C hangs one.
	const FOREST: PptxSmartArtNode[] = [
		{ id: 'a', text: 'Branch A Root' },
		{ id: 'a1', text: 'Branch A Child', parentId: 'a' },
		{ id: 'a2', text: 'Branch A Grandchild', parentId: 'a1' },
		{ id: 'b', text: 'Branch B Root' },
		{ id: 'b1', text: 'Branch B Child', parentId: 'b' },
		{ id: 'b2', text: 'Branch B Grandchild', parentId: 'b1' },
		{ id: 'c', text: 'Branch C Root' },
		{ id: 'c1', text: 'Branch C Child', parentId: 'c' },
	];
	const forestBox: BoundingBox = { width: 867, height: 533 };

	function runForest(nodes: PptxSmartArtNode[]): SmartArtLayoutResult {
		const { algorithmNode, index } = squareAccentListAlgorithmNode();
		// `direction: 'norm'` matches what real parsed content always supplies
		// (`dgm:dir`'s own resolved default) - needed so `Parent`/`Child`'s
		// own `dir="norm"/"rev"`-mirroring `dgm:choose` is decidable at all
		// (see `smartart-hierarchy-generation-templates.test.ts`'s own
		// `squareAccentListLikeDefinition` for the same requirement).
		return arrangeHierarchy(
			nodes,
			forestBox,
			palette,
			'flat',
			'hier-forest',
			{ direction: 'norm' },
			undefined,
			algorithmNode,
			index,
		);
	}

	it('fans every root across the row at the SAME y, in increasing x order', () => {
		const result = runForest(FOREST);
		const a = byId(result, 'a');
		const b = byId(result, 'b');
		const c = byId(result, 'c');
		expect(a.y).toBeCloseTo(b.y, 0);
		expect(b.y).toBeCloseTo(c.y, 0);
		expect(a.x).toBeLessThan(b.x);
		expect(b.x).toBeLessThan(c.x);
	});

	it("hangs each branch's own descendants below ITS OWN root, not stacked with another branch", () => {
		const result = runForest(FOREST);
		const a = byId(result, 'a');
		const a1 = byId(result, 'a1');
		const a2 = byId(result, 'a2');
		const b1 = byId(result, 'b1');
		// a1/a2 stack in ONE column below branch A's own root - same x, a2 below a1.
		expect(a1.x).toBeCloseTo(a2.x, 0);
		expect(a2.y).toBeGreaterThan(a1.y);
		expect(a1.y).toBeGreaterThan(a.y + a.height);
		// Branch A's own descendants never land at branch B's column.
		expect(a1.x).not.toBeCloseTo(b1.x, 0);
	});

	it('the root row spans the full box width edge to edge (no fixture-specific margin)', () => {
		const result = runForest(FOREST);
		const a = byId(result, 'a');
		const c = byId(result, 'c');
		expect(a.x).toBeCloseTo(0, 0);
		expect(c.x + c.width).toBeCloseTo(forestBox.width, 0);
	});

	it('a single-root tree (roots.length <= 1) under the SAME construct still takes the pre-existing single-column path unchanged', () => {
		const singleRoot: PptxSmartArtNode[] = [
			{ id: 'a', text: 'Branch A Root' },
			{ id: 'a1', text: 'Branch A Child', parentId: 'a' },
		];
		const result = runForest(singleRoot);
		const a = byId(result, 'a');
		const a1 = byId(result, 'a1');
		// `arrangeFullyHangingTree`'s own single-column model: descendant hangs
		// below the root, offset sideways by `indent` (see that module).
		expect(a1.y).toBeGreaterThan(a.y);
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

	it('renders an assistant at the same x as its manager in the declared corner-anchored construct', () => {
		// Only reached for the declared corner-anchored construct
		// (`smartart-hierarchy-corner-plan.ts`) - a bare `linDir` with no
		// `hierAlign`-bearing `hierRoot` no longer hangs at all, see the
		// `linDir fallback` describe block above.
		const { algorithmNode, index } = cornerAlgorithmNode('tL', 'l');
		const result = arrangeHierarchy(
			withAssistant,
			box,
			palette,
			'flat',
			'hier-test',
			{ orgChart: true },
			undefined,
			algorithmNode,
			index,
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

	// SESSION 36/37: a SCOPED `sibSp` (`for`/`forName` set - a generation-2+
	// hanging row's own vertical gap, e.g. `hierarchy-list`/`horizontal-
	// labeled-hierarchy`/`titled-picture-accent-list`'s own `childShape`-
	// scoped `sibSp refType="h"`) is NOT the whole-diagram transposition
	// signal; only an UNSCOPED one (the genuine "Horizontal Hierarchy" shape,
	// pinned above) is - see `smartart-hierarchy-orientation.ts`'s own
	// `sibSpReferencesHeight` doc comment.
	it('a SCOPED sibSp referencing height does NOT transpose the hierarchy (unlike the unscoped case above)', () => {
		const scopedSibSpAlg: PptxSmartArtLayoutNode = {
			algorithm: { type: 'hierChild' },
			constraints: [
				{
					type: 'sibSp',
					for: 'des',
					forName: 'childShape',
					referenceType: 'h',
					referenceFor: 'des',
					referenceForName: 'rootComposite',
					factor: 0.25,
				},
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
			'hier-scoped-sibsp',
			undefined,
			undefined,
			scopedSibSpAlg,
		);
		const std = arrangeHierarchy(
			twoChildren,
			GALLERY_BOX,
			palette,
			'flat',
			'hier-scoped-sibsp-std',
			undefined,
			undefined,
			{ algorithm: { type: 'hierChild' } },
		);
		// Non-transposed: children fan along the SAME axis as the plain std
		// case (root above, children below at a shared y), not the
		// transposed shape's own "root flush left, children stacked beside
		// it" layout.
		expect(byId(result, 'c1').y).toBeCloseTo(byId(std, 'c1').y, -1);
		expect(byId(result, 'c1').y).toBeCloseTo(byId(result, 'c2').y, 6);
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

// `hierarchy-list--hier5.pptx`'s OWN `mode==='hanging'` path
// (`arrangeFullyHangingTree`, SESSION 35's `smartart-hierarchy-hanging-box.ts`)
// did not consult `foldDeeperGenerations` at all (SESSION 34/35): once
// `discoverArrangement`'s own direct-children-only choose-branch lookup is
// fixed (Track S/L, NOT this file), this real layout's linDir=fromL routes
// through `arrangeFullyHangingTree` instead of `placeStandardTree`, and would
// place a 5th box for "Node Five" (a grandchild the cached drawing folds into
// "Node Four"'s own box) without this fix. `realAlgorithmNode` below is
// transcribed directly from `hierarchy-list--hier5.pptx`'s own
// `ppt/diagrams/layout1.xml` (`root` -> [`rootComposite` -> [`rootText`,
// `rootConnector`], `childShape` -> [`Name13` (conn), `childText`]], with
// `childText`'s own `presOf axis="self desOrSelf" ... cnt="1 0"` - the exact
// unbounded-descendant-hop shape `hierarchyLeafFoldsDescendants` looks for),
// with `linDir` forced onto the top-level algorithm the same way SESSION 35's
// own diagnostic (`s35-verify-hanging-box.ts`) forced it, since the
// choose-branch dispatch bug is out of this lane.
describe('smartArt hierarchy arranger: mode===hanging honours foldDeeperGenerations (hierarchy-list--hier5.pptx real layout definition, forced onto the hanging path)', () => {
	const { algorithmNode: realAlgorithmNode, index: realIndex } = cornerAlgorithmNode('tL', 'l');

	it('genuinely engages the corner-anchored mode (root wider than descendants, sharing the RIGHT column edge - chAlign="l")', () => {
		const result = arrangeHierarchy(
			HIERARCHY_LIST_TREE,
			box,
			palette,
			'flat',
			'hier-list-corner-shape',
			undefined,
			undefined,
			realAlgorithmNode,
			realIndex,
		);
		const root = byId(result, 'n1');
		const child = byId(result, 'n2');
		// COM-verified against `hierarchy-list--hier5.pptx`'s own cached
		// drawing: root and every descendant row share the SAME right edge,
		// root simply extending further left (its own distinct, wider
		// template) - see `smartart-hierarchy-hanging.ts`'s `HangingOptions
		// .columnAlign` doc comment.
		expect(root.width).toBeGreaterThan(child.width);
		expect(root.x + root.width).toBeCloseTo(child.x + child.width, 0);
		expect(root.x).toBeLessThan(child.x);
	});

	it('does not give "Node Five" its own box on the hanging path (count matches cached: root + 3 direct children only)', () => {
		const result = arrangeHierarchy(
			HIERARCHY_LIST_TREE,
			box,
			palette,
			'flat',
			'hier-list-fold-hanging',
			undefined,
			undefined,
			realAlgorithmNode,
			realIndex,
		);
		// Cached ground truth (hierarchy-list--hier5.pptx): 4 text-bearing
		// shapes. "Node Five" folds into "Node Four"'s own box instead (the
		// drawing bridge's `collectFoldedDescendants`, exercised at a higher
		// layer than this arranger - this test pins the box COUNT
		// `arrangeHierarchy` itself produces, mirroring the existing std/tailed
		// fold-depth tests above).
		expect(rects(result)).toHaveLength(4);
		expect(rects(result).some((n) => n.nodeId === 'n5')).toBeFalsy();
	});

	it('gives every generation its own box on the hanging path with no fold signal (plain "self" presOf childText, no regression)', () => {
		const plainAlgorithmNode: PptxSmartArtLayoutNode = {
			...realAlgorithmNode,
			children: [
				{
					...realAlgorithmNode.children![0],
					children: [
						realAlgorithmNode.children![0].children![0],
						{
							name: 'childShape',
							algorithm: { type: 'hierChild', parameters: [{ type: 'linDir', value: 'fromT' }] },
							children: [
								{
									name: 'childText',
									algorithm: { type: 'tx' },
									shape: { presetGeometry: 'roundRect' },
									presentationOf: { axis: ['self'] },
								},
							],
						},
					],
				},
			],
		};
		const result = arrangeHierarchy(
			HIERARCHY_LIST_TREE,
			box,
			palette,
			'flat',
			'hier-list-nofold-hanging',
			undefined,
			undefined,
			plainAlgorithmNode,
			buildConstraintIndex({ rootNode: plainAlgorithmNode }),
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

// SESSION 28: `half-circle-organization-chart--hier5.pptx`'s own declared
// shape (`Name0`'s own `h for="des" forName="rootComposite1" refType="w"
// refFor="des" refForName="rootComposite1" fact="0.5"` composite aspect, `sp
// for="des" forName="hierRoot1" refType="w" refFor="des"
// refForName="rootComposite1" fact="0.21"` generation gap, `rootText1`'s own
// `h refType="h" fact="0.64"` parent-relative height, `alignOff val="0.65"`
// on every `hierRoot` past the root) - see `smartart-layout-interpreter-
// hierarchy.ts`'s own `cascadeAllGenerations` doc comment for the full
// derivation against the fixture's own cached geometry.
describe('smartArt hierarchy arranger: cascadeAllGenerations (declared composite cascade)', () => {
	const cascadeAlgorithmNode: PptxSmartArtLayoutNode = {
		name: 'Name0',
		algorithm: { type: 'hierChild' },
		constraints: [
			{ type: 'w', for: 'des', forName: 'rootComposite1', referenceType: 'w', factor: 10 },
			{
				type: 'h',
				for: 'des',
				forName: 'rootComposite1',
				referenceType: 'w',
				referenceFor: 'des',
				referenceForName: 'rootComposite1',
				factor: 0.5,
			},
			{
				type: 'sp',
				for: 'des',
				forName: 'hierRoot1',
				referenceType: 'w',
				referenceFor: 'des',
				referenceForName: 'rootComposite1',
				factor: 0.21,
			},
			{
				type: 'sibSp',
				referenceType: 'w',
				referenceFor: 'des',
				referenceForName: 'rootComposite1',
				factor: 0.21,
			},
		],
		children: [
			{
				name: 'hierRoot1',
				algorithm: { type: 'hierRoot' },
				children: [
					{
						name: 'rootComposite1',
						algorithm: { type: 'composite' },
						constraints: [
							{ type: 'w', for: 'ch', forName: 'rootText1', referenceType: 'w' },
							{
								type: 'h',
								for: 'ch',
								forName: 'rootText1',
								referenceType: 'h',
								factor: 0.64,
							},
						],
						children: [
							{ name: 'rootText1', algorithm: { type: 'tx' }, presentationOf: { axis: ['self'] } },
						],
					},
				],
			},
		],
	};

	it('places every generation (root, fanned children, and the row past them) on the SAME uniform pitch, not a smaller independent hang gap', () => {
		// m -> {c1, c2}, c1 -> g1, c2 -> g2: half-circle's own real tree shape.
		const result = arrangeHierarchy(
			DEPTH_THREE_TREE,
			box,
			palette,
			'flat',
			'hier-cascade',
			{ hierarchyBranch: 'init' },
			undefined,
			cascadeAlgorithmNode,
		);
		const m = byId(result, 'm');
		const c1 = byId(result, 'c1');
		const c2 = byId(result, 'c2');
		const g1 = byId(result, 'g1');
		const g2 = byId(result, 'g2');
		// The fanned row sits ONE pitch below the root, and the row past the
		// fan sits ANOTHER full pitch below that - not a smaller HANG_HEIGHT_
		// RATIO-sized gap the pre-SESSION-28 model would give here.
		const rootToFan = c1.y - m.y;
		const fanToHang = g1.y - c1.y;
		expect(rootToFan).toBeGreaterThan(0);
		expect(fanToHang).toBeCloseTo(rootToFan, 0);
		expect(c1.y).toBeCloseTo(c2.y, 6); // same fanned row
		expect(g1.y).toBeCloseTo(g2.y, 6); // same row past the fan
	});

	it('shifts the row past the fan by a FIXED rightward offset from its own immediate parent, regardless of branch side', () => {
		const result = arrangeHierarchy(
			DEPTH_THREE_TREE,
			box,
			palette,
			'flat',
			'hier-cascade-x',
			{ hierarchyBranch: 'init' },
			undefined,
			cascadeAlgorithmNode,
		);
		const c1 = byId(result, 'c1');
		const c2 = byId(result, 'c2');
		const g1 = byId(result, 'g1');
		const g2 = byId(result, 'g2');
		const shiftUnderC1 = g1.x - c1.x;
		const shiftUnderC2 = g2.x - c2.x;
		expect(shiftUnderC1).toBeGreaterThan(0); // a real rightward nudge, not 0
		expect(shiftUnderC1).toBeCloseTo(shiftUnderC2, 6); // same absolute shift both branches
	});

	it('does NOT engage for a layoutDef with no declared composite (the ordinary tailed org-chart family stays on the pre-existing fan+hang model)', () => {
		const plainAlgorithmNode: PptxSmartArtLayoutNode = {
			name: 'Name0',
			algorithm: { type: 'hierChild' },
			children: [
				{
					name: 'hierRoot1',
					algorithm: { type: 'hierRoot' },
					children: [
						{ name: 'rootText1', algorithm: { type: 'tx' }, presentationOf: { axis: ['self'] } },
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
			{ hierarchyBranch: 'init' },
			undefined,
			plainAlgorithmNode,
		);
		const c1 = byId(result, 'c1');
		const g1 = byId(result, 'g1');
		// The old hanging-tail model indents the tail sideways from the SAME x,
		// never the cascade's own directional shift - g1 stays close to c1's own
		// x (the tail's first hop anchors directly under its parent, see
		// FOUR_GENERATION_CHAIN's own module doc comment above).
		expect(Math.abs(g1.x - c1.x)).toBeLessThan(box.width * 0.1);
	});
});
