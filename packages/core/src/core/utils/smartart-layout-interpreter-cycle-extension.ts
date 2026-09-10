/**
 * SmartArt DiagramML interpreter - cycle ring point EXTENSION (a data node
 * on the ring that itself has children - `radial-cluster`'s construct).
 *
 * PowerPoint's own "Radial Cluster" gallery layoutDef does not implement
 * this recursively at the DiagramML level - it HAND-DUPLICATES a full
 * "this satellite becomes its own centre + one further point" sub-structure
 * for each of up to 7 possible ring positions (`childCenter1..7`/`text1..7`
 * in the raw XML, each an `alg="tx"` fixed-position leaf, gated by its own
 * `dgm:choose func="cnt"` checking whether that specific satellite's data
 * node has children - see `smartart-track-r-successor.md` SESSION 11's
 * construct analysis). Reproducing that hand-authored per-slot absolute
 * positioning exactly is not a generalisable fix (it does not extend to an
 * arbitrary ring size, and 172 hand-unrolled `dgm:alg` blocks are not a
 * pattern worth porting literally) - this module is the GENERAL
 * interpreter-side equivalent instead: a ring point whose data node has its
 * own children is not a leaf; its child(ren) continue OUTWARD along the
 * same radial direction the point itself already sits on, one step further
 * from the ring's own centre, recursing for any deeper generation.
 *
 * COM-verified for the one shape the corpus actually exercises
 * (`radial-cluster--hier5.pptx`'s "Node Four" -> "Node Five", a single
 * grandchild): the cached child centre lies on the ray from the ring's own
 * centre through the parent's centre, at `t ~= 2.0-2.1` (twice the parent's
 * own radius) - i.e. the child continues in the SAME direction, not on an
 * independent sub-ring of its own. This module reproduces that by placing a
 * lone child exactly on that ray, one item-width-plus-gap further out.
 *
 * The MULTI-child fan (more than one grandchild under the SAME parent) is
 * NOT exercised by any corpus fixture - `fanSpanDeg` (the total angular
 * spread the siblings fan across, centred on the outward direction) is a
 * REASONED EXTRAPOLATION only, not an empirically confirmed value: whoever
 * finds a multi-grandchild sample should re-verify it against live
 * PowerPoint COM output rather than trust this module's own default.
 *
 * Pure geometry + node-building; no framework code.
 */

import type { PptxSmartArtLayoutNode, PptxSmartArtNode } from '../types';
import type { CycleBoxInputs } from './smartart-layout-interpreter-cycle-boxes';
import type { CycleRingLayout } from './smartart-layout-interpreter-cycle-ring';
import { presetBoxNode } from './smartart-layout-interpreter-preset-node';
import type { RenderedConnector, RenderedNode } from './smartart-layout-types';

const DEG_TO_RAD = Math.PI / 180;

interface Point {
	x: number;
	y: number;
}

/**
 * True when `node` (the arranger `discoverArrangement` resolved) was reached
 * through an enclosing `dgm:if func="maxDepth"` ({@link
 * PptxSmartArtLayoutNode.chooseGuard}) - the one structural, non-per-layout-
 * name signal that distinguishes `radial-cluster`'s own `singleCycle` (reached
 * through exactly one `func="maxDepth" op="lte" val="1"` guard - COM-verified
 * via a direct `discoverArrangement` dump) from EVERY other hub-bearing cycle
 * fixture in the corpus (`radial-cycle`/`basic-radial`/`diverging-radial`/
 * `converging-radial`/`radial-venn`, all confirmed `chooseGuard: undefined`)
 * - see `arrangeCycle`'s own call site for why this is required IN ADDITION
 * to `hubAlreadyStripped`, not instead of it: `radial-cycle--hier5.pptx`'s
 * own sample data gives one ring satellite an unrelated extra child too (the
 * IDENTICAL data shape `radial-cluster--hier5.pptx` uses), and its cached
 * drawing FOLDS that child's text into the satellite's own box instead of
 * rendering it separately - `hubAlreadyStripped` alone cannot tell these two
 * layouts apart, since both are genuinely hub-stripped.
 */
export function hasMaxDepthGuard(node: PptxSmartArtLayoutNode): boolean {
	return node.chooseGuard?.some((guard) => guard.function === 'maxDepth') ?? false;
}

/** Shared, per-diagram inputs for every extension point this ring builds. */
export interface CycleExtensionContext extends CycleBoxInputs {
	/** The main ring's own natural centre (box-local pixels) - every extension direction is measured from here. */
	ringCentre: Point;
	itemWidth: number;
	itemHeight: number;
	/** Edge-to-edge gap (pixels) between a parent and its extension child - reuses the ring's own resolved `sibSp` gap. */
	gapPx: number;
	/** Total angular spread (degrees) a MULTI-child fan occupies, centred on the outward direction - see the module doc comment's "not empirically confirmed" note. */
	fanSpanDeg: number;
	childrenOf: Map<string, PptxSmartArtNode[]>;
}

