/**
 * Build the three.js `Object3D` for one flat `SmartArt3DMesh` (fill + stroke
 * outline + text label), for `view-scene.ts`.
 *
 * @module smartart-3d/flat-mesh-object
 */
import type * as THREE from 'three';

import type { SmartArt3DMesh } from '../render/smartart-3d-types';
import type { ThreeModule } from '../three-view/types';
import { buildTextBlockTexture } from './text-block-texture';

/** Anything the scene must call `.dispose()` on when unmounted. */
export interface Disposable {
	dispose: () => void;
}

/** The built pieces for one mesh: the group to add to the scene, plus disposables. */
export interface MeshObject {
	group: THREE.Group;
	disposables: Disposable[];
}

/** z-lift of the stroke outline above its fill, so the two don't z-fight. */
const STROKE_Z_LIFT = 0.05;

function buildShape(three: ThreeModule, mesh: SmartArt3DMesh): THREE.Shape {
	const shape = new three.Shape(mesh.outline.map((p) => new three.Vector2(p.x, p.y)));
	for (const hole of mesh.holes ?? []) {
		shape.holes.push(new three.Path(hole.map((p) => new three.Vector2(p.x, p.y))));
	}
	return shape;
}

/** Build the fill mesh for a flat (zero-depth) `SmartArt3DMesh`. */
function buildFlatFill(
	three: ThreeModule,
	mesh: SmartArt3DMesh,
	shape: THREE.Shape,
	disposables: Disposable[],
): THREE.Mesh | null {
	if (mesh.fillNone) {
		return null;
	}
	const geometry = new three.ShapeGeometry(shape);
	const material = new three.MeshBasicMaterial({
		color: mesh.fill,
		side: three.DoubleSide,
		transparent: mesh.opacity < 1,
		opacity: mesh.opacity,
	});
	disposables.push(geometry, material);
	return new three.Mesh(geometry, material);
}

/** Build the stroke outline (and hole outlines) as line loops. */
function buildStrokeLines(
	three: ThreeModule,
	mesh: SmartArt3DMesh,
	disposables: Disposable[],
): THREE.LineLoop[] {
	if (mesh.strokeWidth <= 0 || mesh.stroke === 'transparent') {
		return [];
	}
	const material = new three.LineBasicMaterial({ color: mesh.stroke });
	disposables.push(material);
	const loops = [mesh.outline, ...(mesh.holes ?? [])];
	return loops.map((loop) => {
		const geometry = new three.BufferGeometry().setFromPoints(
			loop.map((p) => new three.Vector3(p.x, p.y, STROKE_Z_LIFT)),
		);
		disposables.push(geometry);
		return new three.LineLoop(geometry, material);
	});
}

/** Build the text label plane, or `null` when the mesh has no text. */
function buildTextPlane(
	three: ThreeModule,
	mesh: SmartArt3DMesh,
	group: THREE.Group,
	disposables: Disposable[],
): void {
	if (!mesh.textBlock) {
		return;
	}
	const built = buildTextBlockTexture(three, mesh.textBlock);
	if (!built) {
		return;
	}
	disposables.push(built.texture);
	const geometry = new three.PlaneGeometry(built.worldWidth, built.worldHeight);
	const material = new three.MeshBasicMaterial({
		map: built.texture,
		transparent: true,
		depthWrite: false,
	});
	disposables.push(geometry, material);
	const plane = new three.Mesh(geometry, material);
	// `textBlock` carries its own world position (already includes the
	// shape's rotation applied to its centre); the group itself is placed at
	// the shape's own centre, so offset back to absolute world space here.
	plane.position.set(
		mesh.textBlock.x - mesh.position.x,
		mesh.textBlock.y - mesh.position.y,
		mesh.textBlock.z - mesh.position.z,
	);
	group.add(plane);
}

/** Build the complete `Object3D` for one flat mesh. */
export function buildFlatMeshObject(three: ThreeModule, mesh: SmartArt3DMesh): MeshObject {
	const disposables: Disposable[] = [];
	const group = new three.Group();
	group.position.set(mesh.position.x, mesh.position.y, mesh.position.z);

	const shape = buildShape(three, mesh);
	const fill = buildFlatFill(three, mesh, shape, disposables);
	if (fill) {
		group.add(fill);
	}
	for (const line of buildStrokeLines(three, mesh, disposables)) {
		group.add(line);
	}
	buildTextPlane(three, mesh, group, disposables);

	return { group, disposables };
}
