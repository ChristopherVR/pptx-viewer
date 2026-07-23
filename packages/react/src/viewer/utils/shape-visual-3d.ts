/**
 * CSS-based 3D approximation for PPTX shapes: React shim.
 *
 * The entire scene3d/shape3d → CSS engine (camera presets, extrusion depth,
 * bevel, material, light rig, contour, backdrop, and CSS 3D side-panel data)
 * now lives in the framework-neutral `pptx-viewer-shared`
 * (`render/visual-3d` + `visual-3d-extrusion`/`visual-3d-materials`/…), shared
 * verbatim with Vue and Angular. This module re-exports that surface under the
 * exact symbol names React consumers/tests already import, and adapts the two
 * framework-coupled return types (`React.CSSProperties`):
 *
 * - {@link Extrusion3DData}/{@link ExtrusionPanel} re-type shared's neutral
 *   `Extrusion3dCss` style maps to `React.CSSProperties`.
 * - {@link get3DTransformStyle} casts shared's plain object to `CSSProperties`.
 * - {@link apply3dEffects} narrows its mutable target to `CSSProperties`.
 *
 * @module shape-visual-3d
 */

import {
	build3DExtrusionData as sharedBuild3DExtrusionData,
	get3DTransformStyle as sharedGet3DTransformStyle,
	apply3dEffects as sharedApply3dEffects,
} from 'pptx-viewer-shared';
import type {
	Extrusion3DData as SharedExtrusion3DData,
	ExtrusionPanel as SharedExtrusionPanel,
	Shape3dExtrusionParams,
	Scene3dParams,
	Shape3dParams,
	MutableCss,
} from 'pptx-viewer-shared';
import type React from 'react';

export {
	getCameraTransform,
	getExtrusionShadow,
	get3DBevelShadow,
	get3DMaterialFilter,
	getLightRigCss,
} from 'pptx-viewer-shared';

/** One side face (panel) of a CSS 3D extrusion, styled with `React.CSSProperties`. */
export interface ExtrusionPanel extends Omit<SharedExtrusionPanel, 'style'> {
	style: React.CSSProperties;
}

/** Complete CSS 3D extrusion data, with `React.CSSProperties` style objects. */
export interface Extrusion3DData extends Omit<
	SharedExtrusion3DData,
	'wrapperStyle' | 'frontFaceStyle' | 'panels'
> {
	wrapperStyle: React.CSSProperties;
	frontFaceStyle: React.CSSProperties;
	panels: ExtrusionPanel[];
}

/**
 * Build complete 3D extrusion data for rendering side face panels. Thin wrapper
 * over shared's `build3DExtrusionData` that re-types the neutral CSS style maps
 * to `React.CSSProperties`.
 */
export function build3DExtrusionData(
	shape3d: Shape3dExtrusionParams | undefined,
	scene3d: Scene3dParams | undefined,
	fillColor: string | undefined,
	elementWidth: number,
	elementHeight: number,
): Extrusion3DData {
	return sharedBuild3DExtrusionData(
		shape3d,
		scene3d,
		fillColor,
		elementWidth,
		elementHeight,
	) as Extrusion3DData;
}

/** Compute CSS 3D transform styles (`React.CSSProperties`) from camera settings. */
export function get3DTransformStyle(
	scene3d: Scene3dParams | undefined,
	shape3d?: Shape3dParams | undefined,
): React.CSSProperties {
	return sharedGet3DTransformStyle(scene3d, shape3d) as React.CSSProperties;
}

/**
 * Apply 3D effects (perspective, rotation, extrusion, bevel, material, light
 * rig) to a mutable `React.CSSProperties` object.
 */
export function apply3dEffects(
	base: React.CSSProperties,
	scene3d: Scene3dParams | undefined,
	shape3d: Shape3dParams | undefined,
	fillColorFallback?: string,
): void {
	// React's `CSSProperties` allows `string | number` for several fields whereas
	// shared's neutral `MutableCss` narrows them to string; the mutator only ever
	// writes string values, so the cast is sound. `fillColorFallback` lets the
	// extrusion/contour default to the shape's resolved fill colour.
	sharedApply3dEffects(base as MutableCss, scene3d, shape3d, fillColorFallback);
}
