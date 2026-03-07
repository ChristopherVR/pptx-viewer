/**
 * Re-export of applyJoinCapCompound for stroke serialization tests.
 * The canonical implementation lives in shape-style-line-helpers.ts in the
 * pptx-editor core builders — this thin wrapper exposes it for tests.
 */

import type { ShapeStyle, XmlObject } from "pptx-viewer-core";

/**
 * Apply line join, cap, and compound type from an `a:ln` XML node to ShapeStyle.
 * Mirrors the logic in shape-style-line-helpers.ts applyJoinCapCompound.
 */
export function applyJoinCapCompound(
	lineNode: XmlObject,
	style: ShapeStyle,
): void {
	if ('a:round' in lineNode) {
		style.lineJoin = 'round';
	} else if ('a:bevel' in lineNode) {
		style.lineJoin = 'bevel';
	} else if ('a:miter' in lineNode) {
		style.lineJoin = 'miter';
	}

	const capValue = String(lineNode['@_cap'] || '')
		.trim()
		.toLowerCase();
	if (capValue === 'rnd' || capValue === 'sq' || capValue === 'flat') {
		style.lineCap = capValue as ShapeStyle['lineCap'];
	}

	const compoundValue = String(lineNode['@_cmpd'] || '').trim();
	if (
		compoundValue === 'sng' ||
		compoundValue === 'dbl' ||
		compoundValue === 'thickThin' ||
		compoundValue === 'thinThick' ||
		compoundValue === 'tri'
	) {
		style.compoundLine = compoundValue as ShapeStyle['compoundLine'];
	}
}
