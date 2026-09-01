/**
 * Presentation-mode ink-annotation overlay helpers (pen / highlighter /
 * eraser / laser).
 *
 * React, Vue and Angular each carried a byte-identical `buildPathD`/
 * `getCursorForTool` pair (Angular's copy, already framework-free in
 * `presentation-annotations-helpers.ts`, additionally names them
 * `buildStrokePathD`/`cursorForTool` - the names this module keeps). This is
 * the one copy of the two pure functions; each binding's own annotation
 * overlay/composable/service can import them instead of redefining them.
 *
 * @module render/annotation-overlay
 */

/** A single {x, y} coordinate in slide-space pixels. */
export interface AnnotationOverlayPoint {
	x: number;
	y: number;
}

/** The tool currently armed in the presentation annotation overlay. */
export type AnnotationOverlayTool = 'none' | 'pen' | 'highlighter' | 'eraser' | 'laser';

/**
 * Build the SVG path `d` attribute for a polyline of stroke points, using
 * `M`/`L` commands (no bezier smoothing). Returns an empty string for an
 * empty point array.
 *
 * @example
 * buildStrokePathD([{x:0,y:0},{x:10,y:5}]) // "M 0 0 L 10 5"
 */
export function buildStrokePathD(points: readonly AnnotationOverlayPoint[]): string {
	if (points.length === 0) {
		return '';
	}
	const first = points[0]!;
	let d = `M ${first.x} ${first.y}`;
	for (let i = 1; i < points.length; i++) {
		const pt = points[i]!;
		d += ` L ${pt.x} ${pt.y}`;
	}
	return d;
}

/** Return the CSS `cursor` value that matches the armed annotation `tool`. */
export function cursorForTool(tool: AnnotationOverlayTool): string {
	switch (tool) {
		case 'laser':
			return 'none';
		case 'pen':
		case 'highlighter':
		case 'eraser':
			return 'crosshair';
		default:
			return 'default';
	}
}