/**
 * Recursively render `parentNode`'s own children (and their own children, at
 * any depth) as further ring-continuation points, extending outward from
 * `parentCentre` along the ray from `context.ringCentre` through it. Returns
 * an EMPTY result (a no-op) when `parentNode` has no children - the common
 * case for every ring point in every other cycle-family fixture, so wiring
 * this into `arrangeCycle` is behaviour-preserving whenever no ring point
 * has children of its own.
 */
export function buildCycleRingExtensions(
	parentCentre: Point,
	parentNode: PptxSmartArtNode,
	context: CycleExtensionContext,
	path: string,
): { nodes: RenderedNode[]; connectors: RenderedConnector[] } {
	const children = context.childrenOf.get(parentNode.id) ?? [];
	if (children.length === 0) {
		return { nodes: [], connectors: [] };
	}
	const dx = parentCentre.x - context.ringCentre.x;
	const dy = parentCentre.y - context.ringCentre.y;
	const dist = Math.hypot(dx, dy);
	// Degenerate direction (parent sits exactly on the ring's own centre -
	// only possible for a degenerate single-point ring): fall back to a
	// fixed rightward direction rather than dividing by zero.
	const baseAngleRad = dist > 1e-6 ? Math.atan2(dy, dx) : 0;
	const halfExtent = Math.max(context.itemWidth, context.itemHeight) / 2;
	const radius = context.itemWidth / 2 + Math.max(0, context.gapPx) + halfExtent;
	const count = children.length;
	const spanRad = context.fanSpanDeg * DEG_TO_RAD;
	const nodes: RenderedNode[] = [];
	const connectors: RenderedConnector[] = [];
	children.forEach((child, i) => {
		const angle =
			count === 1 ? baseAngleRad : baseAngleRad - spanRad / 2 + (spanRad * i) / (count - 1);
		const cx = parentCentre.x + Math.cos(angle) * radius;
		const cy = parentCentre.y + Math.sin(angle) * radius;
		const key = `${context.elementId}-cycle-ext-${path}-${i}`;
		nodes.push(
			presetBoxNode({
				key,
				x: cx - context.itemWidth / 2,
				y: cy - context.itemHeight / 2,
				width: context.itemWidth,
				height: context.itemHeight,
				node: child,
				index: i,
				total: count,
				palette: context.palette,
				style: context.style,
				ctx: context.ctx,
				shape: context.shape,
				fallbackKind: 'circle',
				preserveEllipseAspect: true,
				fontSizeOverride: context.fontSizeOverride,
				descendantFontSize: context.descendantFontSize,
			}),
		);
		connectors.push({
			key: `${key}-conn`,
			d: `M${parentCentre.x},${parentCentre.y} L${cx},${cy}`,
		});
		const nested = buildCycleRingExtensions({ x: cx, y: cy }, child, context, `${path}-${i}`);
		nodes.push(...nested.nodes);
		connectors.push(...nested.connectors);
	});
	return { nodes, connectors };
}

/** `arrangeCycle`'s own per-diagram inputs for {@link applyCycleRingExtensions}. */
export interface CycleRingExtensionInputs extends CycleBoxInputs {
	ringCentre: Point;
	minGapRatio: number;
	absoluteGapPx: number | undefined;
	/** The main ring's own per-slot angular width - see {@link CycleExtensionContext.fanSpanDeg}'s doc comment. */
	ringStepDeg: number;
	childrenOf: Map<string, PptxSmartArtNode[]>;
}

/**
 * Run {@link buildCycleRingExtensions} for every point on `ring`, combining
 * every point's own (possibly empty) result - the single call site
 * `arrangeCycle` needs (split out of that module for the repo's per-file
 * line budget). A no-op (empty `nodes`/`connectors`) whenever no `ringNodes`
 * entry has children in `childrenOf`.
 */
export function applyCycleRingExtensions(
	ringNodes: PptxSmartArtNode[],
	ring: CycleRingLayout,
	inputs: CycleRingExtensionInputs,
): { nodes: RenderedNode[]; connectors: RenderedConnector[] } {
	const extensionGapPx = inputs.absoluteGapPx ?? inputs.minGapRatio * ring.nodeWidth;
	const fanSpanDeg = Math.abs(inputs.ringStepDeg) > 1e-6 ? Math.abs(inputs.ringStepDeg) : 60;
	const nodes: RenderedNode[] = [];
	const connectors: RenderedConnector[] = [];
	ringNodes.forEach((node, i) => {
		const extension = buildCycleRingExtensions(
			ring.centers[i],
			node,
			{
				...inputs,
				itemWidth: ring.nodeWidth,
				itemHeight: ring.nodeHeight,
				gapPx: extensionGapPx,
				fanSpanDeg,
			},
			String(i),
		);
		nodes.push(...extension.nodes);
		connectors.push(...extension.connectors);
	});
	return { nodes, connectors };
}
