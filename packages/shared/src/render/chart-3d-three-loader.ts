/**
 * `chart-3d-three-loader`: the guarded dynamic import of `three` (an OPTIONAL
 * peer dependency; a missing one resolves to `null`). `<pptx-three-view>`'s controller
 * (`three-view/view-controller.ts`) is the one caller: a `null` `three` puts
 * the view in its `unavailable` state, showing the slotted 2D fallback.
 *
 * @module chart-3d-three-loader
 */
import type * as THREE from 'three';

/** Dynamically load `three`; resolves to `null` when the package is not installed. */
export async function loadChart3DThree(): Promise<typeof THREE | null> {
	try {
		return (await import('three')) as typeof THREE;
	} catch {
		return null;
	}
}
