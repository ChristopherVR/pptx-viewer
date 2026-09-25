/**
 * Bridge from the per-point layout engine (`engine.ts`) to the same
 * `SmartArtLayoutResult` shape the legacy family-based interpreter produces
 * (`smartart-layout-types.ts`), so the existing save-pipeline bridge
 * (`smartart-interpreter-drawing-bridge.ts`'s `interpretedLayoutToElements`)
 * converts either one to `PptxElement[]` identically: text projection
 * (folding, per-run styling), node-style overrides and id conventions are
 * resolved there, once, for both engines.
 *
 * Every rendered node is emitted as a `RenderedRectNode`: the ACTUAL preset
 * geometry (chevron, ellipse, hexagon, ...) is carried verbatim in
 * `presetOverride` and rendered later by the full 187-preset geometry engine
 * from a plain bounding box, so a rect-shaped carrier is sufficient
 * regardless of the visual shape - see that bridge's `rect` branch, which
 * already treats `presetOverride` as authoritative over its own `kind`
 * default.
 *
 * Declines (`undefined`) whenever the layout definition uses an algorithm
 * this engine does not implement yet (`hierRoot`/`hierChild`): the
 * registry (`registry.ts`) silently substitutes
 * `composite` for an unknown type so the layout still runs to completion,
 * which would otherwise produce plausible-looking but wrong geometry with no
 * signal to the caller. Checking the resolved tree's actual algorithm set
 * (not the layout definition's declared choose/if branches) also correctly
 * accepts a layout that DECLARES a `dgm:choose` naming an unsupported
 * algorithm on a branch the data never takes.
 */

import type { PptxSmartArtData, PptxSmartArtNode, SmartArtStyle } from '../../types';
import {
	colour,
	nodeFill,
	nodeOpacity,
	strokeFor,
	styleShadow,
	styleStroke,
} from '../smartart-layout-style-helpers';
import type { RenderedRectNode, SmartArtLayoutResult } from '../smartart-layout-types';
import { runSmartArtEngine } from './engine';
import { applyEngineFonts } from './engine-fonts';
import type { RenderedEngineNode } from './engine-fonts';
import type { EngineNode } from './engine-node';
import { computeMoveWithMerge, sourceIdsOf } from './move-with-merge';
import { shapeTransform } from './shape-transform';

/** `dgm:alg/@type` values this engine executes (`registry.ts`). */
const SUPPORTED_ALGS = new Set([
	'composite',
	'lin',
	'conn',
	'snake',
	'cycle',
	'pyra',
	'hierRoot',
	'hierChild',
	'sp',
	'tx',
]);

/** 1 CSS pixel (96 dpi, this codebase's convention) in DrawingML points. */
const PT_PER_PX = 72 / 96;
const PX_PER_PT = 1 / PT_PER_PX;

/** True when every node in the resolved tree used a supported algorithm. */
function isFullySupported(root: EngineNode): boolean {
	let ok = true;
	const visit = (node: EngineNode): void => {
		if (!SUPPORTED_ALGS.has(node.alg.type)) {
			ok = false;
		}
		node.children.forEach(visit);
	};
	visit(root);
	return ok;
}

/**
 * A presented `parTrans`/`sibTrans` transition point's own connector text
 * (`DataPoint.label`, e.g. a numbered-list badge's ordinal "1"/"2"/"3", or an
 * org-chart relationship line's label) - there is no `PptxSmartArtNode` to
 * read `.text` from for a transition point (`point.source` is only ever set
 * for a `node`/`asst` content point), so this is the transition-point
 * equivalent `sourceIdsOf`'s content-point lookup can't cover. Only consulted
 * when `sourceIdsOf` found nothing, matching the drawing bridge's own
 * `literalText ?? projection?.text` precedence
 * (`smartart-interpreter-drawing-bridge.ts`).
 */
function transitionLabelOf(node: EngineNode): string | undefined {
	for (const point of node.presOf) {
		if (!point.source && point.label) {
			return point.label;
		}
	}
	return undefined;
}

