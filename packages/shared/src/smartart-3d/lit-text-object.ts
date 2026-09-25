/**
 * The label of a lit SmartArt 3D mesh (bevel / scene quick styles): the same
 * canvas-texture plane the flat path draws, tinted by the light rig, and
 * stacked into a solid when the quick style extrudes the text itself
 * (`render/smartart-3d-text-extrusion.ts`).
 *
 * Must not import `three` at runtime (it takes the module as a parameter).
 *
 * @module smartart-3d/lit-text-object
 */
import type * as THREE from 'three';

import type { SmartArt3DLightModel } from '../render/smartart-3d-lighting';
import { smartArt3DTextLayers } from '../render/smartart-3d-text-extrusion';
import type { SmartArt3DMesh, SmartArt3DTextBlock } from '../render/smartart-3d-types';
import type { ThreeModule } from '../three-view/types';
import type { Disposable } from './flat-mesh-object';
import { buildTextBlockTexture } from './text-block-texture';

/**
 * Planes showing `block` at each of `zs` (sharing one texture, geometry and
 * material).
 */
function textPlanes(
	three: ThreeModule,
	mesh: SmartArt3DMesh,
	block: SmartArt3DTextBlock,
	zs: readonly number[],
	light: SmartArt3DLightModel,
	disposables: Disposable[],
): THREE.Mesh[] {
	const built = zs.length > 0 ? buildTextBlockTexture(three, block) : null;
	if (!built) {
		return [];
	}
	const geometry = new three.PlaneGeometry(built.worldWidth, built.worldHeight);
	const material = new three.MeshBasicMaterial({
		map: built.texture,
		transparent: true,
		depthWrite: false,
	});
	// The rig's tint is a linear factor, like the solids' vertex colours.
	material.color.setRGB(light.tint[0], light.tint[1], light.tint[2]);
	disposables.push(built.texture, geometry, material);
	return zs.map((z) => {
		const plane = new three.Mesh(geometry, material);
		// Text blocks carry world positions; the group sits at the mesh position.
		plane.position.set(block.x - mesh.position.x, block.y - mesh.position.y, z - mesh.position.z);
		return plane;
	});
}

/** Add the lit label (flat or extruded) of `mesh` to `group`. */
export function buildLitTextObject(
	three: ThreeModule,
	mesh: SmartArt3DMesh,
	group: THREE.Group,
	light: SmartArt3DLightModel,
	disposables: Disposable[],
): void {
	const block = mesh.textBlock;
	if (!block) {
		return;
	}
	const layers = smartArt3DTextLayers(block);
	const planes = [
		...(layers
			? textPlanes(
					three,
					mesh,
					{ ...block, color: layers.sideColor },
					layers.sideZ,
					light,
					disposables,
				)
			: []),
		...textPlanes(three, mesh, block, [layers?.frontZ ?? block.z], light, disposables),
	];
	for (const plane of planes) {
		group.add(plane);
	}
}
