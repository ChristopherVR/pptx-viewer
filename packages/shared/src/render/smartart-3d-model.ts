/**
 * Three.js SmartArt renderer - pure model builder.
 *
 * Converts the 2D {@link SmartArtLayoutResult} (rect/circle/polygon view-models
 * produced by `computeSmartArtLayout`) into a framework-agnostic, three-agnostic
 * {@link SmartArt3DModel} of extruded meshes + connectors. No `three` import.
 */

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
	SmartArt3DMesh,
	SmartArt3DModel,
	SmartArt3DModelOptions,
} from './smartart-3d-types';
import type { RenderedNode, SmartArtLayoutResult } from './smartart-layout-types';

const DEFAULT_DEPTH_RATIO = 0.35;
const DEFAULT_BEVEL_RATIO = 0.2;

/** Resolve the extrusion depth for a node footprint. */
function resolveDepth(footprint: number, opts: SmartArt3DModelOptions): number {
	if (typeof opts.depth === 'number' && opts.depth > 0) {
		return opts.depth;
	}
	const ratio = opts.depthRatio ?? DEFAULT_DEPTH_RATIO;
	return Math.max(2, footprint * ratio);
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
	const bevel = depth * (opts.bevelRatio ?? DEFAULT_BEVEL_RATIO);

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
		family: layout.family,
		background: options.background,
	};

	return options.spatial ? applySpatialLayout(model) : model;
}
