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
/** Colour PowerPoint paints hyperlinked text in when the theme declares none. */
export const HYPERLINK_COLOR = '#0563C1';

/**
 * Font stack declared on a text body that authors no typeface.
 *
 * Declaring one is not cosmetic: with no `font-family` on the body, a run that
 * inherits (a bullet marker, an unstyled run) picks up the HOST PAGE's font,
 * so the same deck measured different advances in each binding's demo chrome.
 */
export const DEFAULT_FONT_FAMILY = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';
/** Font size in px for a text body that authors none (PowerPoint's 18pt body). */
export const DEFAULT_TEXT_FONT_SIZE = 24;

/**
 * OOXML default body text insets in px (`a:bodyPr` lIns/rIns = 91440 EMU,
 * tIns/bIns = 45720 EMU, divided by EMU_PER_PIXEL).
 */
export const DEFAULT_BODY_INSET_LR_PX = 91440 / 9525;
/** See {@link DEFAULT_BODY_INSET_LR_PX}. */
export const DEFAULT_BODY_INSET_TB_PX = 45720 / 9525;
