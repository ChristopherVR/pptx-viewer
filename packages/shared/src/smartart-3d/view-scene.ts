/**
 * `<pptx-three-view>` scene module for 3D SmartArt.
 *
 * Flat quick styles (Simple Fill, White Outline, Subtle, Moderate, Intense):
 * every mesh is a zero-depth `ShapeGeometry` face, unlit (`MeshBasicMaterial`),
 * under a fixed orthographic camera framing the diagram's own viewBox
 * (`model.bounds`) - the same geometry/fills/text the 2D SVG renderer draws,
 * built by `render/smartart-3d-drawing-model.ts`.
 *
 * Bevel and scene quick styles (`model.styleCategory` `'bevel'`/`'scene'`):
 * each mesh becomes a lit solid (`lit-mesh-object.ts`: bevel bands,
 * extrusion, contour, per-vertex shading from the model's light rig). A scene
 * style also turns the whole diagram by its quick-style camera
 * (`model.camera`, `view-camera.ts`).
 *
 * The camera is fixed (no orbit): PowerPoint never turns a SmartArt under the
 * pointer, and dragging the element to move it must not rotate the diagram.
 *
 * Must not import `three` at runtime (use `ctx.three`): this module is
 * reachable from the main barrel through the scene registry.
 *
 * @module smartart-3d/view-scene
 */

import { resolveSmartArt3DLightModel } from '../render/smartart-3d-lighting';
import { smartArt3DCameraMatrix, smartArt3DEyeInDiagram } from '../render/smartart-3d-scene-camera';
import type { SmartArt3DModel } from '../render/smartart-3d-types';
import type { ThreeViewContext, ThreeViewScene } from '../three-view/types';
import type { Disposable } from './flat-mesh-object';
import { buildFlatMeshObject } from './flat-mesh-object';
import { buildLitMeshObject } from './lit-mesh-object';
import { buildSmartArtViewCamera, fitSmartArtViewCamera } from './view-camera';
import { frameSmartArtOverflow } from './view-overflow';

export async function mountSmartArt3DView(
	model: SmartArt3DModel,
	ctx: ThreeViewContext,
): Promise<ThreeViewScene> {
	const { three } = ctx;
	const scene = new three.Scene();
	if (model.background) {
		scene.background = new three.Color(model.background);
	}

	const disposables: Disposable[] = [];
	const lit = model.styleCategory === 'bevel' || model.styleCategory === 'scene';
	const view = model.camera ? smartArt3DCameraMatrix(model.camera) : undefined;
	const eye = model.camera ? smartArt3DEyeInDiagram(model.camera) : undefined;
	const root = new three.Group();
	if (view) {
		root.matrixAutoUpdate = false;
		root.matrix.set(
			view[0],
			view[1],
			view[2],
			0,
			view[3],
			view[4],
			view[5],
			0,
			view[6],
			view[7],
			view[8],
			0,
			0,
			0,
			0,
			1,
		);
	}
	scene.add(root);
	for (const mesh of model.meshes) {
		const built = lit
			? buildLitMeshObject(
					three,
					mesh,
					resolveSmartArt3DLightModel(model.lighting, mesh.solid?.material, eye !== undefined),
					eye,
				)
			: buildFlatMeshObject(three, mesh);
		root.add(built.group);
		disposables.push(...built.disposables);
	}

	const camera = buildSmartArtViewCamera(three, model.bounds, model.camera, ctx.size);
	// A turned diagram draws past its box as PowerPoint does (view-overflow.ts).
	let overflow = frameSmartArtOverflow(three, root, camera, ctx.size, Boolean(model.camera));

	return {
		render(renderer) {
			renderer.render(scene, camera);
		},
		resize(size) {
			fitSmartArtViewCamera(camera, model.bounds, size);
			overflow = frameSmartArtOverflow(three, root, camera, size, Boolean(model.camera));
		},
		overflow() {
			return overflow;
		},
		dispose() {
			for (const d of disposables) {
				d.dispose();
			}
		},
	};
}
