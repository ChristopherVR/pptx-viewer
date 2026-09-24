/**
 * Resolve a SmartArt cached shape's `a:sp3d` into the pixel-space
 * {@link SmartArt3DSolid} the lit 3D scene builds (framework-agnostic, pure).
 *
 * @module render/smartart-3d-solid
 */
import type { Pptx3DShape } from 'pptx-viewer-core';

import type { SmartArt3DBevel, SmartArt3DSolid } from './smartart-3d-solid-types';
import { hasSmartArtShape3D } from './smartart-3d-style-path';
import { EMU_PER_PX } from './visual-3d-constants';

/** ECMA-376 default `a:bevelT`/`a:bevelB` width and height: 76200 EMU (6pt). */
const DEFAULT_BEVEL_EMU = 76200;

/**
 * Largest fraction of a shape's half-extent a bevel may eat into. PowerPoint
 * shrinks an over-wide bevel so the two opposite bands never cross.
 */
const MAX_BEVEL_FRACTION = 0.9;

function resolveBevel(
	type: string | undefined,
	widthEmu: number | undefined,
	heightEmu: number | undefined,
	maxWidth: number,
): SmartArt3DBevel | undefined {
	if (type === undefined && widthEmu === undefined && heightEmu === undefined) {
		return undefined;
	}
	if (type === 'none') {
		return undefined;
	}
	const width = Math.min((widthEmu ?? DEFAULT_BEVEL_EMU) / EMU_PER_PX, maxWidth);
	const height = (heightEmu ?? DEFAULT_BEVEL_EMU) / EMU_PER_PX;
	if (width <= 0 || height <= 0) {
		return undefined;
	}
	return { width, height, profile: type ?? 'circle' };
}

/**
 * The lit solid for one shape, or `undefined` when its `a:sp3d` changes
 * nothing (the shape then renders as a flat face).
 *
 * @param halfExtent - half of the shape's smaller side, in layout px (bounds
 *   the bevel width).
 */
export function resolveSmartArt3DSolid(
	shape3d: Pptx3DShape | undefined,
	halfExtent: number,
): SmartArt3DSolid | undefined {
	if (!shape3d || !hasSmartArtShape3D(shape3d)) {
		return undefined;
	}
	const maxWidth = Math.max(0, halfExtent * MAX_BEVEL_FRACTION);
	const bevelTop = resolveBevel(
		shape3d.bevelTopType,
		shape3d.bevelTopWidth,
		shape3d.bevelTopHeight,
		maxWidth,
	);
	const bevelBottom = resolveBevel(
		shape3d.bevelBottomType,
		shape3d.bevelBottomWidth,
		shape3d.bevelBottomHeight,
		maxWidth,
	);
	return {
		...(bevelTop ? { bevelTop } : {}),
		...(bevelBottom ? { bevelBottom } : {}),
		extrusion: Math.max(0, (shape3d.extrusionHeight ?? 0) / EMU_PER_PX),
		...(shape3d.extrusionColor ? { extrusionColor: shape3d.extrusionColor } : {}),
		contourWidth: Math.max(0, (shape3d.contourWidth ?? 0) / EMU_PER_PX),
		...(shape3d.contourColor ? { contourColor: shape3d.contourColor } : {}),
		material: shape3d.presetMaterial ?? 'warmMatte',
	};
}
