/**
 * Three.js SmartArt renderer - pure model builder.
 *
 * Converts the 2D {@link SmartArtLayoutResult} (rect/circle/polygon view-models
 * produced by `computeSmartArtLayout`) into a framework-agnostic, three-agnostic
 * {@link SmartArt3DModel} of extruded meshes + connectors. No `three` import.
 */

import type { PptxSmartArtNode } from 'pptx-viewer-core';
import { flattenNodes } from 'pptx-viewer-core';

import {
	boundsOf,
	circleOutline,
	contrastTextColor,
	parsePathPoints,
	parsePolygonPoints,
	parseViewBox,
	roundedRectOutline,
} from './smartart-3d-geom';
import { applySpatialLayout } from './smartart-3d-spatial';
import type {
	Point2,
	SmartArt3DConnector,
	SmartArt3DFamily,
	SmartArt3DMesh,
	SmartArt3DModel,
	SmartArt3DModelOptions,
} from './smartart-3d-types';
import type { LayoutFamily, RenderedNode, SmartArtLayoutResult } from './smartart-layout-types';

/**
 * The 2D engine grew three families (gear / timeline / bending) that the 3D
 * spatial transform has no arrangement for. Each folds onto the family whose
 * spatial treatment it used to receive, so 3D output is unchanged.
 */
const SPATIAL_FAMILY_FALLBACK: Partial<Record<LayoutFamily, SmartArt3DFamily>> = {
	gear: 'radial',
	timeline: 'process',
	bending: 'process',
};

/** Narrow a 2D layout family to the subset the 3D spatial transform handles. */
function spatialFamily(family: LayoutFamily): SmartArt3DFamily {
	return SPATIAL_FAMILY_FALLBACK[family] ?? (family as SmartArt3DFamily);
}

const DEFAULT_DEPTH_RATIO = 0.35;
const DEFAULT_BEVEL_RATIO = 0.2;
/** Maximum fractional swing applied to a varied node's bevel (+/-15%). */
const COHERENT_3D_BEVEL_VARIATION = 0.15;

/** Resolve the extrusion depth for a node footprint. */
function resolveDepth(footprint: number, opts: SmartArt3DModelOptions): number {
	if (typeof opts.depth === 'number' && opts.depth > 0) {
		return opts.depth;
	}
	const ratio = opts.depthRatio ?? DEFAULT_DEPTH_RATIO;
	return Math.max(2, footprint * ratio);
}

/**
 * Deterministic 0..1 hash of a node id (djb2 variant), used to derive a
 * stable per-node bevel variation instead of `Math.random()` so the same
 * deck renders identically every time (and stays snapshot-testable).
 */
function nodeVariationFactor(nodeId: string): number {
	let hash = 5381;
	for (let i = 0; i < nodeId.length; i++) {
		hash = (hash * 33) ^ nodeId.charCodeAt(i);
	}
	return ((hash >>> 0) % 1000) / 1000;
}

/**
 * Bevel multiplier for a node: `1` (no variation) when the node has no id, has
 * opted out via `coherent3DOff`, or the caller supplied no opt-out set at all
 * (pre-existing behaviour); otherwise a deterministic +/-15% swing so
 * identical shapes in a "coherent 3-D" SmartArt style do not render
 * pixel-identical, matching PowerPoint's per-node bevel variation.
 */
function bevelVariationMultiplier(
	nodeId: string | undefined,
	coherent3DOffNodeIds: ReadonlySet<string> | undefined,
): number {
	if (!coherent3DOffNodeIds || nodeId === undefined || coherent3DOffNodeIds.has(nodeId)) {
		return 1;
	}
	const factor = nodeVariationFactor(nodeId) - 0.5; // -0.5..0.5
	return 1 + factor * 2 * COHERENT_3D_BEVEL_VARIATION;
}

