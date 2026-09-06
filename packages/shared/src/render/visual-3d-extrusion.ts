/**
 * CSS 3D extrusion side-panel data (framework-agnostic).
 *
 * Generates the geometry/CSS for rendering real depth on an extruded shape by
 * positioning panel `<div>`s along its sides in 3D space, plus a `translateZ`
 * for the front face and a camera-aware material overlay gradient. Moved here
 * from React's `shape-visual-3d.ts` (`build3DExtrusionData`) so every binding
 * shares the math; the style objects use a framework-neutral CSS map
 * ({@link Extrusion3dCss}) instead of `React.CSSProperties`, which each binding
 * casts to its own style type.
 *
 * @module render/visual-3d-extrusion
 */

import { getCameraTransform, getDefaultPerspectivePx } from './visual-3d-camera';
import type { Scene3dParams } from './visual-3d-camera';
import { darkenColor } from './visual-3d-color';
import { EMU_PER_PX } from './visual-3d-constants';
import { buildExtrusionPanels } from './visual-3d-extrusion-panels';
import { getMaterialGradientOverlay } from './visual-3d-materials';
import { resolveExtrusionPanelVisibility } from './visual-3d-panel-sides';

/**
 * Maximum cap on rendered extrusion depth (in px) for side-panel 3D mode.
 * Prevents excessively tall panels from breaking layout.
 */
const MAX_EXTRUSION_DEPTH_PX = 80;

/** Shape 3D extrusion/material parameters consumed by the panel builder. */
export interface Shape3dExtrusionParams {
	extrusionHeight?: number;
	extrusionColor?: string;
	presetMaterial?: string;
}

/**
 * Framework-neutral CSS style object — a plain string/number map. Bindings cast
 * it to their own style type (`React.CSSProperties`, Vue `CSSProperties`, …).
 */
export type Extrusion3dCss = Record<string, string | number>;

/**
 * Describes one side face (panel) of a CSS 3D extrusion.
 * Each panel is a div positioned using CSS 3D transforms to form
 * the sides of the extruded shape.
 */
export interface ExtrusionPanel {
	/** Which side of the shape this panel represents. */
	side: 'top' | 'bottom' | 'left' | 'right';
	/** CSS styles for the panel (transform, width, height, background, etc.). */
	style: Extrusion3dCss;
}

/** Complete data for rendering a CSS 3D extrusion effect. */
export interface Extrusion3DData {
	/** Whether extrusion should be rendered (has depth and is valid). */
	hasExtrusion: boolean;
	/** Styles to apply to the outer wrapper that establishes the 3D context. */
	wrapperStyle: Extrusion3dCss;
	/** Styles to apply to the front face (the original shape content). */
	frontFaceStyle: Extrusion3dCss;
	/** Side panels that form the extrusion depth. */
	panels: ExtrusionPanel[];
	/** Material gradient overlay for front face (CSS backgroundImage). */
	materialOverlay?: string;
}

/**
 * Build complete 3D extrusion data for rendering side face panels.
 *
 * This generates CSS 3D transform data that creates real depth by positioning
 * div elements along the sides of the shape in 3D space. The front face is
 * translated forward by half the extrusion depth, and side panels connect
 * the front face to the back face.
 *
 * @param shape3d - Shape 3D extrusion/bevel properties.
 * @param scene3d - Scene camera/lighting properties.
 * @param fillColor - The resolved fill colour of the shape (hex string).
 * @param elementWidth - Width of the shape element in pixels.
 * @param elementHeight - Height of the shape element in pixels.
 * @returns Extrusion data including wrapper styles, front face styles, and panels.
 */
