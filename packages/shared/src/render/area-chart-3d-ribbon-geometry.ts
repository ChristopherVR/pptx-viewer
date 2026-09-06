/**
 * Builds the translucent ribbon `THREE.BufferGeometry` an area3D series
 * fills from its path down to its baseline. Extracted out of
 * `area-chart-3d-scene.ts` to keep that file under the repo's per-file LOC
 * budget.
 *
 * @module area-chart-3d-ribbon-geometry
 */
import type * as THREE from 'three';

import type { CartesianLine3DSceneOptions } from './cartesian-line-chart-3d-data';
import { buildAreaRibbonTriangles } from './cartesian-line-chart-3d-layout';

/** Build a ribbon `BufferGeometry` for one series' area fill, or `null` when it has < 2 vertices. */
export function buildAreaRibbonGeometry(
	three: typeof THREE,
	path: CartesianLine3DSceneOptions['series'][number],
): THREE.BufferGeometry | null {
	const triangles = buildAreaRibbonTriangles(path);
	if (triangles.length === 0) {
		return null;
	}
	const geometry = new three.BufferGeometry();
	geometry.setAttribute('position', new three.Float32BufferAttribute(triangles, 3));
	geometry.computeVertexNormals();
	return geometry;
}