/** Build the extruded mesh for a single rendered node, or `null` if empty. */
function meshForNode(
	node: RenderedNode,
	w: number,
	h: number,
	opts: SmartArt3DModelOptions,
): SmartArt3DMesh | null {
	// World transform: layout space is y-down, top-left origin; world is y-up,
	// centred. worldX = x - W/2; worldY = H/2 - y.
	const worldX = (x: number): number => x - w / 2;
	const worldY = (y: number): number => h / 2 - y;

	let outline: Point2[];
	let rounded = false;
	let centerX: number;
	let centerY: number;
	let halfWidth: number;
	let halfHeight: number;

	if (node.kind === 'rect') {
		centerX = node.x + node.width / 2;
		centerY = node.y + node.height / 2;
		halfWidth = node.width / 2;
		halfHeight = node.height / 2;
		outline = roundedRectOutline(node.width, node.height, node.rx);
		rounded = node.rx > 0;
	} else if (node.kind === 'circle') {
		centerX = node.cx;
		centerY = node.cy;
		halfWidth = node.r;
		halfHeight = node.r;
		outline = circleOutline(node.r);
		rounded = true;
	} else {
		const pts = parsePolygonPoints(node.points);
		if (pts.length < 3) {
			return null;
		}
		const b = boundsOf(pts);
		centerX = b.cx;
		centerY = b.cy;
		halfWidth = b.width / 2;
		halfHeight = b.height / 2;
		// Recentre and flip y so the polygon reads upright in world space.
		outline = pts.map((p) => ({ x: p.x - b.cx, y: b.cy - p.y }));
	}

	const footprint = Math.max(2, Math.min(halfWidth, halfHeight) * 2);
	const depth = resolveDepth(footprint, opts);
	const bevel =
		depth *
		(opts.bevelRatio ?? DEFAULT_BEVEL_RATIO) *
		bevelVariationMultiplier(node.nodeId, opts.coherent3DOffNodeIds);

	return {
		id: node.key,
		outline,
		rounded,
		depth,
		bevel,
		fill: node.fill,
		stroke: node.stroke,
		strokeWidth: node.strokeWidth,
		opacity: node.opacity,
		position: { x: worldX(centerX), y: worldY(centerY), z: 0 },
		rotation: { x: 0, y: 0, z: 0 },
		text: node.text,
		textColor: contrastTextColor(node.fill),
		fontSize: node.fontSize,
		halfWidth,
		halfHeight,
	};
}

/**
 * Build the pure 3D model for a SmartArt element from its 2D layout result.
 *
 * @param layout  Output of `computeSmartArtLayout`.
 * @param options Depth/bevel/background tunables.
 */
export function buildSmartArt3DModel(
	layout: SmartArtLayoutResult,
	options: SmartArt3DModelOptions = {},
): SmartArt3DModel {
	const { width: w, height: h } = parseViewBox(layout.viewBox);

	const meshes: SmartArt3DMesh[] = [];
	for (const node of layout.nodes) {
		const mesh = meshForNode(node, w, h, options);
		if (mesh) {
			meshes.push(mesh);
		}
	}

	const connectors: SmartArt3DConnector[] = [];
	for (const conn of layout.connectors) {
		const pts = parsePathPoints(conn.d);
		if (pts.length < 2) {
			continue;
		}
		connectors.push({
			id: conn.key,
			points: pts.map((p) => ({ x: p.x - w / 2, y: h / 2 - p.y, z: 0 })),
			color: '#888888',
			width: 1.5,
		});
	}

	const model: SmartArt3DModel = {
		meshes,
		connectors,
		bounds: { width: w, height: h },
		family: spatialFamily(layout.family),
		background: options.background,
	};

	return options.spatial ? applySpatialLayout(model) : model;
}

/**
 * Collect the ids of nodes (including nested children) that opt out of
 * PowerPoint's "coherent 3-D" per-node bevel variation via
 * `dgm:prSet/@coherent3DOff`. Every binding's 3D SmartArt renderer calls this
 * once from the element's `smartArtData.nodes` and passes the result as
 * {@link SmartArt3DModelOptions.coherent3DOffNodeIds}.
 */
export function collectCoherent3DOffNodeIds(
	nodes: readonly PptxSmartArtNode[],
): ReadonlySet<string> {
	const ids = new Set<string>();
	for (const node of flattenNodes([...nodes])) {
		if (node.coherent3DOff) {
			ids.add(node.id);
		}
	}
	return ids;
}
