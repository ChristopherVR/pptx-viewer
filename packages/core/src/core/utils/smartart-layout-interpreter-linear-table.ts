/**
 * SmartArt DiagramML interpreter - recursive `lin`-in-`lin` "table" item
 * template ("Table Hierarchy"/"Architecture Layout").
 *
 * Both built-in layouts share one construct (COM-verified: their `layout1
 * .xml`s differ only by `uniqueId`/title and `vertOne`'s own direction
 * choose gaining a third `fromB` branch): a per-top-level-point item
 * template (`vertOne`, reached through a genuine `axis="ch" ptType="node"`
 * `dgm:forEach`) that is ITSELF a vertical `lin` wrapping a text label
 * (`txOne`) plus a horizontal `lin` (`horzOne`) which `forEach`-wraps the
 * SAME shape one generation deeper (`vertTwo`, then `vertThree`, then
 * `vertFour`, which self-recurses via a `forEach ref="repeat"` back onto
 * its own shape for any depth beyond 4 - the parsed layout tree does not
 * expand that self-reference, so the STATIC template caps at 4 named
 * generations, but the REAL data-driven recursion here is unbounded,
 * walking `childrenOf` instead of the template).
 *
 * `discoverArrangement` (`smartart-layout-interpreter-model.ts`) resolves
 * `plan.node` directly to `vertOne` - not a wrapping top-level arranger -
 * so `selectArrangedNodes` hands `arrangeLinear` the WHOLE flattened tree
 * (every generation) as one list, with no signal left about which node is
 * whose parent or how deep it sits. The standard `arrangeLinear` body
 * (single row/column, one uniform per-item slot) cannot render that: this
 * module replaces it for exactly this construct, using `childrenOf` (an
 * arranger-level input already threaded in for text-folding, see
 * `arrangeLinear`'s own `descendantTextsFor`) to rebuild the tree and lay
 * out a real generation grid instead.
 *
 * Ground truth (`table-hierarchy--{flat3,hier5,hier8}.pptx`'s cached
 * `dsp:drawing`): every "node"-type box across the WHOLE tree shares ONE
 * row height (`<dgm:constr type="h" for="des" ptType="node" op="equ"/>`);
 * a node's own children split ITS OWN column width, never the full
 * diagram width again (an only-child stays exactly as wide as its
 * parent's column). Neither the row gap (`parTransN`, sized via a
 * cross-axis `w`-referencing `fact`, not a `sibSp`/`sp` constraint type)
 * nor the column gap (`sibSpaceN`, a `fact`-chained but NOT
 * `sibSp`/`sp`-typed reference either) resolves to a clean closed-form
 * ratio from the declared constraints alone (measured against all three
 * fixtures: the implied gap/extent ratio varies 0.04-0.10 depending on
 * generation/column count, not a single constant) - both fall back to
 * this interpreter's own existing generic default
 * ({@link DEFAULT_GAP_RATIO}, `smartart-layout-interpreter-linear-main-
 * axis.ts`'s `resolveMainAxisLayout` uses the identical `0.25` when no
 * `sibSp`/decorative-role signal is found), rather than a construct-
 * specific number invented from a single COM sample - the failure mode a
 * previous attempt at this exact construct measured as a regression.
 */

import type {
	PptxSmartArtLayoutNode,
	PptxSmartArtNode,
	PptxSmartArtPresLayoutVars,
	SmartArtStyle,
} from '../types';
import type { ConstraintIndex } from './smartart-constraint-solver';
import { chooseAlgorithm, chooseAlgType } from './smartart-layout-interpreter-choose-algorithm';
import type { ArrangementPlan } from './smartart-layout-interpreter-model';
import { presetBoxNode } from './smartart-layout-interpreter-preset-node';
import { styleContext } from './smartart-layout-interpreter-render';
import { resolveTieredItemFontSize } from './smartart-layout-item-font-tier';
import { findCompositeItemShape } from './smartart-layout-shape-preset';
import type { BoundingBox, RenderedNode, SmartArtLayoutResult } from './smartart-layout-types';

/** Matches `resolveMainAxisLayout`'s own "no explicit signal" fallback - see this module's doc comment. */
const DEFAULT_GAP_RATIO = 0.25;

