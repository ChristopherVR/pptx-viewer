/**
 * Color XML round-trip preservation helpers.
 *
 * Save layer historically flattens every solidFill colour to
 * `<a:srgbClr val="…"/>`, throwing away `<a:schemeClr>`, `<a:sysClr>`,
 * `<a:prstClr>`, and colour transforms (`lumMod`, `lumOff`, `tint`,
 * `shade`, `satMod`, `alpha`, …). This breaks PowerPoint's *Recolor* /
 * *Reset to Theme* / Quick Styles for any shape this library has touched.
 *
 * Mirroring what {@link PptxGradientStyleCodec} already does for gradient
 * stops, parsers stash the original colour-choice XML on the parsed style.
 * On save, when the original is present and the resolved hex still matches
 * the original, we re-emit the original verbatim. When the user edited the
 * colour in memory, we fall back to canonical srgb (the pre-existing
 * behaviour).
 *
 * @module color-xml-preservation
 */

import type { XmlObject } from '../types';

/**
 * Recognised top-level colour choice element names (CT_Color / EG_ColorChoice).
 *
 * The order does not matter for extraction (only one will be present per
 * choice), but matches the most-common-first ordering for ergonomic reads.
 */
const COLOR_CHOICE_NAMES: readonly string[] = [
	'srgbClr',
	'schemeClr',
	'sysClr',
	'prstClr',
	'scrgbClr',
	'hslClr',
];

/**
 * Extract the inner colour-choice node from a parent that wraps one (e.g.
 * `<a:solidFill>`, `<a:fgClr>`, `<a:bgClr>`, gradient stop). Returns the
 * single-key wrapper object suitable for re-emitting verbatim.
 */
export function extractColorChoiceXml(parent: XmlObject | undefined): XmlObject | undefined {
	if (!parent) {
		return undefined;
	}
	for (const [key, value] of Object.entries(parent)) {
		if (COLOR_CHOICE_NAMES.includes(key.split(':').at(-1) ?? key)) {
			return { [key]: value } as XmlObject;
		}
	}
	return undefined;
}

/**
 * Normalise a hex string to upper-case 6-digit form without leading `#`.
 * Returns the raw lowered string when the input is not a recognised hex
 * (so two non-hex values still compare equal when literally equal).
 */
function normalizeHex(value: string | undefined): string {
	const raw = String(value ?? '').trim();
	if (raw.length === 0) {
		return '';
	}
	const hex = raw.replace(/^#/, '');
	if (/^[0-9a-fA-F]{6}$/.test(hex)) {
		return hex.toUpperCase();
	}
	return raw.toLowerCase();
}

/**
 * Compare two resolved colour values using normalised hex form.
 * Used to decide whether the original XML still represents the current
 * in-memory colour or whether the user edited it.
 */
export function colorsEqual(left: string | undefined, right: string | undefined): boolean {
	if (left === undefined || right === undefined) {
		return false;
	}
	return normalizeHex(left) === normalizeHex(right);
}

/**
 * Build a `<a:solidFill>`-shaped child object for a given hex colour, with
 * an optional `<a:alpha>` transform.
 */
export function buildSrgbColorChoice(hex: string, opacity?: number): XmlObject {
	const normalized = String(hex || '').replace(/^#/, '');
	const srgb: XmlObject = { '@_val': normalized };
	if (typeof opacity === 'number' && Number.isFinite(opacity) && opacity >= 0 && opacity < 1) {
		const alphaPct = Math.round(Math.max(0, Math.min(1, opacity)) * 100000);
		srgb['a:alpha'] = { '@_val': String(alphaPct) };
	}
	return { 'a:srgbClr': srgb };
}

export interface SerializeColorOptions {
	/**
	 * When true and an `originalColorXml` is being re-emitted, the optional
	 * `opacity` override is *ignored* — we trust the original XML's transforms
	 * (which may already contain `a:alpha`). When false, opacity is not
	 * applied either way (only the canonical fallback path uses opacity).
	 */
	readonly preserveAlphaFromOriginal?: boolean;
}

/**
 * Decide whether to re-emit the preserved original colour-choice XML or to
 * synthesise a fresh `<a:srgbClr>`.
 *
 * Behaviour:
 * - If `originalColorXml` is present *and* `currentResolvedHex` matches
 *   `fallbackHex`, return the original (verbatim — preserves scheme/sys/prst
 *   identity and all colour transforms).
 * - Otherwise return a fresh `<a:srgbClr val="…"/>` with optional `<a:alpha>`.
 *
 * Comparison uses a resolved-hex check (case-insensitive, `#` agnostic).
 * Callers are responsible for resolving `originalColorXml` through the
 * theme codec to produce `currentResolvedHex` — deep-object equality on
 * the XML would not survive theme switches.
 */
export function serializeColorChoice(
	originalColorXml: XmlObject | undefined,
	currentResolvedHex: string | undefined,
	fallbackHex: string,
	opacity?: number,
	options: SerializeColorOptions = {},
): XmlObject {
	if (originalColorXml && colorsEqual(currentResolvedHex, fallbackHex)) {
		// Re-emit verbatim. preserveAlphaFromOriginal trusts inner transforms.
		if (options.preserveAlphaFromOriginal !== false) {
			return originalColorXml;
		}
	}
	return buildSrgbColorChoice(fallbackHex, opacity);
}
