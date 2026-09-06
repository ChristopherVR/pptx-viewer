/**
 * Extrusion side-panel array construction, split out of `visual-3d-extrusion`
 * to keep that file under the repo's LOC guideline.
 *
 * Panels share the front face's transform (`matrix3d` when a homography
 * camera is active) so they don't visibly separate from its projected edges.
 * That composition is exact for the legacy `rotateX`/`rotateY` + CSS
 * `perspective` camera, but is DEGENERATE for a homography-resolved camera
 * (see `visual-3d-panel-quad`'s module doc comment: a homography's
 * `matrix3d` never feeds z into the projective divide, so a purely local
 * rotate + `translateZ` fold collapses the front and back edges onto the
 * same screen line). When a preset has COM-measured ground truth (see
 * `PANEL_DEPTH_SKEW_MAP`), `computeHomographyPanelQuad` replaces the whole
 * rotate/translateZ/transform composition with an explicit projected
 * quadrilateral instead; presets without ground truth keep the legacy
 * (still-approximate) composition rather than guessing an unmeasured skew.
 *
 * @module render/visual-3d-extrusion-panels
 */

import { getCameraHomography } from './visual-3d-camera-homography';
import type { Homography3 } from './visual-3d-camera-homography';
import type { Extrusion3dCss, ExtrusionPanel } from './visual-3d-extrusion';
import { computeHomographyPanelQuad, getMeasuredPanelDepthSkew } from './visual-3d-panel-quad';
import type { PanelDepthSkew } from './visual-3d-panel-quad';
import type { PanelVisibility } from './visual-3d-panel-sides';

/** Inputs needed to build the extrusion side-panel array. */
export interface BuildExtrusionPanelsParams {
	panelVisibility: PanelVisibility;
	elementWidth: number;
	elementHeight: number;
	clampedDepth: number;
	halfDepth: number;
	rotateX: number;
	rotateY: number;
	rotateZ: number;
	matrix3d: string | undefined;
	homographyResolved: boolean;
	cameraPreset: string | undefined;
	sideColorLit: string;
	sideColor: string;
	sideColorDeep: string;
}

/** Legacy per-side geometry: local rotate+translateZ fold of the front face's own transform. */
interface LegacyPanelGeometry {
	width: number;
	height: number;
	left: number;
	top: number;
	transformOrigin: string;
	transform: string;
}

/** Build the extrusion side-panel array (bottom/top/right/left, whichever are visible). */
export function buildExtrusionPanels(params: BuildExtrusionPanelsParams): ExtrusionPanel[] {
	const {
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
		cameraPreset,
		sideColorLit,
		sideColor,
		sideColorDeep,
	} = params;

	// Common side panel base styles (legacy transform path only).
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

	const rotations: string[] = matrix3d ? [matrix3d] : [];
	if (!homographyResolved && rotateX !== 0) {
		rotations.push(`rotateX(${rotateX}deg)`);
	}
	if (!homographyResolved && rotateY !== 0) {
		rotations.push(`rotateY(${rotateY}deg)`);
	}
	if (!homographyResolved && rotateZ !== 0) {
		rotations.push(`rotateZ(${rotateZ}deg)`);
	}

	const homographyUnit: Homography3 | undefined = homographyResolved
		? getCameraHomography(cameraPreset)
		: undefined;

	function buildPanelStyle(
		side: 'top' | 'bottom' | 'left' | 'right',
		legacy: LegacyPanelGeometry,
		gradient: string,
	): Extrusion3dCss {
		// Look up per-SIDE first: a preset with 2 simultaneously-visible
		// panels can have each independently skewed (see
		// `PANEL_DEPTH_SKEW_MAP`'s doc comment, especially the `oblique*`
		// family), so the top/bottom panel and the left/right panel of the
		// same preset are not guaranteed to share one vector.
		const measuredSkew: PanelDepthSkew | undefined = homographyUnit
			? getMeasuredPanelDepthSkew(cameraPreset, side)
			: undefined;
		if (homographyUnit && measuredSkew) {
			const quad = computeHomographyPanelQuad(
				homographyUnit,
				side,
				elementWidth,
				elementHeight,
				clampedDepth,
				measuredSkew,
			);
			return {
				position: 'absolute',
				left: quad.left,
				top: quad.top,
				width: quad.width,
				height: quad.height,
				clipPath: quad.clipPath,
				background: gradient,
			};
		}
		return { ...panelBase, ...legacy, background: gradient };
	}

	const panels: ExtrusionPanel[] = [];

	// ── Bottom panel ──
	// Positioned at the bottom edge of the shape, rotated 90deg around X axis
	if (showBottom) {
		panels.push({
			side: 'bottom',
			style: buildPanelStyle(
				'bottom',
				{
					width: elementWidth,
					height: clampedDepth,
					left: 0,
					top: elementHeight,
					transformOrigin: 'top center',
					transform: [...rotations, 'rotateX(-90deg)', `translateZ(${-halfDepth}px)`].join(' '),
				},
				bottomGradient,
			),
		});
	}

	// ── Top panel ──
	if (showTop) {
		panels.push({
			side: 'top',
			style: buildPanelStyle(
				'top',
				{
					width: elementWidth,
					height: clampedDepth,
					left: 0,
					top: 0,
					transformOrigin: 'bottom center',
					transform: [...rotations, 'rotateX(90deg)', `translateZ(${-halfDepth}px)`].join(' '),
				},
				topGradient,
			),
		});
	}

	// ── Right panel ──
	if (showRight) {
		panels.push({
			side: 'right',
			style: buildPanelStyle(
				'right',
				{
					width: clampedDepth,
					height: elementHeight,
					left: elementWidth,
					top: 0,
					transformOrigin: 'left center',
					transform: [...rotations, 'rotateY(90deg)', `translateZ(${-halfDepth}px)`].join(' '),
				},
				rightGradient,
			),
		});
	}

	// ── Left panel ──
	if (showLeft) {
		panels.push({
			side: 'left',
			style: buildPanelStyle(
				'left',
				{
					width: clampedDepth,
					height: elementHeight,
					left: 0,
					top: 0,
					transformOrigin: 'right center',
					transform: [...rotations, 'rotateY(-90deg)', `translateZ(${-halfDepth}px)`].join(' '),
				},
				leftGradient,
			),
		});
	}

	return panels;
}
