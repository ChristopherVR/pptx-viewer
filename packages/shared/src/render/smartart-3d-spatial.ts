/**
 * Three.js SmartArt renderer - spatial (phase 2) layout transforms.
 *
 * Post-processes the flat extruded {@link SmartArt3DModel} (every node at z = 0,
 * facing +z) into a genuine 3D arrangement per layout family, reusing all of the
 * phase-1 styling, text, and footprint work:
 *
 * - `cycle` / `radial`  -> a horizontal carousel ring (nodes on a ring in the XZ
 *   plane, each rotated to face radially outward).
 * - `hierarchy`         -> a layered tree that recedes into -Z by depth, so
 *   levels read as receding planes when the camera tilts/orbits.
 *
 * Families without a spatial form are returned unchanged (flat extruded), so the
 * transform degrades gracefully. Pure; no `three` import.
 */

import type {
	SmartArt3DConnector,
	SmartArt3DMesh,
	SmartArt3DModel,
	Vec3,
} from './smartart-3d-types';

/** Map a centred (x, y-up) point onto a horizontal ring in the XZ plane. */
function ringPoint(x: number, y: number): { pos: Vec3; angle: number } {
	const radius = Math.hypot(x, y);
	// angle measured so the top 2D node (y>0, x=0) maps to the +z front (angle 0).
	const angle = Math.atan2(x, y);
	return {
		pos: { x: radius * Math.sin(angle), y: 0, z: radius * Math.cos(angle) },
		angle,
	};
}

/** Cycle/radial: lift the flat ring of nodes into a 3D carousel. */
function cycleSpatial(model: SmartArt3DModel): SmartArt3DModel {
	const meshes: SmartArt3DMesh[] = model.meshes.map((m) => {
		const { pos, angle } = ringPoint(m.position.x, m.position.y);
		return {
			...m,
			position: pos,
			// Rotate about Y so the front (+z) face points radially outward.
			rotation: { x: 0, y: angle, z: 0 },
		};
	});
	const connectors: SmartArt3DConnector[] = model.connectors.map((c) => ({
		...c,
		points: c.points.map((p) => ringPoint(p.x, p.y).pos),
	}));
	return { ...model, meshes, connectors };
}

/** Hierarchy: push each level back in -Z by its depth so the tree recedes. */
function hierarchySpatial(model: SmartArt3DModel): SmartArt3DModel {
	if (model.meshes.length === 0) {
		return model;
	}
	let yMax = -Infinity;
	let yMin = Infinity;
	for (const m of model.meshes) {
		if (m.position.y > yMax) {
			yMax = m.position.y;
		}
		if (m.position.y < yMin) {
			yMin = m.position.y;
		}
	}
	const span = yMax - yMin || 1;
	// Receding depth proportional to the diagram's vertical extent.
	const depthRange = Math.max(model.bounds.width, model.bounds.height) * 0.6;
	const zForY = (y: number): number => -((yMax - y) / span) * depthRange;

	const meshes: SmartArt3DMesh[] = model.meshes.map((m) => ({
		...m,
		position: { x: m.position.x, y: m.position.y, z: zForY(m.position.y) },
	}));
	const connectors: SmartArt3DConnector[] = model.connectors.map((c) => ({
		...c,
		points: c.points.map((p) => ({ x: p.x, y: p.y, z: zForY(p.y) })),
	}));
	return { ...model, meshes, connectors };
}

/**
 * Apply the spatial arrangement for the model's layout family. Returns the model
 * unchanged when the family has no spatial form.
 */
export function applySpatialLayout(model: SmartArt3DModel): SmartArt3DModel {
	switch (model.family) {
		case 'cycle':
		case 'radial':
			return cycleSpatial(model);
		case 'hierarchy':
			return hierarchySpatial(model);
		default:
			return model;
	}
}
