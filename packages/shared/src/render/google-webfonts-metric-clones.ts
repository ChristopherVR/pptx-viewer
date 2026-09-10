/**
 * google-webfonts-metric-clones.ts: which Google-Fonts-hosted family is a
 * VERIFIED metric-compatible clone of a font Google Fonts does not serve
 * under its own name.
 *
 * Split out of `google-webfonts.ts` (see that file's module doc comment for
 * why this exists) so both files stay under this repo's ~300-line-per-file
 * convention.
 *
 * @module render/google-webfonts-metric-clones
 */
import { findGoogleFontsFamily } from './google-fonts-lookup';

/**
 * Office/system font -> its VERIFIED metric-compatible clone, restricted to
 * the pairs actually built by copying the original's advance-width table
 * (the "metric-compatible font" projects: Carlito/Caladea for
 * LibreOffice/Calibri/Cambria, Arimo/Tinos/Cousine for
 * Chrome-OS/Arial/Times-New-Roman/Courier-New, Gelasio for Georgia). This is
 * intentionally narrower than `getSubstituteFonts`'s (`pptx-viewer-core`)
 * full CSS fallback chain: that chain also lists merely visually-similar
 * fonts further down (e.g. Segoe UI falling through to "Arimo" as a generic
 * sans), which would silently claim a metrics match this module cannot
 * verify. Aptos maps to Carlito (via Calibri) because Aptos was designed
 * with Calibri-close metrics; the measured per-glyph error against the real,
 * COM-measured Aptos advance table is the smallest among every candidate
 * this repo has real measurements for (see `font-substitution.test.ts`'s
 * "aptos metric-compatible match" suite).
 */
const METRIC_COMPATIBLE_CLONES: Readonly<Record<string, string>> = {
	Calibri: 'Carlito',
	'Calibri Light': 'Carlito',
	Cambria: 'Caladea',
	Aptos: 'Carlito',
	'Aptos Display': 'Carlito',
	'Aptos Narrow': 'Carlito',
	'Aptos Serif': 'Caladea',
	Arial: 'Arimo',
	'Arial Black': 'Arimo',
	'Arial Narrow': 'Arimo',
	Helvetica: 'Arimo',
	'Helvetica Neue': 'Arimo',
	'Times New Roman': 'Tinos',
	'Courier New': 'Cousine',
	Georgia: 'Gelasio',
};

/**
 * The Google-Fonts-catalogue family to request for `family` when `family`
 * itself is not served under its own name: its verified metric-compatible
 * clone ({@link METRIC_COMPATIBLE_CLONES}), if the catalogue serves it, or
 * `null` when `family` is itself servable (no substitute needed) or has no
 * verified clone on the catalogue (e.g. Segoe UI's match, Selawik, is not on
 * Google Fonts; see `google-webfonts.ts`'s module doc comment).
 *
 * Loading the substitute rather than the deck's own name is what makes text
 * line breaks and extents match PowerPoint even though the exact family is
 * unavailable: `getSubstituteFontFamily` (`pptx-viewer-core`) already lists
 * this same family second in the CSS `font-family` chain (right after the
 * deck font), so once it is loaded the browser measures text with matching
 * advance widths.
 */
export function findMetricCompatibleGoogleFontsFamily(family: string): string | null {
	if (findGoogleFontsFamily(family) !== null) {
		return null;
	}
	const clone = METRIC_COMPATIBLE_CLONES[family.trim()];
	return clone ? findGoogleFontsFamily(clone) : null;
}
