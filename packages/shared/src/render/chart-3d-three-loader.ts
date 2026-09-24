/**
 * `chart-3d-three-loader`: the guarded dynamic imports of `three` and its
 * `OrbitControls` addon (both OPTIONAL peer dependencies; a missing one
 * resolves to `null`). `<pptx-three-view>`'s controller
 * (`three-view/view-controller.ts`) is the one caller: a `null` `three` puts
 * the view in its `unavailable` state, showing the slotted 2D fallback.
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
