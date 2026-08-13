/**
 * Auto-numbering helpers for paragraph bullets (framework-agnostic).
 *
 * Numbering schemes follow the OOXML `ST_TextAutonumberScheme` enumeration
 * (ECMA-376 §20.1.10.61). The implementation lives in `pptx-viewer-core`
 * (`core/utils/auto-number-format`) because the LOAD path needs the identical
 * string: core stamps the marker onto the parsed bullet segment and the
 * renderer resolves it again from `BulletInfo`, and the paragraph builder drops
 * core's segment only when the two agree. While this module carried its own
 * table the two disagreed for every East-Asian / Thai / Hindi / Hebrew scheme
 * and painted a DOUBLE marker (`一.1. Item`). Core is the only package both
 * sides can depend on (shared already depends on core; the reverse would be a
 * cycle), so it owns the single copy and this module re-exports it.
 */

export {
	/** Render the n-th (1-based) marker for an OOXML auto-numbering scheme. */
	formatAutoNumberMarker as formatAutoNumber,
	/** Convert a positive integer to an upper-case Roman numeral. */
	romanNumeral,
	/** Convert a positive integer to a lower-case spreadsheet-style label. */
	alphaLabel,
	/** Every `ST_TextAutonumberScheme` value, in schema order. */
	TEXT_AUTONUMBER_SCHEMES,
} from 'pptx-viewer-core';
