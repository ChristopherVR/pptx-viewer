/**
 * Camera-preset → CSS perspective/rotation mapping (framework-agnostic).
 *
 * Resolves OOXML camera presets and explicit rotation angles into CSS
 * `perspective` + `rotateX/Y/Z`. Shared by every binding's 3D layer.
 *
 * The perspective DISTANCE is derived geometrically from a camera field of
 * view rather than an arbitrary pixel constant: for a FOV `f` projected onto
 * an element of on-screen `size` pixels, the CSS `perspective` distance that
 * reproduces that FOV is `d = (size / 2) / tan(f / 2)` (see
 * {@link fovToPerspectivePx}). Each preset in
 * {@link CAMERA_PRESET_MAP} instead stores the EQUIVALENT reference distance
 * at `visual-3d-camera-fov`'s `REFERENCE_SIZE_PX` (the pre-existing hand-tuned pixel constants,
 * kept as-is so behaviour at that reference size is unchanged); a per-preset
 * FOV is derived from it once and then re-projected onto the actual element
 * size, so a large shape gets proportionally less foreshortening than a small
 * one for the "same" camera, matching how a real lens behaves. An explicit
 * `a:camera/@fov` overrides the derived default outright, and `@zoom` narrows
 * the effective FOV the way a telephoto lens flattens perspective when
 * zooming in from a fixed position (see `visual-3d-camera-fov`'s
 * `applyZoomToFov`). The FOV <-> perspective-distance math itself lives in
 * that sibling module, split out to keep this file under the repo's LOC
 * guideline.
 *
 * Ground-truthed against real PowerPoint (COM `Slide.Export` at 192dpi,
 * 2026-09): a flat, unextruded square under `isometricLeftDown` /
 * `isometricTopUp` renders as a true parallelogram, with opposite edges equal
 * in length to within measurement noise (~0.7%): PARALLEL projection,
 * no perspective divide at all. `orthographicFront` is unrotated and
 * trivially parallel too. Only the `perspective*`/`oblique*`/`legacy*`
 * families showed real keystoning (near/far edge length differing by several
 * percent). {@link CAMERA_PRESET_MAP} reflects that: isometric/orthographic
 * presets carry no `perspectiveRefPx`, so {@link getCameraTransform} never
 * emits a `perspective` for them, regardless of element size or explicit fov.
 *
 * A second COM measurement (2026-09, a 4in/144dpi square, `SetPresetCamera` +
 * `Depth = 0`, pixel-scanned bounding box + centroid) found every rotated
 * `perspective*` preset projected OPPOSITE the direction the old
 * `rotateX`/`rotateY` signs + a centred `perspective` predicted
 * (`perspectiveLeft` measured screen-RIGHT). Negating both for the whole
 * family (below) brings the single-axis presets within ~0.5% of measured
 * (effectively exact) and roughly halves the error for the two-axis presets.
 * A centred `perspective` alone cannot fully reproduce the two-axis presets'
 * off-axis camera even with corrected signs (a `rotateX`/`rotateY`/distance
 * grid search could not zero the residual for `perspectiveHeroicLeftFacing`
 * or `perspectiveContrastingLeftFacing`: a genuine off-axis vanishing point,
 * not a wrong angle). A COM-calibrated `perspective-origin`
 * (`perspectiveOriginXPct`/`YPct` below) closes most of that gap for the
 * `Contrasting*` and `HeroicExtreme*` presets; `Heroic(Left/Right)Facing`,
 * `AboveLeftFacing`/`RightFacing` and `Relaxed*` found no stable
 * non-boundary-hugging origin fit and keep the default centred origin.
 *
 * @module render/visual-3d-camera
 */

import {
	applyZoomToFov,
	fovFromRefPx,
	fovToPerspectivePx,
	REFERENCE_SIZE_PX,
	resolveSizePx,
} from './visual-3d-camera-fov';
import type { ElementSizePx } from './visual-3d-camera-fov';
import {
	getCameraHomography,
	homographyToMatrix3d,
	isIdentityHomography,
} from './visual-3d-camera-homography';
import { CAMERA_PRESET_MAP, DEFAULT_CUSTOM_REF_PX } from './visual-3d-camera-presets';
import { resolvePanelSides } from './visual-3d-panel-sides';
import type { PanelVisibility } from './visual-3d-panel-sides';

