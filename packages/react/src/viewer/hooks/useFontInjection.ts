import type { PptxEmbeddedFont, PptxSlide } from 'pptx-viewer-core';
import { collectReferencedFontFamilies, resolveGoogleWebfontHref } from 'pptx-viewer-shared';
/**
 * useFontInjection: Injects @font-face declarations for embedded PPTX fonts
 * and loads Google Fonts fallbacks for referenced families the API serves.
 */
import { useEffect, useMemo } from 'react';

/* ------------------------------------------------------------------ */
/*  Style element ID constants                                        */
/* ------------------------------------------------------------------ */

const EMBEDDED_FONTS_STYLE_ID = 'pptx-embedded-fonts';
const GOOGLE_FONTS_LINK_ID = 'pptx-google-fonts';
const SYMBOL_FONTS_STYLE_ID = 'pptx-symbol-font-fallback';

/**
 * Symbol / dingbat fonts that are not available on Google Fonts.
 * On systems where these fonts are not installed we emit an @font-face
 * declaration using `local()` sources so the browser falls back gracefully.
 */
const SYMBOL_FONT_FAMILIES: readonly string[] = [
	'Wingdings',
	'Wingdings 2',
	'Wingdings 3',
	'Symbol',
	'Webdings',
] as const;

/* ------------------------------------------------------------------ */
/*  Hook                                                              */
/* ------------------------------------------------------------------ */

export interface UseFontInjectionInput {
	embeddedFonts: PptxEmbeddedFont[];
	slides: PptxSlide[];
}

/**
 * Injects `@font-face` declarations for embedded fonts and
 * `<link>` tags for Google Fonts fallbacks into `document.head`.
 *
 * Cleans up on unmount or when the font list changes.
 */
// PPTX-supplied font names, dataUrls, and format identifiers flow into a
// <style> textContent that the browser parses as CSS. Without validation,
// a hostile PPTX can break out of the @font-face rule via `"; }` and inject
// global selectors that exfiltrate data via `url()` or deface the page.
const FONT_NAME_UNSAFE_CHARS = /["\\\n\r;}<>]/u;
const FONT_FORMAT_ALLOWED = new Set([
	'truetype',
	'opentype',
	'woff',
	'woff2',
	'svg',
	'embedded-opentype',
]);
const FONT_DATA_URL_PATTERN =
	/^data:font\/[a-z0-9+.-]+(?:;charset=[a-z0-9-]+)?;base64,[A-Za-z0-9+/=]+$/iu;
function isFontDataUrlSafe(url: string): boolean {
	if (typeof url !== 'string' || url.length === 0) {
		return false;
	}
	if (url.startsWith('blob:')) {
		return true;
	}
	return FONT_DATA_URL_PATTERN.test(url);
}

export function useFontInjection({ embeddedFonts, slides }: UseFontInjectionInput): void {
	// ── Inject @font-face for embedded fonts ─────────────────────────
	useEffect(() => {
		if (!embeddedFonts.length) {
			return;
		}

		const styleEl = document.createElement('style');
		styleEl.id = EMBEDDED_FONTS_STYLE_ID;

		const cssRules = embeddedFonts
			.flatMap((font) => {
				// Reject fonts whose name, dataUrl, or format would let the value
				// escape the @font-face block and inject arbitrary CSS rules.
				if (
					typeof font.name !== 'string' ||
					font.name.length === 0 ||
					FONT_NAME_UNSAFE_CHARS.test(font.name)
				) {
					return [];
				}
				if (!isFontDataUrlSafe(font.dataUrl)) {
					return [];
				}
				const fontFormat = font.format ?? 'truetype';
				if (!FONT_FORMAT_ALLOWED.has(fontFormat)) {
					return [];
				}
				const fontWeight = font.bold ? '700' : '400';
				const fontStyleCss = font.italic ? 'italic' : 'normal';
				return [
					`@font-face {
	font-family: "${font.name}";
	src: url("${font.dataUrl}") format("${fontFormat}");
	font-weight: ${fontWeight};
	font-style: ${fontStyleCss};
	font-display: swap;
}`,
				];
			})
			.join('\n');

		styleEl.textContent = cssRules;
		document.head.appendChild(styleEl);

		return () => {
			const existing = document.getElementById(EMBEDDED_FONTS_STYLE_ID);
			if (existing) {
				document.head.removeChild(existing);
			}
		};
	}, [embeddedFonts]);

	// ── Inject Google Fonts fallback <link> for missing fonts ────────
	const referencedFamilies = useMemo(() => collectReferencedFontFamilies(slides), [slides]);

	useEffect(() => {
		// Embedded fonts satisfy their own families and locally installed ones
		// render as-is; the rest are probed against the Google Fonts API
		// (session-cached). The shared resolver also skips the local-install
		// check for already-probed families, so a webfont that has loaded is
		// not mistaken for an installed one and dropped on the next pass.
		let cancelled = false;
		void resolveGoogleWebfontHref(slides, embeddedFonts).then((href) => {
			if (cancelled) {
				return null;
			}
			if (!href || document.getElementById(GOOGLE_FONTS_LINK_ID)) {
				return null;
			}
			const linkEl = document.createElement('link');
			linkEl.id = GOOGLE_FONTS_LINK_ID;
			linkEl.rel = 'stylesheet';
			linkEl.href = href;
			document.head.appendChild(linkEl);
			return href;
		});

		return () => {
			cancelled = true;
			const existing = document.getElementById(GOOGLE_FONTS_LINK_ID);
			if (existing) {
				document.head.removeChild(existing);
			}
		};
	}, [embeddedFonts, slides]);

	// ── Wingdings and symbol font fallback ────────────────────────
	useEffect(() => {
		const neededSymbolFonts = SYMBOL_FONT_FAMILIES.filter((f) => referencedFamilies.has(f));
		if (neededSymbolFonts.length === 0) {
			return;
		}

		const styleEl = document.createElement('style');
		styleEl.id = SYMBOL_FONTS_STYLE_ID;
		// Provide CSS that ensures these fonts fall back gracefully.
		// On systems where these fonts aren't installed, the local()
		// sources will miss and the browser uses its default sans.
		const rules = neededSymbolFonts
			.flatMap((font) => {
				// SYMBOL_FONT_FAMILIES is a hard-coded constant today, but defending
				// the interpolation site means future additions sourced from PPTX
				// can't sneak in a CSS-injection payload.
				if (typeof font !== 'string' || FONT_NAME_UNSAFE_CHARS.test(font)) {
					return [];
				}
				return [
					`@font-face {
\tfont-family: "${font}";
\tsrc: local("${font}"), local("${font} Regular");
\tfont-display: swap;
}`,
				];
			})
			.join('\n');

		styleEl.textContent = rules;
		document.head.appendChild(styleEl);

		return () => {
			const existing = document.getElementById(SYMBOL_FONTS_STYLE_ID);
			if (existing) {
				document.head.removeChild(existing);
			}
		};
	}, [referencedFamilies]);
}
