/**
 * CSS-based 3D approximation utilities for PPTX shapes.
 *
 * Provides clean, composable functions that translate OOXML 3D shape
 * properties (extrusion, bevel, material, camera) into CSS styles.
 * These are lightweight wrappers around the internal 3D engine in
 * `shape-visual-3d.ts` and `material-presets.ts`, exposing a stable
 * public API with the specific function signatures documented below.
 *
 * @module shape-3d-styles
 */

import type { MaterialPresetType, Pptx3DScene, Pptx3DShape } from 'pptx-viewer-core';
import type React from 'react';

import { EMU_PER_PX } from '../constants';
import { getMaterialCssOverrides } from './material-presets';
import {
	apply3dEffects,
	get3DBevelShadow,
	getCameraTransform,
	getExtrusionShadow,
} from './shape-visual-3d';

// ── Extrusion Shadows ───────────────────────────────────────────────────

/**
 * Generate multiple box-shadow layers at incremental offsets to simulate
 * extrusion depth.  The shadow stack radiates in a direction determined
 * by `angle` (degrees, default 135 = bottom-right).
 *
 * @param depth  - Extrusion depth in pixels.
 * @param color  - Base extrusion colour (hex string, e.g. "#4472C4").
 * @param angle  - Shadow direction in degrees (0 = right, 90 = down).
 *                 Defaults to 135 (bottom-right diagonal).
 * @returns       CSS box-shadow value, or empty string for zero/negative depth.
 */
export function computeExtrusionShadows(depth: number, color: string, angle = 135): string {
	if (depth <= 0) {
		return '';
	}

	// Convert depth in px to EMU so we can delegate to the internal engine
	const emuHeight = Math.round(depth * EMU_PER_PX);

	// Derive approximate camera rotations from the angle so the internal
	// engine picks the correct shadow direction.
	// angle 135 = default (bottom-right) => rotateX ~ -10, rotateY ~ -10
	// angle 315 = top-left => rotateX ~ 10, rotateY ~ 10
	const rad = ((angle - 135) * Math.PI) / 180;
	const rotateX = -(Math.sin(rad) * 15);
	const rotateY = -(Math.cos(rad) * 15) + 15; // bias toward default

	const result = getExtrusionShadow(
		{ extrusionHeight: emuHeight, extrusionColor: color },
		rotateX > 5 ? rotateX : -10,
		rotateY > 5 ? rotateY : 0,
	);

	return result ?? '';
}

// ── Bevel Styles ────────────────────────────────────────────────────────

/**
 * Compute CSS inset box-shadow (and optional background gradient) that
 * approximate one of the 12 OOXML bevel presets.
 *
 * Supported bevel types: circle, relaxedInset, cross, coolSlant, angle,
 * softRound, convex, slope, divot, riblet, hardEdge, artDeco.
 *
 * @param bevelType - Bevel preset name.
 * @param width     - Bevel width in pixels.
 * @param height    - Bevel height in pixels.
 * @returns Object with `boxShadow` (always present) and optional `background`.
 */
export function computeBevelStyles(
	bevelType: string,
	width: number,
	height: number,
): { boxShadow: string; background?: string } {
	if (!bevelType || bevelType === 'none' || width <= 0 || height <= 0) {
		return { boxShadow: '' };
	}

	// Convert pixel dimensions to EMU for the internal API
	const emuW = Math.round(width * EMU_PER_PX);
	const emuH = Math.round(height * EMU_PER_PX);

	const shadow = get3DBevelShadow({
		bevelTopType: bevelType,
		bevelTopWidth: emuW,
		bevelTopHeight: emuH,
	});

	if (!shadow) {
		return { boxShadow: '' };
	}

	// Certain bevel types benefit from a subtle background gradient to
	// enhance the raised/recessed illusion.
	let background: string | undefined;

	switch (bevelType) {
		case 'convex':
			background =
				'radial-gradient(ellipse at 40% 35%, rgba(255,255,255,0.08) 0%, transparent 60%)';
			break;
		case 'divot':
			background = 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0.04) 0%, transparent 50%)';
			break;
		case 'softRound':
			background =
				'radial-gradient(ellipse at 35% 30%, rgba(255,255,255,0.06) 0%, transparent 55%)';
			break;
	}

	return { boxShadow: shadow, background };
}