export type { ElementSizePx } from './visual-3d-camera-fov';
export {
	getCameraHomography,
	homographyToMatrix3d,
	isIdentityHomography,
	IDENTITY_HOMOGRAPHY_PRESETS,
	CAMERA_HOMOGRAPHY_MAP,
} from './visual-3d-camera-homography';
export type { Homography3 } from './visual-3d-camera-homography';
export {
	panelSidesFromHomography,
	resolvePanelSides,
	resolveExtrusionPanelVisibility,
	MEASURED_ISOMETRIC_PANEL_SIDES,
	OBLIQUE_DIRECTION_PANEL_SIDES,
} from './visual-3d-panel-sides';
export type { PanelVisibility } from './visual-3d-panel-sides';

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
	/** `a:camera/@fov`, in 1/60000 degrees. Overrides the preset's default FOV. */
	cameraFieldOfView?: number;
	/** `a:camera/@zoom`, a fraction where 1 = 100%. Narrows the effective FOV. */
	cameraZoom?: number;
	lightRigType?: string;
	lightRigDirection?: string;
	hasBackdrop?: boolean;
	/** Backdrop plane normal vector (`a:backdrop/a:norm`), default (0, 1, 0): a flat floor. */
	backdropNormalX?: number;
	backdropNormalY?: number;
	backdropNormalZ?: number;
}

/** Resolved camera transform produced by {@link getCameraTransform}. */
export interface CameraTransform {
	perspective?: string;
	/** CSS `perspective-origin` (e.g. `"93% 0%"`); `undefined` means the default centred `50% 50%`. */
	perspectiveOrigin?: string;
	/**
	 * A COM-measured exact `matrix3d(...)` CSS transform (see
	 * `visual-3d-camera-homography`), when the preset has ground truth and no
	 * explicit `a:camera/a:rot` override is present. When set, this REPLACES
	 * `perspective`/`perspectiveOrigin`/`rotateX`/`rotateY`/`rotateZ` for the
	 * actual rendered transform (both are always 0 in that case) and MUST be
	 * paired with `transformOrigin: '0 0'`. `rotateX`/`rotateY` are still
	 * populated (from the legacy preset table) for callers that only need
	 * "which side is the camera on" (extrusion panel visibility/shading), not
	 * the exact transform; see {@link cameraFlatFace}.
	 */
	matrix3d?: string;
	/** `'0 0'` when {@link matrix3d} is set; `undefined` (default `50% 50%`) otherwise. */
	transformOrigin?: string;
	/**
	 * `true` when a COM-measured homography resolved the preset to an
	 * IDENTITY transform (the front face is flat; see
	 * `visual-3d-camera-homography`'s module doc comment for the
	 * `oblique*`/`legacyOblique*`/`legacyPerspective*`/`orthographicFront`
	 * families). `rotateX`/`rotateY` are still populated from the legacy
	 * hand-tuned table in this case, but ONLY as an extrusion
	 * panel-visibility/shading direction hint (which side of the box the
	 * camera implies you'd see) -- callers building the actual CSS transform
	 * MUST skip `rotateX`/`rotateY`/`rotateZ`/`perspective` entirely when this
	 * is `true`, the same way they already skip them when {@link matrix3d} is
	 * set.
	 */
	cameraFlatFace?: boolean;
	rotateX: number;
	rotateY: number;
	rotateZ: number;
	/**
	 * COM-measured extruded-box panel visibility for this camera preset (see
	 * `visual-3d-panel-sides`), when one could be resolved. `undefined` means
	 * "no preset-specific ground truth" (an explicit `a:camera/a:rot`
	 * override, or an unrecognised preset): callers fall back to their own
	 * `rotateX`/`rotateY` threshold heuristic in that case, unchanged.
	 */
	panelSides?: PanelVisibility;
}

/**
 * The generic (no camera preset, no explicit rotation) default perspective
 * distance, re-projected onto `elementSize` instead of the flat `800px`
 * constant this used to be everywhere it appeared (`visual-3d-extrusion`'s
 * wrapper style in particular, which falls back to it independently of
 * {@link getCameraTransform} whenever `scene3d` itself is absent rather than
 * merely lacking a preset). Exported so every such call site derives the same
 * size-aware default instead of hand-rolling its own `'800px'` literal.
 */
export function getDefaultPerspectivePx(elementSize?: ElementSizePx): number {
	return fovToPerspectivePx(fovFromRefPx(DEFAULT_CUSTOM_REF_PX), resolveSizePx(elementSize));
}

/**
 * Resolve a camera preset name + explicit rotation overrides into final CSS
 * perspective and rotation (degrees). Explicit `cameraRot*` (1/60000 deg)
 * override preset defaults; the X axis is negated to match CSS conventions.
 *
 * `elementSize`, when provided, re-projects the preset's (or an explicit
 * `@fov`'s) field of view onto the element's actual rendered size rather than
 * the `visual-3d-camera-fov`'s `REFERENCE_SIZE_PX` the preset table was tuned at, so a large
 * shape is not warped as aggressively, in absolute terms, as a small one
 * under the "same" camera. Omitting it (every call site that predates this
 * parameter) reproduces the exact legacy `perspectiveRefPx` strings.
 */
