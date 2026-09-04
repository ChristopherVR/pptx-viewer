/**
 * Camera-preset → CSS perspective/rotation mapping (framework-agnostic).
 *
 * Resolves OOXML camera presets and explicit rotation angles into CSS
 * `perspective` + `rotateX/Y/Z`. Shared by every binding's 3D layer.
 *
 * @module render/visual-3d-camera
 */

/**
 * Structural subset of `Pptx3DScene` consumed by the camera mapping. Declared
 * locally (rather than importing `Pptx3DScene`) so the named React-compatible
 * helpers accept the same shape; `Pptx3DScene` structurally satisfies it.
 */
export interface Scene3dParams {
	cameraPreset?: string;
	cameraRotX?: number;
	cameraRotY?: number;
	cameraRotZ?: number;
	lightRigType?: string;
	lightRigDirection?: string;
	hasBackdrop?: boolean;
}

/**
 * Camera preset configuration: CSS perspective distance and base rotation
 * angles (in degrees). These approximate the OOXML camera preset positions.
 */
interface CameraPresetConfig {
	/** CSS perspective value, or `undefined` for orthographic. */
	perspective?: string;
	rotateX: number;
	rotateY: number;
	rotateZ: number;
}

const CAMERA_PRESET_MAP: Record<string, CameraPresetConfig> = {
	orthographicFront: { rotateX: 0, rotateY: 0, rotateZ: 0 },
	perspectiveFront: { perspective: '1000px', rotateX: 0, rotateY: 0, rotateZ: 0 },
	perspectiveAbove: { perspective: '1000px', rotateX: -20, rotateY: 0, rotateZ: 0 },
	perspectiveBelow: { perspective: '1000px', rotateX: 20, rotateY: 0, rotateZ: 0 },
	perspectiveLeft: { perspective: '1000px', rotateX: 0, rotateY: 20, rotateZ: 0 },
	perspectiveRight: { perspective: '1000px', rotateX: 0, rotateY: -20, rotateZ: 0 },
	perspectiveAboveLeftFacing: { perspective: '1000px', rotateX: -20, rotateY: 25, rotateZ: 0 },
	perspectiveAboveRightFacing: { perspective: '1000px', rotateX: -20, rotateY: -25, rotateZ: 0 },
	perspectiveContrastingLeftFacing: { perspective: '800px', rotateX: -15, rotateY: 30, rotateZ: 0 },
	perspectiveContrastingRightFacing: {
		perspective: '800px',
		rotateX: -15,
		rotateY: -30,
		rotateZ: 0,
	},
	perspectiveHeroicLeftFacing: { perspective: '600px', rotateX: -10, rotateY: 35, rotateZ: 0 },
	perspectiveHeroicRightFacing: { perspective: '600px', rotateX: -10, rotateY: -35, rotateZ: 0 },
	perspectiveHeroicExtremeLeftFacing: {
		perspective: '500px',
		rotateX: -8,
		rotateY: 45,
		rotateZ: 0,
	},
	perspectiveHeroicExtremeRightFacing: {
		perspective: '500px',
		rotateX: -8,
		rotateY: -45,
		rotateZ: 0,
	},
	perspectiveRelaxed: { perspective: '1200px', rotateX: -10, rotateY: 0, rotateZ: 0 },
	perspectiveRelaxedModerately: { perspective: '1400px', rotateX: -5, rotateY: 0, rotateZ: 0 },
	isometricLeftDown: { perspective: '1200px', rotateX: -35, rotateY: 45, rotateZ: 0 },
	isometricRightUp: { perspective: '1200px', rotateX: -35, rotateY: -45, rotateZ: 0 },
	// The other diagonal of the same isometric cube: LeftUp/RightDown mirror
	// LeftDown/RightUp around the X axis (positive tilt instead of negative),
	// matching how the Top/Bottom pair already flips sign on rotateX.
	isometricLeftUp: { perspective: '1200px', rotateX: 35, rotateY: 45, rotateZ: 0 },
	isometricRightDown: { perspective: '1200px', rotateX: 35, rotateY: -45, rotateZ: 0 },
	isometricTopUp: { perspective: '1200px', rotateX: -55, rotateY: 0, rotateZ: 45 },
	isometricTopDown: { perspective: '1200px', rotateX: -55, rotateY: 0, rotateZ: -45 },
	isometricBottomUp: { perspective: '1200px', rotateX: 55, rotateY: 0, rotateZ: 45 },
	isometricBottomDown: { perspective: '1200px', rotateX: 55, rotateY: 0, rotateZ: -45 },
	isometricOffAxis1Left: { perspective: '1200px', rotateX: -30, rotateY: 30, rotateZ: 0 },
	isometricOffAxis1Right: { perspective: '1200px', rotateX: -30, rotateY: -30, rotateZ: 0 },
	isometricOffAxis1Top: { perspective: '1200px', rotateX: -45, rotateY: 0, rotateZ: 30 },
	isometricOffAxis2Left: { perspective: '1200px', rotateX: -30, rotateY: 20, rotateZ: 0 },
	isometricOffAxis2Right: { perspective: '1200px', rotateX: -30, rotateY: -20, rotateZ: 0 },
	isometricOffAxis2Top: { perspective: '1200px', rotateX: -45, rotateY: 0, rotateZ: -30 },
	isometricOffAxis3Left: { perspective: '1200px', rotateX: -25, rotateY: 35, rotateZ: 0 },
	isometricOffAxis3Right: { perspective: '1200px', rotateX: -25, rotateY: -35, rotateZ: 0 },
	isometricOffAxis3Bottom: { perspective: '1200px', rotateX: 45, rotateY: 0, rotateZ: 30 },
	isometricOffAxis4Left: { perspective: '1200px', rotateX: -25, rotateY: 25, rotateZ: 0 },
	isometricOffAxis4Right: { perspective: '1200px', rotateX: -25, rotateY: -25, rotateZ: 0 },
	isometricOffAxis4Bottom: { perspective: '1200px', rotateX: 45, rotateY: 0, rotateZ: -30 },
	obliqueTopLeft: { perspective: '900px', rotateX: -20, rotateY: 20, rotateZ: 0 },
	obliqueTop: { perspective: '900px', rotateX: -25, rotateY: 0, rotateZ: 0 },
	obliqueTopRight: { perspective: '900px', rotateX: -20, rotateY: -20, rotateZ: 0 },
	obliqueLeft: { perspective: '900px', rotateX: 0, rotateY: 25, rotateZ: 0 },
	obliqueRight: { perspective: '900px', rotateX: 0, rotateY: -25, rotateZ: 0 },
	obliqueBottomLeft: { perspective: '900px', rotateX: 20, rotateY: 20, rotateZ: 0 },
	obliqueBottom: { perspective: '900px', rotateX: 25, rotateY: 0, rotateZ: 0 },
	obliqueBottomRight: { perspective: '900px', rotateX: 20, rotateY: -20, rotateZ: 0 },
	// Pre-2007 (legacy) WordArt/AutoShape 3-D camera names. Schema-legal but not
	// exposed in the modern "3-D Rotation" gallery; they only surface via files
	// round-tripped from legacy Office or hand-authored XML. No exact modern
	// equivalent exists, so these approximate the named position with the same
	// rotation magnitudes as the modern `oblique*`/`perspective*` families
	// (legacy oblique = same angles as modern oblique; legacy perspective =
	// the same position amplified, for a visibly stronger depth cue).
	legacyObliqueTopLeft: { perspective: '900px', rotateX: -20, rotateY: 20, rotateZ: 0 },
	legacyObliqueTop: { perspective: '900px', rotateX: -25, rotateY: 0, rotateZ: 0 },
	legacyObliqueTopRight: { perspective: '900px', rotateX: -20, rotateY: -20, rotateZ: 0 },
	legacyObliqueLeft: { perspective: '900px', rotateX: 0, rotateY: 25, rotateZ: 0 },
	legacyObliqueFront: { perspective: '900px', rotateX: 0, rotateY: 0, rotateZ: 0 },
	legacyObliqueRight: { perspective: '900px', rotateX: 0, rotateY: -25, rotateZ: 0 },
	legacyObliqueBottomLeft: { perspective: '900px', rotateX: 20, rotateY: 20, rotateZ: 0 },
	legacyObliqueBottom: { perspective: '900px', rotateX: 25, rotateY: 0, rotateZ: 0 },
	legacyObliqueBottomRight: { perspective: '900px', rotateX: 20, rotateY: -20, rotateZ: 0 },
	legacyPerspectiveTopLeft: { perspective: '700px', rotateX: -30, rotateY: 30, rotateZ: 0 },
	legacyPerspectiveTop: { perspective: '700px', rotateX: -35, rotateY: 0, rotateZ: 0 },
	legacyPerspectiveTopRight: { perspective: '700px', rotateX: -30, rotateY: -30, rotateZ: 0 },
	legacyPerspectiveLeft: { perspective: '700px', rotateX: 0, rotateY: 35, rotateZ: 0 },
	legacyPerspectiveFront: { perspective: '700px', rotateX: 0, rotateY: 0, rotateZ: 0 },
	legacyPerspectiveRight: { perspective: '700px', rotateX: 0, rotateY: -35, rotateZ: 0 },
	legacyPerspectiveBottomLeft: { perspective: '700px', rotateX: 30, rotateY: 30, rotateZ: 0 },
	legacyPerspectiveBottom: { perspective: '700px', rotateX: 35, rotateY: 0, rotateZ: 0 },
	legacyPerspectiveBottomRight: { perspective: '700px', rotateX: 30, rotateY: -30, rotateZ: 0 },
};

