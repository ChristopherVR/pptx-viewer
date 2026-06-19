/**
 * Colour helpers for the CSS-based 3D approximation (framework-agnostic).
 *
 * @module render/visual-3d-color
 */

/**
 * Darken a hex colour by a factor (0 = black, 1 = unchanged).
 * Used for the deepest extrusion layers and side faces to create a depth
 * gradient.
 */
export function darkenColor(hex: string, factor: number): string {
	const clean = hex.replace('#', '');
	const r = Math.round(parseInt(clean.slice(0, 2), 16) * factor);
	const g = Math.round(parseInt(clean.slice(2, 4), 16) * factor);
	const b = Math.round(parseInt(clean.slice(4, 6), 16) * factor);
	return `rgb(${r},${g},${b})`;
}
