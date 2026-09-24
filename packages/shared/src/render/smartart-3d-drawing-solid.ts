/**
 * The lit (bevel / scene quick style) half of the cached-drawing SmartArt 3D
 * model: per-shape solids and gradients, plus the diagram's light rig and
 * camera (framework-agnostic, pure).
 *
 * `smartart-3d-drawing-model.ts` builds the flat meshes; this module decorates
 * them when {@link resolveSmartArt3DStylePath} picks `'bevel'` or `'scene'`.
 *
 * @module render/smartart-3d-drawing-solid
 */
import type { PptxSmartArtData, PptxSmartArtDrawingShape } from 'pptx-viewer-core';

import { resolveSmartArt3DCamera } from './smartart-3d-scene-camera';
import { resolveSmartArt3DSolid } from './smartart-3d-solid';
import type {
	SmartArt3DCamera,
	SmartArt3DGradient,
	SmartArt3DLighting,
} from './smartart-3d-solid-types';
import type { Point2, SmartArt3DMesh, SmartArt3DStyleCategory } from './smartart-3d-types';
import type { Rgb } from './smartart-3d-vertex-shading';
import { hexToRgb } from './smartart-3d-vertex-shading';
import type { RenderedShape } from './smartart-drawing';

const DEG_PER_UNIT = 60000;

function percent(value: string | undefined, fallback: number): number {
	const parsed = value === undefined ? Number.NaN : Number.parseFloat(value);
	return Number.isFinite(parsed) ? parsed / 100 : fallback;
}

/**
 * The shape's gradient in mesh-local space, or `undefined` for a plain fill.
 *
 * @param toLocal - maps a viewBox point (y-down, before the shape's own
 *   rotation / flip) to mesh-local space (y-up, rotation applied).
 */
export function buildSmartArt3DGradient(
	rendered: RenderedShape,
	toLocal: (p: Point2) => Point2,
): SmartArt3DGradient | undefined {
	const gradient = rendered.gradient;
	if (!gradient || gradient.stops.length === 0) {
		return undefined;
	}
	const at = (fx: number, fy: number): Point2 =>
		toLocal({ x: rendered.x + fx * rendered.width, y: rendered.y + fy * rendered.height });
	const stops = gradient.stops.map((stop) => ({
		offset: Math.max(0, Math.min(1, percent(stop.offset, 0))),
		color: stop.color,
	}));
	if (gradient.kind === 'radial') {
		const cx = percent(gradient.cx, 0.5);
		const cy = percent(gradient.cy, 0.5);
		const r = percent(gradient.r, 0.5);
		return { kind: 'radial', from: at(cx, cy), to: at(cx + r, cy), stops };
	}
	return {
		kind: 'linear',
		from: at(percent(gradient.x1, 0), percent(gradient.y1, 0)),
		to: at(percent(gradient.x2, 1), percent(gradient.y2, 0)),
		stops,
	};
}

/** Where a mesh-local point falls along a gradient, 0..1. */
export function smartArt3DGradientCoordinate(p: Point2, gradient: SmartArt3DGradient): number {
	const dx = gradient.to.x - gradient.from.x;
	const dy = gradient.to.y - gradient.from.y;
	const lengthSq = dx * dx + dy * dy;
	if (lengthSq <= 0) {
		return 0;
	}
	const u =
		gradient.kind === 'radial'
			? Math.hypot(p.x - gradient.from.x, p.y - gradient.from.y) / Math.sqrt(lengthSq)
			: ((p.x - gradient.from.x) * dx + (p.y - gradient.from.y) * dy) / lengthSq;
	return Math.max(0, Math.min(1, u));
}

/** The sRGB colour a gradient paints at a mesh-local point (stops interpolated in sRGB, as SVG does). */
export function smartArt3DGradientColor(gradient: SmartArt3DGradient, p: Point2): Rgb {
	const u = smartArt3DGradientCoordinate(p, gradient);
	const stops = gradient.stops;
	if (u <= stops[0].offset) {
		return hexToRgb(stops[0].color);
	}
	for (let i = 1; i < stops.length; i++) {
		const b = stops[i];
		if (u <= b.offset) {
			const a = stops[i - 1];
			const span = b.offset - a.offset;
			const f = span > 0 ? (u - a.offset) / span : 1;
			const ca = hexToRgb(a.color);
			const cb = hexToRgb(b.color);
			return [
				ca[0] + (cb[0] - ca[0]) * f,
				ca[1] + (cb[1] - ca[1]) * f,
				ca[2] + (cb[2] - ca[2]) * f,
			];
		}
	}
	return hexToRgb(stops[stops.length - 1].color);
}

/** Give a flat mesh its lit solid and gradient, from its cached shape. */
export function decorateSmartArt3DMesh(
	mesh: SmartArt3DMesh,
	shape: PptxSmartArtDrawingShape,
	rendered: RenderedShape,
	toLocal: (p: Point2) => Point2,
): void {
	mesh.flat = false;
	const solid = resolveSmartArt3DSolid(
		shape.shape3d,
		Math.min(rendered.width, rendered.height) / 2,
	);
	if (solid) {
		mesh.solid = solid;
	}
	const gradient = buildSmartArt3DGradient(rendered, toLocal);
	if (gradient) {
		mesh.gradient = gradient;
	}
}

/** The light rig and camera for a lit diagram. */
export function resolveSmartArt3DSceneSetup(
	data: PptxSmartArtData,
	category: SmartArt3DStyleCategory,
): { lighting?: SmartArt3DLighting; camera?: SmartArt3DCamera } {
	if (category === 'flat') {
		return {};
	}
	const diagramScene = data.quickStyle?.scene3d;
	const rigScene =
		category === 'bevel'
			? (data.drawingShapes?.find((s) => s.scene3d?.lightRigType)?.scene3d ?? diagramScene)
			: diagramScene;
	const lighting: SmartArt3DLighting = {
		rig: rigScene?.lightRigType ?? 'threePt',
		direction: rigScene?.lightRigDirection ?? 't',
		revDeg: (rigScene?.lightRigRotZ ?? 0) / DEG_PER_UNIT,
	};
	const camera = category === 'scene' ? resolveSmartArt3DCamera(diagramScene) : undefined;
	return { lighting, ...(camera ? { camera } : {}) };
}
