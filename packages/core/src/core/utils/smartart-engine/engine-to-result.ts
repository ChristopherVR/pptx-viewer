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
 * this engine does not implement yet (`snake`/`cycle`/`pyra`/`hierRoot`/
 * `hierChild`): the registry (`registry.ts`) silently substitutes
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
import type { EngineNode } from './engine-node';
import { shapeTransform } from './shape-transform';
import { resolveEngineFontSizePt } from './text-fit';

/** `dgm:alg/@type` values this engine executes (`registry.ts`). */
const SUPPORTED_ALGS = new Set(['composite', 'lin', 'conn', 'sp', 'tx']);

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

/** Data-model nodes this rendered point presents text for, in `presOf` order. */
function sourceIdsOf(node: EngineNode): string[] {
	const ids: string[] = [];
	for (const point of node.presOf) {
		if (point.source && !ids.includes(point.source.id)) {
			ids.push(point.source.id);
		}
	}
	return ids;
}

function buildRenderedNode(
	node: EngineNode,
	index: number,
	nodeById: Map<string, PptxSmartArtNode>,
	palette: string[],
	style: SmartArtStyle,
): RenderedRectNode | undefined {
	const transform = shapeTransform(node);
	if (!transform) {
		return undefined;
	}
	const sourceIds = sourceIdsOf(node);
	const primary = sourceIds.length > 0 ? nodeById.get(sourceIds[0]) : undefined;
	const text = primary?.text ?? '';
	const fontSizePt = resolveEngineFontSizePt(node, text);
	const sw = styleStroke(style);
	const x = transform.x * PX_PER_PT;
	const y = transform.y * PX_PER_PT;
	const width = transform.w * PX_PER_PT;
	const height = transform.h * PX_PER_PT;
	return {
		kind: 'rect',
		key: `${node.name || 'engine-node'}-${index}`,
		x,
		y,
		width,
		height,
		rx: 0,
		fill: primary ? nodeFill(primary, index, palette) : colour(index, palette),
		stroke: strokeFor(sw),
		strokeWidth: sw,
		opacity: nodeOpacity(index, index + 1, style),
		text,
		fontSize: fontSizePt * PX_PER_PT,
		textX: x + width / 2,
		textY: y + height / 2,
		nodeId: primary?.id,
		rotation: transform.rotation === 0 ? undefined : transform.rotation,
		presetOverride: node.shape?.type ?? 'roundRect',
		foldedNodeIds: sourceIds.length > 1 ? sourceIds.slice(1) : undefined,
	};
}

/** Every node the engine gives its own visible shape, in document order. */
function collectRenderedNodes(
	root: EngineNode,
	nodeById: Map<string, PptxSmartArtNode>,
	palette: string[],
	style: SmartArtStyle,
): RenderedRectNode[] {
	const out: RenderedRectNode[] = [];
	const visit = (node: EngineNode): void => {
		if (node.shape && !node.shape.hideGeom && node.box) {
			const rendered = buildRenderedNode(node, out.length, nodeById, palette, style);
			if (rendered) {
				out.push(rendered);
			}
		}
		node.children.forEach(visit);
	};
	visit(root);
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
	const rendered = collectRenderedNodes(run.root, nodeById, palette, style);
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