/**
 * `hideGeom` (ECMA-376 Part 1, 21.4.7.16 `ST_OnOffStyleType`) means the node
 * draws NO visible border/fill, not that it is not a node: PowerPoint still
 * places its own text-bearing shape there (invisible outline, real text),
 * commonly a "descendant" role box folded under a sibling's card (see
 * `Vertical Action List`/`Descending Block List`/`Numbered Title List`: an
 * item's own child node text renders as a second, borderless line inside the
 * same visual card). Dropping every `hideGeom` node outright previously lost
 * those boxes entirely (2-3 of 5-6 text-bearing shapes per fixture) even
 * though the engine placed correct geometry for them; a `hideGeom` node with
 * NO presented text (a genuinely decorative/structural placeholder, e.g. a
 * sibling row with no descendant) is still skipped, since it carries nothing
 * to compare or display.
 *
 * A ZERO-AREA node is also skipped regardless of `hideGeom`/text: a
 * `hierChild` continuation for a childless leaf (`alg-hier.ts`'s
 * `arrangeHierRoot` deliberately gives one a `{w:0, h:0}` box, since it has
 * nothing of its own to fan) presents no text either way, so it was never
 * going to draw anything visible - but it still reached `isFiniteGeometry`
 * below as a "real" shape with degenerate geometry, declining the WHOLE
 * diagram over a box nothing would have shown (the same failure mode
 * `collectRenderedNodes`'s own `conn`-alg skip fixes for connectors).
 */
function isRenderable(
	node: EngineNode,
	primary: PptxSmartArtNode | undefined,
	literalText: string | undefined,
): boolean {
	if (!node.shape || !node.box) {
		return false;
	}
	if (node.box.w <= 0 || node.box.h <= 0) {
		return false;
	}
	if (!node.shape.hideGeom) {
		return true;
	}
	if (literalText && literalText.trim().length > 0) {
		return true;
	}
	return Boolean(primary?.text && primary.text.trim().length > 0);
}

function buildRenderedNode(
	node: EngineNode,
	index: number,
	nodeById: Map<string, PptxSmartArtNode>,
	palette: string[],
	style: SmartArtStyle,
	mergedSourceIds?: string[],
): RenderedRectNode | undefined {
	const transform = shapeTransform(node);
	if (!transform) {
		return undefined;
	}
	const sourceIds = sourceIdsOf(node);
	const primary = sourceIds.length > 0 ? nodeById.get(sourceIds[0]) : undefined;
	const literalText = sourceIds.length === 0 ? transitionLabelOf(node) : undefined;
	if (!isRenderable(node, primary, literalText)) {
		return undefined;
	}
	const hidden = Boolean(node.shape?.hideGeom);
	const text = primary?.text ?? literalText ?? '';
	const sw = hidden ? 0 : styleStroke(style);
	const x = transform.x * PX_PER_PT;
	const y = transform.y * PX_PER_PT;
	const width = transform.w * PX_PER_PT;
	const height = transform.h * PX_PER_PT;
	const foldedNodeIds = [
		...sourceIds.slice(1),
		...(mergedSourceIds ?? []).filter((id) => !sourceIds.includes(id)),
	];
	return {
		kind: 'rect',
		key: `${node.name || 'engine-node'}-${index}`,
		x,
		y,
		width,
		height,
		rx: 0,
		fill: hidden ? 'none' : primary ? nodeFill(primary, index, palette) : colour(index, palette),
		stroke: hidden ? 'none' : strokeFor(sw),
		strokeWidth: sw,
		opacity: hidden ? 1 : nodeOpacity(index, index + 1, style),
		text,
		// Placeholder: `applyEngineFonts` resolves every node's size jointly
		// (equality groups span nodes) once the whole list is collected.
		fontSize: 0,
		textX: x + width / 2,
		textY: y + height / 2,
		nodeId: primary?.id,
		rotation: transform.rotation === 0 ? undefined : transform.rotation,
		presetOverride: node.shape?.type ?? 'roundRect',
		foldedNodeIds: foldedNodeIds.length > 0 ? foldedNodeIds : undefined,
		literalText,
	};
}

