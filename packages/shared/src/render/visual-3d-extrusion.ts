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

import { getCameraTransform } from './visual-3d-camera';
import type { Scene3dParams } from './visual-3d-camera';
import { darkenColor } from './visual-3d-color';
import { EMU_PER_PX } from './visual-3d-constants';
import { getMaterialGradientOverlay } from './visual-3d-materials';

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

	const { perspective, rotateX, rotateY, rotateZ } = getCameraTransform(scene3d);

	// Use extrusion colour or darken the fill colour for side faces
	const extColor = shape3d.extrusionColor || fillColor || '#888888';
	const safeColor = extColor.startsWith('#') ? extColor : '#888888';
	// Side faces are darker than the front — lit side vs shadowed side
	const sideColorLit = darkenColor(safeColor, 0.75);
	const sideColor = darkenColor(safeColor, 0.65);
	const sideColorDeep = darkenColor(safeColor, 0.5);

	// Half-depth offset: front face is pushed forward by half the depth
	const halfDepth = clampedDepth / 2;

	// Wrapper style: establishes the 3D perspective context
	const wrapperStyle: Extrusion3dCss = {
		position: 'absolute',
		inset: 0,
		transformStyle: 'preserve-3d',
		perspective: perspective || '800px',
		pointerEvents: 'none',
	};

	// Front face: translate forward in Z to sit at the front of the extrusion
	const frontFaceTransforms: string[] = [`translateZ(${halfDepth}px)`];
	if (rotateX !== 0) {
		frontFaceTransforms.unshift(`rotateX(${rotateX}deg)`);
	}
	if (rotateY !== 0) {
		frontFaceTransforms.unshift(`rotateY(${rotateY}deg)`);
	}
	if (rotateZ !== 0) {
		frontFaceTransforms.unshift(`rotateZ(${rotateZ}deg)`);
	}

	const frontFaceStyle: Extrusion3dCss = {
		transform: frontFaceTransforms.join(' '),
		transformStyle: 'preserve-3d',
		backfaceVisibility: 'hidden',
	};

	// Determine which panels to show based on camera angle.
	// When looking from above (rotateX < 0), the bottom panel is visible.
	// When looking from below (rotateX > 0), the top panel is visible.
	// When looking from the left (rotateY > 0), the right panel is visible.
	// When looking from the right (rotateY < 0), the left panel is visible.
	// We also show panels for straight-on views to give depth perception.
	const showBottom = rotateX <= 2;
	const showTop = rotateX >= -2;
	const showRight = rotateY <= 5;
	const showLeft = rotateY >= -5;

	// Common side panel base styles
	const panelBase: Extrusion3dCss = {
		position: 'absolute',
		backfaceVisibility: 'hidden',
		transformStyle: 'preserve-3d',
	};

	// Direction-aware gradients for side faces: panels facing the light
	// source get a lighter gradient, those facing away get darker.
	// For top-left default lighting, bottom and right panels are more lit.
	const isLitFromTop = rotateX <= 0; // camera above → bottom panel lit
	const isLitFromLeft = rotateY >= 0; // camera left → right panel lit

	// Vertical panels (top/bottom): front edge → back edge gradient
	const bottomGradient = isLitFromTop
		? `linear-gradient(to bottom, ${sideColorLit}, ${sideColor})`
		: `linear-gradient(to bottom, ${sideColor}, ${sideColorDeep})`;
	const topGradient = isLitFromTop
		? `linear-gradient(to bottom, ${sideColor}, ${sideColorDeep})`
		: `linear-gradient(to bottom, ${sideColorLit}, ${sideColor})`;

	// Horizontal panels (left/right): front edge → back edge gradient
	const rightGradient = isLitFromLeft
		? `linear-gradient(to right, ${sideColor}, ${sideColorLit})`
		: `linear-gradient(to right, ${sideColorLit}, ${sideColorDeep})`;
	const leftGradient = isLitFromLeft
		? `linear-gradient(to right, ${sideColorDeep}, ${sideColor})`
		: `linear-gradient(to right, ${sideColor}, ${sideColorLit})`;

	const rotations: string[] = [];
	if (rotateX !== 0) {
		rotations.push(`rotateX(${rotateX}deg)`);
	}
	if (rotateY !== 0) {
		rotations.push(`rotateY(${rotateY}deg)`);
	}
	if (rotateZ !== 0) {
		rotations.push(`rotateZ(${rotateZ}deg)`);
	}

	const panels: ExtrusionPanel[] = [];

	// ── Bottom panel ──
	// Positioned at the bottom edge of the shape, rotated 90deg around X axis
	if (showBottom) {
		panels.push({
			side: 'bottom',
			style: {
				...panelBase,
				width: elementWidth,
				height: clampedDepth,
				left: 0,
				top: elementHeight,
				transformOrigin: 'top center',
				transform: [...rotations, 'rotateX(-90deg)', `translateZ(${-halfDepth}px)`].join(' '),
				background: bottomGradient,
			},
		});
	}

	// ── Top panel ──
	if (showTop) {
		panels.push({
			side: 'top',
			style: {
				...panelBase,
				width: elementWidth,
				height: clampedDepth,
				left: 0,
				top: 0,
				transformOrigin: 'bottom center',
				transform: [...rotations, 'rotateX(90deg)', `translateZ(${-halfDepth}px)`].join(' '),
				background: topGradient,
			},
		});
	}

	// ── Right panel ──
	if (showRight) {
		panels.push({
			side: 'right',
			style: {
				...panelBase,
				width: clampedDepth,
				height: elementHeight,
				left: elementWidth,
				top: 0,
				transformOrigin: 'left center',
				transform: [...rotations, 'rotateY(90deg)', `translateZ(${-halfDepth}px)`].join(' '),
				background: rightGradient,
			},
		});
	}

	// ── Left panel ──
	if (showLeft) {
		panels.push({
			side: 'left',
			style: {
				...panelBase,
				width: clampedDepth,
				height: elementHeight,
				left: 0,
				top: 0,
				transformOrigin: 'right center',
				transform: [...rotations, 'rotateY(-90deg)', `translateZ(${-halfDepth}px)`].join(' '),
				background: leftGradient,
			},
		});
	}

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
