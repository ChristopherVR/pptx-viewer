/**
 * Per-side filter-parameter resolution for the bevel lighting filter.
 *
 * Split out of `visual-3d-bevel-lighting.ts` to keep that module under the
 * repo's ~300 LOC guideline: this file resolves ONE bevel side's numeric
 * filter-primitive parameters (azimuth/elevation/blur/material response),
 * `visual-3d-bevel-lighting.ts` turns a resolved layer into `<fe*>` markup.
 *
 * @module render/visual-3d-bevel-lighting-layer
 */

import { getBevelHighlightDirection, isBevelProfileInverted } from './visual-3d-bevel-light';
import type { BevelLightingSceneParams } from './visual-3d-bevel-lighting';
import {
	getBevelProfileHeightMap,
	getLightRigLighting,
	getMaterialLighting,
} from './visual-3d-bevel-lighting-tables';
import { EMU_PER_PX } from './visual-3d-constants';

const normalizeDeg = (deg: number): number => ((deg % 360) + 360) % 360;

/**
 * Resolve the SVG `feDistantLight` azimuth (degrees) for one bevel side.
 * `rigInverted` is `LIGHT_RIG_LIGHTING`'s COM-measured `invertedDirection`
 * flag (see that table's doc comment): 10 of the 27 `a:lightRig/@rig` tokens
 * measure their highlight on the edge OPPOSITE `dir`, the same kind of 180deg
 * flip `isBevelProfileInverted` already applies for `softRound`, so it
 * combines with (multiplies) the existing profile/bottom-bevel inversions
 * rather than replacing them.
 */
export function resolveAzimuthDeg(
	bevelType: string,
	lightRigDirection: string | undefined,
	isBottom: boolean,
	rigInverted: boolean,
): number {
	const vector = getBevelHighlightDirection(lightRigDirection);
	const inverted = isBevelProfileInverted(bevelType);
	const sign = (inverted ? -1 : 1) * (isBottom ? -1 : 1) * (rigInverted ? -1 : 1);
	const dx = sign * vector.dx;
	const dy = sign * vector.dy;
	return normalizeDeg((Math.atan2(dy, dx) * 180) / Math.PI);
}

/** One bevel side's resolved filter-primitive parameters. */
export interface BevelFilterLayer {
	index: number;
	blurStdDev: number;
	morphologyRadius?: number;
	surfaceScale: number;
	azimuthDeg: number;
	elevationDeg: number;
	diffuseConstant: number;
	specularConstant: number;
	specularExponent: number;
	lightingColor: string;
}

export function resolveLayer(
	index: number,
	bevelType: string,
	widthEmu: number | undefined,
	heightEmu: number | undefined,
	isBottom: boolean,
	scene: BevelLightingSceneParams | undefined,
	material: string | undefined,
): BevelFilterLayer {
	const bWpx = widthEmu ? Math.max(1, Math.round(widthEmu / EMU_PER_PX)) : 3;
	const bHpx = heightEmu ? Math.max(1, Math.round(heightEmu / EMU_PER_PX)) : 3;
	const avgDim = (bWpx + bHpx) / 2;
	const heightMap = getBevelProfileHeightMap(bevelType);
	const rig = getLightRigLighting(scene?.lightRigType);
	const mat = getMaterialLighting(material);

	return {
		index,
		blurStdDev: Math.max(0.5, avgDim * heightMap.blurFactor),
		morphologyRadius:
			heightMap.morphologyFactor !== undefined
				? Math.max(0.3, avgDim * heightMap.morphologyFactor)
				: undefined,
		surfaceScale: Math.max(
			0.5,
			avgDim * heightMap.surfaceScaleFactor * (isBottom ? 0.8 : 1) * mat.surfaceScaleMultiplier,
		),
		azimuthDeg: resolveAzimuthDeg(
			bevelType,
			scene?.lightRigDirection,
			isBottom,
			Boolean(rig.invertedDirection),
		),
		elevationDeg: rig.elevationDeg,
		diffuseConstant: mat.diffuseConstant,
		specularConstant: Math.min(1.2, mat.specularConstant * Math.sqrt(rig.specularSharpness)),
		specularExponent: Math.max(1, Math.round(mat.specularExponent * rig.specularSharpness)),
		lightingColor: mat.lightingColor,
	};
}