export function getCameraTransform(
	scene3d: Scene3dParams | undefined,
	elementSize?: ElementSizePx,
): CameraTransform {
	if (!scene3d) {
		return { rotateX: 0, rotateY: 0, rotateZ: 0 };
	}

	const preset = scene3d.cameraPreset ? CAMERA_PRESET_MAP[scene3d.cameraPreset] : undefined;
	// The legacy table's hand-tuned rotateX/rotateY is inaccurate as an actual
	// transform for a homography-covered preset (see below); it is kept ONLY
	// as the last-resort panel-visibility fallback for callers with no
	// preset-specific ground truth (an explicit `a:camera/a:rot` override).
	// `resolvePanelSides` (COM-measured, see `visual-3d-panel-sides`) is the
	// real answer for every recognised preset, exact for the `perspective*`
	// family (derived from its homography) and measured directly for the
	// `isometric*`/oblique/legacy families (whose homography is degenerate:
	// e.g. `isometricTopUp`'s front face is pixel-identical to
	// `isometricBottomUp`'s, so no function of the homography alone can
	// recover which side of the box a flat-shape measurement never saw).
	const panelHintRotateX = preset?.rotateX ?? 0;
	const panelHintRotateY = preset?.rotateY ?? 0;

	// A COM-measured exact homography takes priority over the hand-tuned
	// rotateX/rotateY + centred-perspective approximation below (see
	// `visual-3d-camera-homography`'s module doc comment for why the two
	// families cannot be unified: a centred perspective can never reproduce a
	// genuine off-axis vanishing point, or "scale but don't skew"). Skipped
	// when an explicit `a:camera/a:rot` / `@fov` / `@zoom` override is present.
	const hasExplicitOverride = Boolean(
		scene3d.cameraRotX ||
		scene3d.cameraRotY ||
		scene3d.cameraRotZ ||
		scene3d.cameraFieldOfView ||
		scene3d.cameraZoom,
	);
	if (!hasExplicitOverride) {
		const hUnit = getCameraHomography(scene3d.cameraPreset);
		const panelSides = resolvePanelSides(scene3d.cameraPreset, hUnit);
		if (hUnit && isIdentityHomography(hUnit)) {
			// Measured as a no-op (see the module doc comment): emit nothing
			// rather than a functionally-equivalent identity `matrix3d(...)`.
			return {
				cameraFlatFace: true,
				rotateX: panelHintRotateX,
				rotateY: panelHintRotateY,
				rotateZ: 0,
				panelSides,
			};
		}
		if (hUnit) {
			const size = elementSize ?? { width: REFERENCE_SIZE_PX, height: REFERENCE_SIZE_PX };
			return {
				matrix3d: homographyToMatrix3d(hUnit, size.width, size.height),
				transformOrigin: '0 0',
				rotateX: panelHintRotateX,
				rotateY: panelHintRotateY,
				rotateZ: 0,
				panelSides,
			};
		}
	}

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

	const hasRotation = rotateX !== 0 || rotateY !== 0 || rotateZ !== 0;
	const explicitFov =
		scene3d.cameraFieldOfView && scene3d.cameraFieldOfView > 0
			? (scene3d.cameraFieldOfView / 60000) * (Math.PI / 180)
			: undefined;

	// Resolve a base FOV: an explicit `@fov` always wins; otherwise a preset
	// carrying `perspectiveRefPx` supplies one; a bare explicit rotation with
	// no preset (or an isometric/orthographic preset, which is intentionally
	// parallel-projected) falls back to a generic default ONLY when there is
	// no preset at all: an isometric/orthographic preset must stay parallel
	// even when explicitly rotated further.
	let fovRad: number | undefined = explicitFov;
	if (fovRad === undefined && preset?.perspectiveRefPx !== undefined) {
		fovRad = fovFromRefPx(preset.perspectiveRefPx);
	}
	if (fovRad === undefined && !preset && hasRotation) {
		fovRad = fovFromRefPx(DEFAULT_CUSTOM_REF_PX);
	}

	let perspective: string | undefined;
	if (fovRad !== undefined) {
		const effectiveFov = applyZoomToFov(fovRad, scene3d.cameraZoom);
		perspective = `${Math.round(fovToPerspectivePx(effectiveFov, resolveSizePx(elementSize)))}px`;
	}

	const perspectiveOrigin =
		preset?.perspectiveOriginXPct !== undefined && preset?.perspectiveOriginYPct !== undefined
			? `${preset.perspectiveOriginXPct}% ${preset.perspectiveOriginYPct}%`
			: undefined;

	return { perspective, perspectiveOrigin, rotateX, rotateY, rotateZ };
}