/**
 * Every node the engine gives its own visible shape, in document order.
 * `conn`-alg nodes are skipped: a connector's own `arrange` (`layoutTree`'s
 * dedicated final routing pass, `alg-connector.ts`) produces a real box only
 * for its supported "2-D, straight" case, leaving a degenerate zero-size box
 * for a `connRout="bend"` routing (real "Hierarchy"'s own manager-to-report
 * lines) - since `SmartArtLayoutResult.connectors` is separately, and always,
 * discarded downstream (`smartart-interpreter-drawing-bridge.ts`'s own doc
 * comment: PowerPoint reconstructs `dsp:cxn` connector shapes itself from the
 * data-model connections, so this bridge never converts connector geometry),
 * a connector was never meant to reach this rect-shape collector at all; one
 * that does previously failed `isFiniteGeometry` below and declined the
 * WHOLE diagram over a shape nothing downstream would have used anyway.
 */
function collectRenderedNodes(
	root: EngineNode,
	nodeById: Map<string, PptxSmartArtNode>,
	palette: string[],
	style: SmartArtStyle,
): RenderedEngineNode[] {
	const out: RenderedEngineNode[] = [];
	// `moveWith` only ever pairs SIBLINGS (same parent), so the merge is
	// scoped to one node's `children` at a time; `[root]` is a trivial
	// one-element "sibling group" with nothing to merge.
	const visitSiblings = (siblings: EngineNode[]): void => {
		const { extraIdsByTarget, suppressed, carrierByTarget } = computeMoveWithMerge(siblings);
		for (const node of siblings) {
			if (node.alg.type !== 'conn' && !suppressed.has(node)) {
				const mergedIds = extraIdsByTarget.get(node.name);
				const rendered = buildRenderedNode(node, out.length, nodeById, palette, style, mergedIds);
				if (rendered) {
					out.push({ node, rendered, mergedIds, textNode: carrierByTarget.get(node.name) });
				}
			}
			visitSiblings(node.children);
		}
	};
	visitSiblings([root]);
	return out;
}

function isFiniteGeometry(node: RenderedRectNode): boolean {
	return (
		Number.isFinite(node.x) &&
		Number.isFinite(node.y) &&
		Number.isFinite(node.width) &&
		Number.isFinite(node.height) &&
		node.width > 0 &&
		node.height > 0
	);
}

/**
 * Run the per-point engine for `smartArtData` in a `containerBounds.width` x
 * `containerBounds.height` PIXEL frame (this package's standard element unit)
 * and convert its output to the shared `SmartArtLayoutResult` shape.
 * Returns `undefined` when there is no layout definition, the engine cannot
 * parse it, the resolved tree needs an unimplemented algorithm, or the
 * result is not sane geometry - every case the caller should fall back from.
 */
export function runEngineLayout(
	smartArtData: PptxSmartArtData,
	containerBounds: { width: number; height: number },
	nodes: PptxSmartArtNode[],
	palette: string[],
	style: SmartArtStyle,
): SmartArtLayoutResult | undefined {
	const rawXmlText = smartArtData.layoutDefinition?.rawXmlText;
	const widthPt = containerBounds.width * PT_PER_PX;
	const heightPt = containerBounds.height * PT_PER_PX;
	if (!rawXmlText || !(widthPt > 0) || !(heightPt > 0)) {
		return undefined;
	}
	let run: ReturnType<typeof runSmartArtEngine>;
	try {
		run = runSmartArtEngine(smartArtData, rawXmlText, widthPt, heightPt);
	} catch {
		return undefined;
	}
	if (!run || !isFullySupported(run.root)) {
		return undefined;
	}
	const nodeById = new Map(nodes.map((n) => [n.id, n]));
	const collected = collectRenderedNodes(run.root, nodeById, palette, style);
	applyEngineFonts(collected, nodeById, smartArtData.themeMinorFont);
	const rendered = collected.map((entry) => entry.rendered);
	if (rendered.length === 0 || !rendered.every(isFiniteGeometry)) {
		return undefined;
	}
	return {
		nodes: rendered,
		connectors: [],
		shadowFilter: styleShadow(style),
		viewBox: `0 0 ${containerBounds.width} ${containerBounds.height}`,
		family: 'list',
	};
}
