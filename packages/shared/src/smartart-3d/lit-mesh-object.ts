/**
 * Build the three.js `Object3D` for one lit `SmartArt3DMesh` (bevel / scene
 * quick styles): the solid from `render/smartart-3d-solid-geometry.ts`,
 * shaded per vertex by `render/smartart-3d-vertex-shading.ts`, plus the same
 * stroke and text label the flat path draws.
 *
 * Must not import `three` at runtime (it takes the module as a parameter).
 *
 * @module smartart-3d/lit-mesh-object
 */
import type * as THREE from 'three';

import {
	smartArt3DGradientColor,
	smartArt3DGradientCoordinate,
} from '../render/smartart-3d-drawing-solid';
import type { SmartArt3DLightModel } from '../render/smartart-3d-lighting';
import { toCcwRing } from '../render/smartart-3d-ring';
import type { SolidCap, SolidTriangles } from '../render/smartart-3d-solid-geometry';
import { buildSmartArt3DSolidGeometry } from '../render/smartart-3d-solid-geometry';
import type { SmartArt3DGradient } from '../render/smartart-3d-solid-types';
import {
	isSmartArt3DGlassMaterial,
	orientSmartArt3DTriangles,
	smartArt3DGlassLightModel,
	smartArt3DVertexAlphas,
} from '../render/smartart-3d-translucency';
import type { Point2, SmartArt3DMesh, Vec3 } from '../render/smartart-3d-types';
import type { Rgb } from '../render/smartart-3d-vertex-shading';
import { hexToRgb, shadeSmartArt3DVertices } from '../render/smartart-3d-vertex-shading';
import type { ThreeModule } from '../three-view/types';
import type { Disposable, MeshObject } from './flat-mesh-object';
import { buildStrokeLines } from './flat-mesh-object';
import { buildLitTextObject } from './lit-text-object';

/** Render order of a label within its mesh group (after body, sides, contour). */
const LABEL_RENDER_ORDER = 3;

/** Width of the 1D gradient lookup texture. */
const GRADIENT_TEXELS = 256;

/** Append a triangulated planar cap to a triangle list. */
function appendCap(three: ThreeModule, out: SolidTriangles, cap: SolidCap): void {
	if (cap.ring.length < 3) {
		return;
	}
	const contour = cap.ring.map((p) => new three.Vector2(p.x, p.y));
	const holes = cap.holes.map((hole) => hole.map((p) => new three.Vector2(p.x, p.y)));
	const all = [...contour, ...holes.flat()];
	for (const face of three.ShapeUtils.triangulateShape(contour, holes)) {
		for (const index of face) {
			const p = all[index];
			out.positions.push(p.x, p.y, cap.z);
			out.normals.push(0, 0, cap.facing);
		}
	}
}

function buildGradientTexture(
	three: ThreeModule,
	gradient: SmartArt3DGradient,
): THREE.CanvasTexture | null {
	if (typeof document === 'undefined') {
		return null;
	}
	const canvas = document.createElement('canvas');
	canvas.width = GRADIENT_TEXELS;
	canvas.height = 1;
	const ctx = canvas.getContext('2d');
	if (!ctx) {
		return null;
	}
	const paint = ctx.createLinearGradient(0, 0, GRADIENT_TEXELS, 0);
	for (const stop of gradient.stops) {
		paint.addColorStop(stop.offset, stop.color);
	}
	ctx.fillStyle = paint;
	ctx.fillRect(0, 0, GRADIENT_TEXELS, 1);
	const texture = new three.CanvasTexture(canvas);
	texture.colorSpace = three.SRGBColorSpace;
	texture.wrapS = three.ClampToEdgeWrapping;
	texture.needsUpdate = true;
	return texture;
}

interface PaintedPart {
	triangles: SolidTriangles;
	color: string;
	gradient?: SmartArt3DGradient;
	/** The mesh's fill opacity (a Venn circle's 50% alpha); 1 when opaque. */
	opacity: number;
	/** `a:sp3d/@prstMaterial` (a `clear` glass varies its alpha per vertex). */
	material?: string;
}

/** Interleave linear RGB factors with per-vertex alphas (RGBA). */
function withAlpha(rgb: Float32Array, alpha: Float32Array): Float32Array {
	const out = new Float32Array(alpha.length * 4);
	for (let v = 0; v < alpha.length; v++) {
		out.set(rgb.subarray(v * 3, v * 3 + 3), v * 4);
		out[v * 4 + 3] = alpha[v];
	}
	return out;
}

