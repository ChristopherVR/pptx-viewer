/**
 * useFontInjection — Injects @font-face declarations for embedded PPTX fonts
 * and loads Google Fonts fallbacks for well-known font families.
 */
import { useEffect, useMemo } from "react";

import type { PptxEmbeddedFont, PptxSlide } from "pptx-viewer-core";
import { hasTextProperties } from "pptx-viewer-core";

/* ------------------------------------------------------------------ */
/*  Google Fonts fallback map                                         */
/* ------------------------------------------------------------------ */

/**
 * Map of font families known to be available on Google Fonts.
 * Values are the URL query parameter fragments for the Google Fonts CSS API.
 */
const GOOGLE_FONTS_AVAILABLE: Record<string, string> = {
  "Atkinson Hyperlegible": "Atkinson+Hyperlegible:wght@400;700",
  Roboto: "Roboto:wght@400;700",
  "Open Sans": "Open+Sans:wght@400;700",
  Lato: "Lato:wght@400;700",
  Montserrat: "Montserrat:wght@400;700",
  Poppins: "Poppins:wght@400;700",
  Raleway: "Raleway:wght@400;700",
  Nunito: "Nunito:wght@400;700",
  "Playfair Display": "Playfair+Display:wght@400;700",
  "Source Sans Pro": "Source+Sans+Pro:wght@400;700",
  "PT Sans": "PT+Sans:wght@400;700",
  Merriweather: "Merriweather:wght@400;700",
  Ubuntu: "Ubuntu:wght@400;700",
  Oswald: "Oswald:wght@400;700",
  "Noto Sans": "Noto+Sans:wght@400;700",
  "Fira Sans": "Fira+Sans:wght@400;700",
  Inter: "Inter:wght@400;700",
  "Work Sans": "Work+Sans:wght@400;700",
  Quicksand: "Quicksand:wght@400;700",
  Cabin: "Cabin:wght@400;700",
};

/* ------------------------------------------------------------------ */
/*  Style element ID constants                                        */
/* ------------------------------------------------------------------ */

const EMBEDDED_FONTS_STYLE_ID = "pptx-embedded-fonts";
const GOOGLE_FONTS_LINK_ID = "pptx-google-fonts";
const SYMBOL_FONTS_STYLE_ID = "pptx-symbol-font-fallback";

/**
 * Symbol / dingbat fonts that are not available on Google Fonts.
 * On systems where these fonts are not installed we emit an @font-face
 * declaration using `local()` sources so the browser falls back gracefully.
 */
const SYMBOL_FONT_FAMILIES: readonly string[] = [
  "Wingdings",
  "Wingdings 2",
  "Wingdings 3",
  "Symbol",
  "Webdings",
] as const;

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/**
 * Collect all unique font family names referenced across all slide
 * elements' text segments.
 */
function collectReferencedFontFamilies(slides: PptxSlide[]): Set<string> {
  const families = new Set<string>();
  for (const slide of slides) {
    for (const el of slide.elements) {
      if (hasTextProperties(el) && el.textSegments) {
        for (const seg of el.textSegments) {
          if (seg.style.fontFamily) {
            families.add(seg.style.fontFamily);
          }
        }
      }
    }
  }
  return families;
}

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
export function useFontInjection({
  embeddedFonts,
  slides,
}: UseFontInjectionInput): void {
  // ── Inject @font-face for embedded fonts ─────────────────────────
  useEffect(() => {
    if (!embeddedFonts.length) return;

    const styleEl = document.createElement("style");
    styleEl.id = EMBEDDED_FONTS_STYLE_ID;

    const cssRules = embeddedFonts
      .map((font) => {
        const fontWeight = font.bold ? "700" : "400";
        const fontStyleCss = font.italic ? "italic" : "normal";
        const fontFormat = font.format ?? "truetype";
        return `@font-face {
	font-family: "${font.name}";
	src: url("${font.dataUrl}") format("${fontFormat}");
	font-weight: ${fontWeight};
	font-style: ${fontStyleCss};
	font-display: swap;
}`;
      })
      .join("\n");

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
  const referencedFamilies = useMemo(
    () => collectReferencedFontFamilies(slides),
    [slides],
  );

  useEffect(() => {
    // Font families that were embedded in the PPTX
    const embeddedFamilies = new Set(embeddedFonts.map((f) => f.name));

    // Find font families referenced in slides that are NOT embedded
    // but ARE available on Google Fonts
    const googleFamilies: string[] = [];
    for (const family of referencedFamilies) {
      if (embeddedFamilies.has(family)) continue;
      if (GOOGLE_FONTS_AVAILABLE[family]) {
        googleFamilies.push(family);
      }
    }

    if (googleFamilies.length === 0) return;

    const linkEl = document.createElement("link");
    linkEl.id = GOOGLE_FONTS_LINK_ID;
    linkEl.rel = "stylesheet";
    linkEl.href = `https://fonts.googleapis.com/css2?${googleFamilies.map((f) => `family=${GOOGLE_FONTS_AVAILABLE[f]}`).join("&")}&display=swap`;
    document.head.appendChild(linkEl);

    return () => {
      const existing = document.getElementById(GOOGLE_FONTS_LINK_ID);
      if (existing) {
        document.head.removeChild(existing);
      }
    };
  }, [embeddedFonts, referencedFamilies]);

  // ── Wingdings and symbol font fallback ────────────────────────
  useEffect(() => {
    const neededSymbolFonts = SYMBOL_FONT_FAMILIES.filter((f) =>
      referencedFamilies.has(f),
    );
    if (neededSymbolFonts.length === 0) return;

    const styleEl = document.createElement("style");
    styleEl.id = SYMBOL_FONTS_STYLE_ID;
    // Provide CSS that ensures these fonts fall back gracefully.
    // On systems where these fonts aren't installed, the local()
    // sources will miss and the browser uses its default sans.
    const rules = neededSymbolFonts
      .map(
        (font) => `@font-face {
\tfont-family: "${font}";
\tsrc: local("${font}"), local("${font} Regular");
\tfont-display: swap;
}`,
      )
      .join("\n");

    styleEl.textContent = rules;
    document.head.appendChild(styleEl);

    return () => {
      const existing = document.getElementById(SYMBOL_FONTS_STYLE_ID);
      if (existing) document.head.removeChild(existing);
    };
  }, [referencedFamilies]);
}
