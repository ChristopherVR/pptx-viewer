/**
 * `chart-3d-three-loader`: the identical dynamic-import-with-guard pair every
 * interactive three.js chart/SmartArt scene mount function used to define for
 * itself (`three` plus its `OrbitControls` addon are OPTIONAL peer
 * dependencies; a missing one resolves to `null` so the caller falls back to
 * its 2D/no-op sentinel). Extracted so the five near-identical copies
 * (bar/line/area/pie/surface chart3D scenes) become one.
 *
 * @module chart-3d-three-loader
 */
import type * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/** Dynamically load `three`; resolves to `null` when the package is not installed. */
export async function loadChart3DThree(): Promise<typeof THREE | null> {
	try {
		return (await import('three')) as typeof THREE;
	} catch {
		return null;
	}
}

/** Dynamically load the OrbitControls addon; resolves to `null` when unavailable. */
export async function loadChart3DOrbitControls(): Promise<
	(new (camera: THREE.Camera, dom: HTMLElement) => OrbitControls) | null
> {
	try {
		const mod = await import('three/examples/jsm/controls/OrbitControls.js');
		return mod.OrbitControls;
	} catch {
		return null;
	}
}