export function build3DExtrusionData(
	shape3d: Shape3dExtrusionParams | undefined,
	scene3d: Scene3dParams | undefined,
	fillColor: string | undefined,
	elementWidth: number,
	elementHeight: number,
): Extrusion3DData {
	const empty: Extrusion3DData = {
		hasExtrusion: false,
		wrapperStyle: {},
		frontFaceStyle: {},
		panels: [],
	};

	if (!shape3d?.extrusionHeight || shape3d.extrusionHeight <= 0) {
		return empty;
	}

	const depthPx = Math.max(1, Math.round(shape3d.extrusionHeight / EMU_PER_PX));
	// Cap depth for visual sanity — very deep extrusions can break layouts
	const clampedDepth = Math.min(depthPx, MAX_EXTRUSION_DEPTH_PX);

	if (clampedDepth <= 0) {
		return empty;
	}

	const {
		perspective,
		perspectiveOrigin,
		matrix3d,
		transformOrigin,
		cameraFlatFace,
		rotateX,
		rotateY,
		rotateZ,
		panelSides,
	} = getCameraTransform(scene3d, {
		width: elementWidth,
		height: elementHeight,
	});
	// A COM-measured homography (an exact `matrix3d`, or a flat/identity
	// result) resolved this camera; either way the legacy rotateX/rotateY
	// approximation and a centred `perspective` must NOT also be applied to
	// the front face/wrapper (see `visual-3d-camera`'s `cameraFlatFace` doc).
	const homographyResolved = Boolean(matrix3d) || Boolean(cameraFlatFace);

	// Use extrusion colour or darken the fill colour for side faces
	const extColor = shape3d.extrusionColor || fillColor || '#888888';
	const safeColor = extColor.startsWith('#') ? extColor : '#888888';
	// Side faces are darker than the front — lit side vs shadowed side
	const sideColorLit = darkenColor(safeColor, 0.75);
	const sideColor = darkenColor(safeColor, 0.65);
	const sideColorDeep = darkenColor(safeColor, 0.5);

	// Half-depth offset: front face is pushed forward by half the depth
	const halfDepth = clampedDepth / 2;

	// Wrapper style: establishes the 3D perspective context.
	const wrapperStyle: Extrusion3dCss = {
		position: 'absolute',
		inset: 0,
		transformStyle: 'preserve-3d',
		pointerEvents: 'none',
	};
	if (homographyResolved) {
		// A COM-measured homography bakes in its own projective divide (or is a
		// measured no-op, see `visual-3d-camera-homography`); a generic
		// `perspective` distance here would compound a second, unrelated
		// projection on top of it. `transform-origin` must match the front
		// face's (0 0), or the panels (sharing the same transform) pivot
		// around the wrong point.
		wrapperStyle.transformOrigin = transformOrigin ?? '0 0';
	} else {
		// No scene3d at all: fall back to the generic default distance
		// re-projected onto this element's own size rather than a flat px
		// constant, and keep perspective-origin in sync with the front face's
		// off-axis correction so the side panels share its vanishing point.
		wrapperStyle.perspective =
			perspective ??
			`${Math.round(getDefaultPerspectivePx({ width: elementWidth, height: elementHeight }))}px`;
		if (perspectiveOrigin) {
			wrapperStyle.perspectiveOrigin = perspectiveOrigin;
		}
	}

	// Front face: translate forward in Z to sit at the front of the extrusion.
	// `translateZ` composes correctly AFTER a homography `matrix3d` (its z
	// row/column is the identity, see `homographyToMatrix3d`): z passes
	// through untouched while x/y project exactly as the flat case.
	const frontFaceTransforms: string[] = [`translateZ(${halfDepth}px)`];
	if (matrix3d) {
		frontFaceTransforms.unshift(matrix3d);
	} else if (!cameraFlatFace) {
		if (rotateX !== 0) {
			frontFaceTransforms.unshift(`rotateX(${rotateX}deg)`);
		}
		if (rotateY !== 0) {
			frontFaceTransforms.unshift(`rotateY(${rotateY}deg)`);
		}
		if (rotateZ !== 0) {
			frontFaceTransforms.unshift(`rotateZ(${rotateZ}deg)`);
		}
	}

	const frontFaceStyle: Extrusion3dCss = {
		transform: frontFaceTransforms.join(' '),
		transformStyle: 'preserve-3d',
		backfaceVisibility: 'hidden',
	};
	if (homographyResolved) {
		frontFaceStyle.transformOrigin = transformOrigin ?? '0 0';
	}

	// Determine which panels to show: `panelSides` (COM-measured, see
	// `visual-3d-panel-sides`) is authoritative whenever the camera preset
	// resolved one; `resolveExtrusionPanelVisibility` also applies the
	// legacy rotateX/rotateY fallback and the "show all four" face-on
	// default (see its own doc comment).
	const { showTop, showBottom, showLeft, showRight } = resolveExtrusionPanelVisibility(
		panelSides,
		rotateX,
		rotateY,
	);

	const panels = buildExtrusionPanels({
		panelVisibility: { showTop, showBottom, showLeft, showRight },
		elementWidth,
		elementHeight,
		clampedDepth,
		halfDepth,
		rotateX,
		rotateY,
		rotateZ,
		matrix3d,
		homographyResolved,
		cameraPreset: scene3d?.cameraPreset,
		sideColorLit,
		sideColor,
		sideColorDeep,
	});

	// Material overlay for front face
	const materialOverlay = getMaterialGradientOverlay(shape3d.presetMaterial, rotateX, rotateY);

	return {
		hasExtrusion: true,
		wrapperStyle,
		frontFaceStyle,
		panels,
		materialOverlay,
	};
}