function buildPart(
	three: ThreeModule,
	part: PaintedPart,
	light: SmartArt3DLightModel,
	eye: Vec3 | undefined,
	disposables: Disposable[],
): THREE.Mesh | null {
	if (part.triangles.positions.length === 0) {
		return null;
	}
	const glass = isSmartArt3DGlassMaterial(part.material);
	// A translucent solid is blended once: only its surfaces facing the camera
	// are drawn (render/smartart-3d-translucency.ts).
	const translucent = part.opacity < 1 || glass;
	if (translucent) {
		orientSmartArt3DTriangles(part.triangles);
	}
	const { positions, normals } = part.triangles;
	const gradient = part.gradient;
	const flatColor = hexToRgb(part.color);
	const baseAt = (p: Point2): Rgb => (gradient ? smartArt3DGradientColor(gradient, p) : flatColor);
	const geometry = new three.BufferGeometry();
	geometry.setAttribute('position', new three.Float32BufferAttribute(positions, 3));
	const shading = shadeSmartArt3DVertices(
		positions,
		normals,
		baseAt,
		glass ? smartArt3DGlassLightModel(light) : light,
		eye,
	);
	geometry.setAttribute(
		'color',
		glass
			? new three.BufferAttribute(
					withAlpha(
						shading,
						smartArt3DVertexAlphas(positions, normals, part.material, part.opacity, eye),
					),
					4,
				)
			: new three.BufferAttribute(shading, 3),
	);
	const texture = gradient ? buildGradientTexture(three, gradient) : null;
	if (gradient && texture) {
		const uv: number[] = [];
		for (let i = 0; i < positions.length; i += 3) {
			uv.push(
				smartArt3DGradientCoordinate({ x: positions[i], y: positions[i + 1] }, gradient),
				0.5,
			);
		}
		geometry.setAttribute('uv', new three.Float32BufferAttribute(uv, 2));
		disposables.push(texture);
	}
	const material = new three.MeshBasicMaterial({
		color: texture ? '#ffffff' : part.color,
		map: texture,
		vertexColors: true,
		side: translucent ? three.FrontSide : three.DoubleSide,
		transparent: translucent,
		// A glass carries its alpha per vertex; the material then stays at 1.
		opacity: glass ? 1 : part.opacity,
		// Translucent solids are layered in paint order, like PowerPoint's
		// per-shape compositing, rather than hiding one another.
		depthWrite: !translucent,
	});
	disposables.push(geometry, material);
	return new three.Mesh(geometry, material);
}

/**
 * Build the complete `Object3D` for one lit mesh (in diagram space; a scene
 * camera's rotation is applied by the caller's parent group).
 *
 * @param eye - a perspective scene camera's position in diagram space.
 */
export function buildLitMeshObject(
	three: ThreeModule,
	mesh: SmartArt3DMesh,
	light: SmartArt3DLightModel,
	eye?: Vec3,
): MeshObject {
	const localEye = eye
		? { x: eye.x - mesh.position.x, y: eye.y - mesh.position.y, z: eye.z - mesh.position.z }
		: undefined;
	const disposables: Disposable[] = [];
	const group = new three.Group();
	group.position.set(mesh.position.x, mesh.position.y, mesh.position.z);

	if (!mesh.fillNone && mesh.outline.length >= 3) {
		const holes = mesh.holes ?? [];
		const geometry = mesh.solid
			? buildSmartArt3DSolidGeometry(mesh.outline, holes, mesh.solid)
			: undefined;
		const body: SolidTriangles = geometry?.body ?? { positions: [], normals: [] };
		appendCap(
			three,
			body,
			geometry?.frontCap ?? { ring: toCcwRing(mesh.outline), holes, z: 0, facing: 1 },
		);
		const sides: SolidTriangles = geometry?.sides ?? { positions: [], normals: [] };
		if (geometry?.backCap) {
			appendCap(three, sides, geometry.backCap);
		}
		const contour: SolidTriangles = { positions: [], normals: [] };
		for (const cap of geometry?.contourCaps ?? []) {
			appendCap(three, contour, cap);
		}
		const material = mesh.solid?.material;
		const parts: PaintedPart[] = [
			{
				triangles: body,
				color: mesh.fill,
				gradient: mesh.gradient,
				opacity: mesh.opacity,
				material,
			},
			{
				triangles: sides,
				color: mesh.solid?.extrusionColor ?? mesh.fill,
				opacity: mesh.opacity,
				material,
			},
			{
				triangles: contour,
				color: mesh.solid?.contourColor ?? mesh.fill,
				opacity: mesh.opacity,
			},
		];
		parts.forEach((part, order) => {
			const built = buildPart(three, part, light, localEye, disposables);
			if (built) {
				built.renderOrder = order;
				group.add(built);
			}
		});
	}
	for (const line of buildStrokeLines(three, mesh, disposables)) {
		group.add(line);
	}
	const labelsFrom = group.children.length;
	buildLitTextObject(three, mesh, group, light, disposables);
	for (const label of group.children.slice(labelsFrom)) {
		// After the solid's own surfaces (see the parts' render order).
		label.renderOrder = LABEL_RENDER_ORDER;
	}
	return { group, disposables };
}