/** Resolved camera transform produced by {@link getCameraTransform}. */
export interface CameraTransform {
	perspective?: string;
	rotateX: number;
	rotateY: number;
	rotateZ: number;
}

/**
 * Resolve a camera preset name + explicit rotation overrides into final CSS
 * perspective and rotation (degrees). Explicit `cameraRot*` (1/60000 deg)
 * override preset defaults; the X axis is negated to match CSS conventions.
 */
export function getCameraTransform(scene3d: Scene3dParams | undefined): CameraTransform {
	if (!scene3d) {
		return { rotateX: 0, rotateY: 0, rotateZ: 0 };
	}

	const preset = scene3d.cameraPreset ? CAMERA_PRESET_MAP[scene3d.cameraPreset] : undefined;

	let perspective = preset?.perspective;
	let rotateX = preset?.rotateX ?? 0;
	let rotateY = preset?.rotateY ?? 0;
	let rotateZ = preset?.rotateZ ?? 0;

	if (scene3d.cameraRotX) {
		rotateX = -(scene3d.cameraRotX / 60000);
	}
	if (scene3d.cameraRotY) {
		rotateY = scene3d.cameraRotY / 60000;
	}
	if (scene3d.cameraRotZ) {
		rotateZ = scene3d.cameraRotZ / 60000;
	}

	if (!perspective && (rotateX !== 0 || rotateY !== 0 || rotateZ !== 0)) {
		perspective = '800px';
	}

	return { perspective, rotateX, rotateY, rotateZ };
}