function algTypeOf(
	node: PptxSmartArtLayoutNode,
	nodeCount: number,
	presLayoutVars: PptxSmartArtPresLayoutVars | undefined,
): string | undefined {
	return (
		node.algorithm?.type ?? chooseAlgType(node, nodeCount, { presLayoutVars: presLayoutVars ?? {} })
	);
}

/** The `horzOne`-shaped child: a `lin` sibling (not the label, not a spacer) that itself `forEach`-wraps a per-child-point item template. */
function findRowChild(
	node: PptxSmartArtLayoutNode,
	presLayoutVars: PptxSmartArtPresLayoutVars | undefined,
): PptxSmartArtLayoutNode | undefined {
	return (node.children ?? []).find((child) => {
		if (child.algorithm?.type === 'sp') {
			return false;
		}
		if (algTypeOf(child, 2, presLayoutVars) !== 'lin') {
			return false;
		}
		return (child.children ?? []).some(
			(grandchild) =>
				grandchild.forEachOrigin?.axis?.includes('ch') &&
				grandchild.forEachOrigin?.pointTypes?.includes('node'),
		);
	});
}

/**
 * Detect the recursive lin-in-lin table item template rooted at `node` - see
 * this module's doc comment for the exact shape. Deliberately narrow (every
 * one of these checks must hold): `node` itself must be a genuine per-point
 * item template (reached through an `axis="ch" ptType="node"` `dgm:forEach`),
 * must be a `lin`, must carry a self-presenting text label child, AND must
 * carry a nested `lin` "row" child whose OWN child is reached through the
 * SAME `axis="ch" ptType="node"` shape one generation deeper. Measured to
 * correctly exclude `sub-step-process--hier5.pptx` (a superficially similar
 * `lin`-wrapping-`lin` shape whose nested `lin`'s `forEachOrigin.axis` is
 * `self`, not `ch` - a once-per-point decoration, not a recursive template).
 */
export function isRecursiveTableItemTemplate(
	node: PptxSmartArtLayoutNode,
	presLayoutVars: PptxSmartArtPresLayoutVars | undefined,
): boolean {
	if (
		!node.forEachOrigin?.axis?.includes('ch') ||
		!node.forEachOrigin?.pointTypes?.includes('node')
	) {
		return false;
	}
	if (algTypeOf(node, 2, presLayoutVars) !== 'lin') {
		return false;
	}
	const hasLabel = (node.children ?? []).some(
		(child) => child.algorithm?.type === 'tx' && child.presentationOf?.axis?.includes('self'),
	);
	return hasLabel && findRowChild(node, presLayoutVars) !== undefined;
}

/** `linDir` (`fromL`/`fromR`/`fromT`/`fromB`) of a resolved (possibly choose-wrapped) `lin` node, defaulting to `fallback`. */
function resolvedLinDir(
	node: PptxSmartArtLayoutNode,
	nodeCount: number,
	presLayoutVars: PptxSmartArtPresLayoutVars | undefined,
	fallback: string,
): string {
	const alg =
		node.algorithm ?? chooseAlgorithm(node, nodeCount, { presLayoutVars: presLayoutVars ?? {} });
	return alg?.parameters?.find((p) => p.type === 'linDir')?.value ?? fallback;
}

/**
 * Lay out the recursive table construct: one row PER GENERATION present in
 * the real data tree (uniform height, a shared gap ratio between rows), each
 * node's own real children (via `childrenOf`) splitting ITS OWN column width
 * recursively. `nodes` is the whole flattened tree (every generation, as
 * `selectArrangedNodes` hands `arrangeLinear` for this construct); `box`'s
 * origin is always `(0, 0)` (see `BoundingBox`'s own doc comment).
 */
