/**
 * Extruded SmartArt labels (framework-agnostic, pure).
 *
 * A quick style can extrude the label text itself off the shape face
 * (`a:bodyPr/a:sp3d`, e.g. Bird's Eye Scene: `extrusionH="28000"`). The
 * scene has glyph bitmaps, not glyph outlines, so it builds the letters'
 * solid from stacked copies of the label: side layers every
 * {@link TEXT_LAYER_STEP} px from the face up to the extrusion depth, drawn in
 * the shaded side colour, then the front copy on top at the full depth.
 * Under the diagram's camera the stack reads as the letters' walls.
 *
 * @module render/smartart-3d-text-extrusion
 */
import type { SmartArt3DTextBlock } from './smartart-3d-types';

/** Depth between two side layers, layout px (fine enough to read as a wall). */
export const TEXT_LAYER_STEP = 0.4;

/** Most side layers one label gets. */
const MAX_TEXT_LAYERS = 32;

/**
 * sRGB factor on the side colour. Read off the Bird's Eye Scene export
 * (`gt/sa-014.webp`): white letters show walls around (164, 172, 175) under
 * a front face reading (245, 248, 249).
 */
export const TEXT_SIDE_SHADE = 0.69;

/** Stacked planes for one label. */
export interface SmartArt3DTextLayers {
	/** z of each side layer, back to front (world units, absolute). */
	sideZ: number[];
	/** z of the front copy. */
	frontZ: number;
	/** Side colour, `#rrggbb`. */
	sideColor: string;
}

function shadeHex(hex: string, factor: number): string {
	const match = /^#?([0-9a-f]{6})$/iu.exec(hex.trim());
	if (!match) {
		return hex;
	}
	const n = Number.parseInt(match[1], 16);
	const channel = (shift: number): string =>
		Math.round(((n >> shift) & 255) * factor)
			.toString(16)
			.padStart(2, '0');
	return `#${channel(16)}${channel(8)}${channel(0)}`;
}

/**
 * The stacked layers for an extruded label, or `undefined` when the label is
 * flat (no `extrusion`).
 */
export function smartArt3DTextLayers(block: SmartArt3DTextBlock): SmartArt3DTextLayers | undefined {
	const depth = block.extrusion ?? 0;
	if (!(depth > 0)) {
		return undefined;
	}
	const count = Math.max(1, Math.min(MAX_TEXT_LAYERS, Math.ceil(depth / TEXT_LAYER_STEP)));
	const sideZ: number[] = [];
	for (let i = 0; i < count; i++) {
		sideZ.push(block.z + (depth * i) / count);
	}
	return {
		sideZ,
		frontZ: block.z + depth,
		sideColor: shadeHex(block.extrusionColor ?? block.color, TEXT_SIDE_SHADE),
	};
}
