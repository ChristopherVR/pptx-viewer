/**
 * Scalar viewer defaults shared by the UI bindings.
 *
 * Subset of the React package's `constants/scalar.ts` that the Vue and Angular
 * viewers also need. Additional constant groups (toolbar presets, shape styles,
 * transitions, etc.) remain per-binding until those features are ported.
 */

/** Default slide canvas width in pixels when the file declares none. */
export const DEFAULT_CANVAS_WIDTH = 1280;
/** Default slide canvas height in pixels when the file declares none. */
export const DEFAULT_CANVAS_HEIGHT = 720;

/** Fallback text colour. */
export const DEFAULT_TEXT_COLOR = '#111827';
/** Fallback shape fill colour. */
export const DEFAULT_FILL_COLOR = '#3b82f6';
/** Fallback shape stroke colour. */
export const DEFAULT_STROKE_COLOR = '#1f2937';