export function arrangeRecursiveTable(
	plan: ArrangementPlan,
	nodes: PptxSmartArtNode[],
	box: BoundingBox,
	palette: string[],
	style: SmartArtStyle,
	elementId: string,
	index: ConstraintIndex,
	childrenOf: Map<string, PptxSmartArtNode[]>,
	fontName: string | undefined,
	presLayoutVars: PptxSmartArtPresLayoutVars | undefined,
): SmartArtLayoutResult {
	const ctx = styleContext(style);
	const { width: w, height: h } = box;
	const reversed = resolvedLinDir(plan.node, nodes.length, presLayoutVars, 'fromT') === 'fromB';
	const rowChild = findRowChild(plan.node, presLayoutVars);
	const colReversed = rowChild
		? resolvedLinDir(rowChild, nodes.length, presLayoutVars, 'fromL') === 'fromR'
		: false;

	const byId = new Map(nodes.map((n) => [n.id, n]));
	const childrenIn = (n: PptxSmartArtNode): PptxSmartArtNode[] =>
		(childrenOf.get(n.id) ?? []).filter((c) => byId.has(c.id));
	const childIds = new Set<string>();
	for (const n of nodes) {
		for (const c of childrenIn(n)) {
			childIds.add(c.id);
		}
	}
	const roots = nodes.filter((n) => !childIds.has(n.id));

	const depthOf = new Map<string, number>();
	let maxDepth = 0;
	const depthStack: Array<{ node: PptxSmartArtNode; depth: number }> = roots.map((r) => ({
		node: r,
		depth: 0,
	}));
	while (depthStack.length > 0) {
		const { node, depth } = depthStack.pop() as { node: PptxSmartArtNode; depth: number };
		depthOf.set(node.id, depth);
		maxDepth = Math.max(maxDepth, depth);
		for (const c of childrenIn(node)) {
			depthStack.push({ node: c, depth: depth + 1 });
		}
	}
	const generations = maxDepth + 1;
	const rowDenom = generations + Math.max(0, generations - 1) * DEFAULT_GAP_RATIO;
	const rowHeight = h / rowDenom;
	const rowGap = DEFAULT_GAP_RATIO * rowHeight;
	const rowY = (depth: number): number =>
		(reversed ? generations - 1 - depth : depth) * (rowHeight + rowGap);

	const splitAcross = (
		items: PptxSmartArtNode[],
		x: number,
		width: number,
	): Array<[PptxSmartArtNode, number, number]> => {
		const n = items.length;
		if (n === 0) {
			return [];
		}
		const denom = n + Math.max(0, n - 1) * DEFAULT_GAP_RATIO;
		const colWidth = width / denom;
		const colGap = DEFAULT_GAP_RATIO * colWidth;
		const ordered = colReversed ? [...items].reverse() : items;
		const out: Array<[PptxSmartArtNode, number, number]> = [];
		let cursor = x;
		for (const item of ordered) {
			out.push([item, cursor, colWidth]);
			cursor += colWidth + colGap;
		}
		return out;
	};

	const placed: Array<{ node: PptxSmartArtNode; x: number; width: number }> = [];
	const place = (node: PptxSmartArtNode, x: number, width: number): void => {
		placed.push({ node, x, width });
		const kids = childrenIn(node);
		for (const [child, childX, childWidth] of splitAcross(kids, x, width)) {
			place(child, childX, childWidth);
		}
	};
	for (const [root, rootX, rootWidth] of splitAcross(roots, 0, w)) {
		place(root, rootX, rootWidth);
	}

	const itemShape = findCompositeItemShape(plan.node);
	const { rootSizePx: fontSizeOverride, descendantSizePx } = resolveTieredItemFontSize(
		plan,
		index,
		placed.map(({ node, width }) => ({
			rootText: node.text,
			descendantTexts: [],
			width,
			height: rowHeight,
			separateDescendantBox: false,
		})),
		fontName,
		undefined,
	);

	const renderedNodes: RenderedNode[] = placed.map(({ node, x, width }, i) =>
		presetBoxNode({
			key: `${elementId}-lintbl-${node.id}-${i}`,
			x,
			y: rowY(depthOf.get(node.id) ?? 0),
			width,
			height: rowHeight,
			node,
			index: i,
			total: placed.length,
			palette,
			style,
			ctx,
			shape: itemShape,
			fallbackKind: 'rect',
			fontSizeOverride,
			descendantFontSize: descendantSizePx,
		}),
	);

	return {
		nodes: renderedNodes,
		connectors: [],
		shadowFilter: ctx.shadow,
		viewBox: `0 0 ${w} ${h}`,
		family: 'list',
	};
}
