/**
 * Field-of-view <-> CSS perspective-distance math for the camera-preset
 * mapping (framework-agnostic).
 *
 * Split out of `visual-3d-camera.ts` to keep that file under the repo's
 * ~300 LOC guideline once the preset table grew a geometric FOV model on top
 * of its rotation angles; see that module's doc comment for the overall
 * design (reference size, per-preset reference distance, zoom).
 *
 * @module render/visual-3d-camera-fov
 */

/** The on-screen size (px) of the element the camera is projected onto. */
export interface ElementSizePx {
	width: number;
	height: number;
}

/**
 * The pixel size the camera preset table's reference distances were
 * hand-tuned at. Callers that omit an `ElementSizePx` get back the exact
 * legacy distance for a preset; callers that pass the element's actual
 * rendered size get a proportionally re-projected one.
 */
export const REFERENCE_SIZE_PX = 300;

/**
 * Derive the FOV (radians) a reference perspective distance implies at
 * {@link REFERENCE_SIZE_PX}, by inverting `d = (size / 2) / tan(f / 2)`.
 */
export function fovFromRefPx(refPx: number): number {
	return 2 * Math.atan(REFERENCE_SIZE_PX / 2 / refPx);
}

/**
 * Narrow (or widen) an FOV by a camera zoom factor, the way a real lens
 * flattens perspective when zooming in from a fixed position: increasing
 * `zoom` decreases `tan(f/2)` proportionally, which decreases the resulting
 * FOV (a longer effective focal length) and so increases the projected
 * perspective distance. `zoom <= 0` is treated as unset (100%).
 */
export function applyZoomToFov(fovRad: number, zoom: number | undefined): number {
	if (!zoom || zoom <= 0 || zoom === 1) {
		return fovRad;
	}
	return 2 * Math.atan(Math.tan(fovRad / 2) / zoom);
}

/**
 * Project an FOV (radians) onto an on-screen size (px) into a CSS
 * `perspective` distance (px): `d = (size / 2) / tan(f / 2)`.
 */
export function fovToPerspectivePx(fovRad: number, sizePx: number): number {
	return sizePx / 2 / Math.tan(fovRad / 2);
}

/** The larger of an `ElementSizePx`'s two dimensions, or the reference size when omitted. */
export function resolveSizePx(elementSize: ElementSizePx | undefined): number {
	return elementSize ? Math.max(elementSize.width, elementSize.height) : REFERENCE_SIZE_PX;
}
