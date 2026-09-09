/**
 * Split out of `smartart-layout-shape-preset.ts` (which was pushing past the
 * repo's per-file line budget once `roundRectCornerInsetPx` landed): SVG
 * polygon point-list construction for the interpreter's `polygon`-kind
 * preset shapes. Re-exported from the split-from file so no caller's import
 * path changes.
 *
 * @module smartart-layout-shape-polygon
 */

import { chevronPoints } from './smartart-layout-style-helpers';

/**
 * Build SVG polygon `points` for a preset geometry inscribed in the box
 * `[x, y, w, h]`. Falls back to a plain rectangle outline (4 corners) for an
 * unrecognised polygon preset, so the item still renders something
 * reasonable rather than nothing.
 */
export function presetPolygonPoints(
	preset: string | undefined,
	x: number,
	y: number,
	w: number,
	h: number,
): string {
	switch (preset) {
		case 'chevron':
		case 'homePlate':
			return chevronPoints(x, y, w, h);
		case 'triangle':
			return `${x + w / 2},${y} ${x + w},${y + h} ${x},${y + h}`;
		case 'diamond':
			return `${x + w / 2},${y} ${x + w},${y + h / 2} ${x + w / 2},${y + h} ${x},${y + h / 2}`;
		case 'trapezoid': {
			const inset = w * 0.15;
			return `${x + inset},${y} ${x + w - inset},${y} ${x + w},${y + h} ${x},${y + h}`;
		}
		case 'nonIsoscelesTrapezoid': {
			const inset = w * 0.2;
			return `${x + inset},${y} ${x + w},${y} ${x + w - inset * 0.5},${y + h} ${x},${y + h}`;
		}
		case 'hexagon': {
			const inset = Math.min(w * 0.25, h * 0.5);
			return (
				`${x + inset},${y} ${x + w - inset},${y} ${x + w},${y + h / 2} ` +
				`${x + w - inset},${y + h} ${x + inset},${y + h} ${x},${y + h / 2}`
			);
		}
		case 'pentagon':
			return (
				`${x + w / 2},${y} ${x + w},${y + h * 0.38} ${x + w * 0.82},${y + h} ` +
				`${x + w * 0.18},${y + h} ${x},${y + h * 0.38}`
			);
		case 'parallelogram': {
			const shift = w * 0.2;
			return `${x + shift},${y} ${x + w},${y} ${x + w - shift},${y + h} ${x},${y + h}`;
		}
		case 'octagon': {
			const inset = Math.min(w, h) * 0.25;
			return (
				`${x + inset},${y} ${x + w - inset},${y} ${x + w},${y + inset} ` +
				`${x + w},${y + h - inset} ${x + w - inset},${y + h} ${x + inset},${y + h} ` +
				`${x},${y + h - inset} ${x},${y + inset}`
			);
		}
		default:
			return `${x},${y} ${x + w},${y} ${x + w},${y + h} ${x},${y + h}`;
	}
}
