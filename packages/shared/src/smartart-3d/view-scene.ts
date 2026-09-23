/**
 * `<pptx-three-view>` scene module for 3D SmartArt.
 *
 * PLACEHOLDER (host smoke test): draws each node as a flat extruded block
 * under an orthographic camera. The SmartArt track replaces this with the
 * PowerPoint-parity scene (whole-diagram `dgm:scene3d` camera, per-shape
 * `sp3d`). It must not import `three` at runtime (use `ctx.three`): this
 * module is reachable from the main barrel through the scene registry.
 *
 * @module smartart-3d/view-scene
 */
import type * as THREE from 'three';

import type { SmartArt3DModel } from '../render/smartart-3d-types';
import type { ThreeViewContext, ThreeViewScene, ThreeViewSize } from '../three-view/types';

export async function mountSmartArt3DView(
	model: SmartArt3DModel,
	ctx: ThreeViewContext,
): Promise<ThreeViewScene> {
	const { three } = ctx;
	const scene = new three.Scene();
	scene.add(new three.AmbientLight(0xffffff, 1.2));
	const key = new three.DirectionalLight(0xffffff, 1.4);
	key.position.set(-0.3, 0.6, 1);
	scene.add(key);
	const disposables: Array<{ dispose: () => void }> = [];
	for (const m of model.meshes) {
		const shape = new three.Shape(m.outline.map((p) => new three.Vector2(p.x, p.y)));
		const geo = new three.ExtrudeGeometry(shape, { depth: 6, bevelEnabled: false });
		const mat = new three.MeshStandardMaterial({ color: m.fill, roughness: 0.8 });
		const mesh = new three.Mesh(geo, mat);
		mesh.position.set(m.position.x, m.position.y, m.position.z);
		scene.add(mesh);
		disposables.push(geo, mat);
	}
	const w = model.bounds.width;
	const h = model.bounds.height;
	const camera: THREE.OrthographicCamera = new three.OrthographicCamera(
		-w / 2,
		w / 2,
		h / 2,
		-h / 2,
		-1000,
		1000,
	);
	camera.position.set(0, 0, 500);
	const fit = (size: ThreeViewSize): void => {
		const aspect = size.width / Math.max(1, size.height);
		const halfH = Math.max(h / 2, w / 2 / aspect);
		camera.top = halfH;
		camera.bottom = -halfH;
		camera.left = -halfH * aspect;
		camera.right = halfH * aspect;
		camera.updateProjectionMatrix();
	};
	fit(ctx.size);
	return {
		render(renderer) {
			renderer.render(scene, camera);
		},
		resize: fit,
		dispose() {
			for (const d of disposables) {
				d.dispose();
			}
		},
	};
}
