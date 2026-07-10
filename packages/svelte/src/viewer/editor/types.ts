/**
 * Shared value types for the Svelte editing layer.
 */

/** Box geometry in element (unscaled slide) px. */
export interface OverlayBox {
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
}