// ── Material Filter ─────────────────────────────────────────────────────

/**
 * Compute a CSS `filter` string that approximates an OOXML material preset.
 *
 * Material mappings:
 * - matte       → brightness(0.95) saturate(0.9)
 * - warmMatte   → brightness(1.0) saturate(0.85) sepia(0.08)
 * - plastic     → brightness(1.05) contrast(1.05)
 * - metal       → brightness(1.1) contrast(1.15) saturate(1.2)
 * - dkEdge      → brightness(0.85) contrast(1.2)
 * - softEdge    → brightness(1.05) contrast(0.9)
 * - flat         → (none)
 * - softmetal   → brightness(1.05) contrast(1.08) saturate(1.1)
 * - clear       → brightness(1.15)
 * - powder      → brightness(1.1) contrast(0.85) saturate(0.8)
 * - translucentPowder → brightness(1.1) contrast(0.85)
 *
 * @param material - Material preset name.
 * @returns CSS filter string, or empty string for unknown/flat materials.
 */
export function computeMaterialFilter(material: string): string {
	if (!material) {
		return '';
	}

	const overrides = getMaterialCssOverrides(material as MaterialPresetType);
	return overrides.filter ?? '';
}

// ── Camera Transform ────────────────────────────────────────────────────

/**
 * Compute a CSS `transform` string with perspective and 3D rotation from
 * OOXML camera properties.
 *
 * @param preset - Camera preset name (e.g. "perspectiveFront", "isometricLeftDown").
 * @param lat    - Latitude (X rotation) in 1/60000 degrees.
 * @param lon    - Longitude (Y rotation) in 1/60000 degrees.
 * @returns CSS transform string (e.g. "perspective(1000px) rotateX(-20deg)"),
 *          or empty string when no transform is needed.
 */
export function computeCameraTransform(preset?: string, lat?: number, lon?: number): string {
	const scene: Pptx3DScene = {};
	if (preset) {
		scene.cameraPreset = preset;
	}
	if (lat !== undefined) {
		scene.cameraRotX = lat;
	}
	if (lon !== undefined) {
		scene.cameraRotY = lon;
	}

	const { perspective, rotateX, rotateY, rotateZ } = getCameraTransform(scene);

	const parts: string[] = [];

	if (perspective) {
		parts.push(`perspective(${perspective})`);
	}
	if (rotateX !== 0) {
		parts.push(`rotateX(${rotateX}deg)`);
	}
	if (rotateY !== 0) {
		parts.push(`rotateY(${rotateY}deg)`);
	}
	if (rotateZ !== 0) {
		parts.push(`rotateZ(${rotateZ}deg)`);
	}

	return parts.join(' ');
}

// ── Combined 3D Styles ──────────────────────────────────────────────────

/**
 * Compute a complete `React.CSSProperties` object that combines all 3D
 * effects — extrusion shadows, bevel inset highlights, material filters,
 * camera perspective/rotation, and light-rig overlays — into a single
 * style that can be spread onto a React element.
 *
 * Accepts the raw OOXML types `Pptx3DShape` and `Pptx3DScene` directly.
 * Returns an empty object when both inputs are undefined/empty.
 *
 * @param shape3d - Shape 3D properties (extrusion, bevel, material).
 * @param scene3d - Scene 3D properties (camera, lighting).
 * @returns React CSS properties to apply to the shape container.
 */
export function computeShape3dStyles(
	shape3d?: Pptx3DShape,
	scene3d?: Pptx3DScene,
): React.CSSProperties {
	if (!shape3d && !scene3d) {
		return {};
	}

	const base: React.CSSProperties = {};
	apply3dEffects(base, scene3d, shape3d);
	return base;
}
