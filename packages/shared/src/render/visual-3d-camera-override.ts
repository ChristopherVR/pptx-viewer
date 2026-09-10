/**
 * Resolve an explicit `a:camera/a:rot`/`@fov`/`@zoom` override into a
 * {@link CameraTransform} (framework-agnostic).
 *
 * Split out of `visual-3d-camera.ts`'s `getCameraTransform` to keep that file
 * under the repo's ~300 LOC guideline; see `visual-3d-camera-parametric.ts`'s
 * module doc comment for the actual camera model and its COM validation.
 *
 * @module render/visual-3d-camera-override
 */

import type { CameraTransform, Scene3dParams } from './visual-3d-camera';
import { applyZoomToFov, fovFromRefPx, REFERENCE_SIZE_PX } from './visual-3d-camera-fov';
import type { ElementSizePx } from './visual-3d-camera-fov';
import { homographyToMatrix3d } from './visual-3d-camera-homography';
import {
	computeParametricCameraHomography,
	sixtyThousandthsDegToRad,
} from './visual-3d-camera-parametric';
import { DEFAULT_CUSTOM_REF_PX } from './visual-3d-camera-presets';
import { panelSidesFromHomography } from './visual-3d-panel-sides';

/** The one preset field this module needs: its reference perspective distance, when it has one. */
export interface ExplicitOverridePresetHint {
	perspectiveRefPx?: number;
}

/**
 * Build the `matrix3d` transform for a scene3d that carries an explicit
 * camera override (`hasExplicitOverride` is true at the call site). Uses the
 * SAME kind of exact homography the preset table stores, via
 * `visual-3d-camera-parametric`'s general camera function, instead of the
 * legacy `rotateX`/`rotateY` + centred `perspective()` approximation this
 * replaces.
 *
 * `panelHintRotateX`/`panelHintRotateY` are the preset-default fallback hints
 * (used only if the override carries no rotation on that axis).
 */
export function resolveExplicitOverrideCameraTransform(
	scene3d: Scene3dParams,
	preset: ExplicitOverridePresetHint | undefined,
	elementSize: ElementSizePx | undefined,
	panelHintRotateX: number,
	panelHintRotateY: number,
): CameraTransform {
	const explicitOverrideFovRad =
		scene3d.cameraFieldOfView && scene3d.cameraFieldOfView > 0
			? (scene3d.cameraFieldOfView / 60000) * (Math.PI / 180)
			: preset?.perspectiveRefPx !== undefined
				? fovFromRefPx(preset.perspectiveRefPx)
				: fovFromRefPx(DEFAULT_CUSTOM_REF_PX);
	const hUnit = computeParametricCameraHomography({
		latRad: sixtyThousandthsDegToRad(scene3d.cameraRotX),
		lonRad: sixtyThousandthsDegToRad(scene3d.cameraRotY),
		revRad: sixtyThousandthsDegToRad(scene3d.cameraRotZ),
		fovRad: applyZoomToFov(explicitOverrideFovRad, scene3d.cameraZoom),
	});
	// A freshly-computed homography is never `===` the preset table's
	// singleton identity constant, so a near-flat override simply emits a
	// literal identity `matrix3d(...)` rather than omitting the transform -
	// visually/functionally a no-op either way.
	const panelSides = panelSidesFromHomography(hUnit);
	const size = elementSize ?? { width: REFERENCE_SIZE_PX, height: REFERENCE_SIZE_PX };
	// The rotateX/rotateY hint fields (panel-visibility fallback only; the
	// actual transform is `matrix3d`) reflect the OVERRIDE's own angle, not
	// the untouched preset default, matching the legacy conversion (X negated
	// to match CSS conventions).
	return {
		matrix3d: homographyToMatrix3d(hUnit, size.width, size.height),
		transformOrigin: '0 0',
		rotateX: scene3d.cameraRotX ? -(scene3d.cameraRotX / 60000) : panelHintRotateX,
		rotateY: scene3d.cameraRotY ? scene3d.cameraRotY / 60000 : panelHintRotateY,
		rotateZ: 0,
		panelSides,
	};
}
