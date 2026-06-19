/**
 * Shared constants for the CSS-based 3D approximation (framework-agnostic).
 *
 * @module render/visual-3d-constants
 */

/**
 * EMU per CSS pixel. PowerPoint stores 3D dimensions in English Metric Units;
 * the React layer uses the same constant (9525). Defined locally to keep the
 * 3D modules self-contained.
 */
export const EMU_PER_PX = 9525;

/**
 * Maximum stacked shadow layers for extrusion (performance guard). Matches the
 * React engine — each layer is a single box-shadow, so 40 is still performant.
 */
export const MAX_EXTRUSION_LAYERS = 40;
