/**
 * Canvas Export Utilities
 *
 * Provides a safe wrapper around html2canvas that resolves modern CSS colour
 * functions (oklch, oklab, lch, lab, color()) into rgb()/hex before rendering.
 *
 * html2canvas ≤ 1.x includes its own CSS parser that cannot handle these
 * newer colour spaces, causing "Attempting to parse an unsupported color
 * function" errors.
 *
 * Modern Chrome (111+) returns oklch/oklab values from `getComputedStyle()`
 * rather than converting them to rgb, so simply re-setting computed values
 * as inline styles is *not* sufficient. Instead we convert every unsupported
 * colour value to sRGB via the Canvas 2D API (`ctx.fillStyle` always
 * serialises to `#rrggbb` or `rgba()`), then inline the result.
 *
 * Additionally, Tailwind CSS v4 declares all colour tokens as oklch() custom
 * properties on :root, so we patch `<style>` elements in the cloned document
 * to replace those definitions as well.
 *
 * CSS preprocessing: Beyond colour conversion, the onclone callback also
 * applies the full CSS preprocessing pipeline from css-preprocessing.ts
 * to flatten backdrop-filter, mix-blend-mode, 3D transforms, and other
 * CSS features that html2canvas cannot handle.
 */
import html2canvas, { type Options as Html2CanvasOptions } from "html2canvas";

import { preprocessCssForCapture } from "../viewer/utils/css-preprocessing";

/* ------------------------------------------------------------------ */
/*  Colour detection                                                  */
/* ------------------------------------------------------------------ */

/** Matches colour functions that html2canvas cannot parse. */
const UNSUPPORTED_COLOR_RE = /oklch|oklab|lch\(|lab\(|color\(/i;

/**
 * Matches full colour-function calls for regex replacement inside
 * complex CSS values (gradients, shadows, stylesheet text).
 * Handles one level of nested parentheses (e.g. `calc()` inside
 * colour functions).
 */
const UNSUPPORTED_COLOR_FN_RE =
  /(?:oklch|oklab|lch|lab|color)\([^)]*(?:\([^)]*\)[^)]*)*\)/gi;

/* ------------------------------------------------------------------ */
/*  Canvas 2D colour conversion                                      */
/* ------------------------------------------------------------------ */

/**
 * Lazily-created scratch Canvas 2D context.  The Canvas API always
 * serialises colours in sRGB, so any modern colour space round-trips
 * to `#rrggbb` (opaque) or `rgba(r,g,b,a)` (translucent).
 */
let _scratchCtx: CanvasRenderingContext2D | null | undefined;

function getScratchCtx(): CanvasRenderingContext2D | null {
  if (_scratchCtx === undefined) {
    _scratchCtx = document.createElement("canvas").getContext("2d");
  }
  return _scratchCtx;
}

/**
 * Convert a single CSS colour value to an sRGB hex or `rgba()` string.
 * Returns the original value unchanged when the input is invalid or the
 * Canvas API is unavailable.
 */
function resolveColorToSrgb(value: string): string {
  const ctx = getScratchCtx();
  if (!ctx) return value;

  const SENTINEL = "#020304";
  ctx.fillStyle = SENTINEL;
  ctx.fillStyle = value.trim();
  const result = ctx.fillStyle;
  // Canvas ignores invalid colours — fillStyle stays at the sentinel.
  return result === SENTINEL ? value : result;
}

/**
 * Replace every unsupported colour-function call inside an arbitrary
 * CSS value string (gradients, box-shadow, stylesheet text, …).
 */
function replaceUnsupportedColors(value: string): string {
  if (!UNSUPPORTED_COLOR_RE.test(value)) return value;
  return value.replace(UNSUPPORTED_COLOR_FN_RE, (match) =>
    resolveColorToSrgb(match),
  );
}

/* ------------------------------------------------------------------ */
/*  Property lists                                                    */
/* ------------------------------------------------------------------ */

/**
 * Simple colour properties whose computed value is a single colour.
 * We convert the entire value via `resolveColorToSrgb`.
 */
const COLOR_PROPERTIES: readonly string[] = [
  "color",
  "background-color",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "outline-color",
  "text-decoration-color",
  "column-rule-color",
  "caret-color",
  "accent-color",
  "text-emphasis-color",
  "fill",
  "stroke",
  "stop-color",
  "flood-color",
  "lighting-color",
] as const;

/**
 * Properties whose computed values may embed colour functions inside
 * more complex syntax (gradients, shadows, images).  We use regex
 * replacement within the value string.
 */
const COMPLEX_COLOR_PROPERTIES: readonly string[] = [
  "box-shadow",
  "text-shadow",
  "background-image",
  "background",
  "border-image",
] as const;

/* ------------------------------------------------------------------ */
/*  Walk the cloned DOM and convert colours to sRGB                   */
/* ------------------------------------------------------------------ */

/**
 * Walks every element inside `root` and converts any computed colour
 * value that uses an unsupported colour function into sRGB, then
 * inlines the result so html2canvas only sees rgb()/hex.
 */
function resolveUnsupportedColours(root: HTMLElement): void {
  const elements = root.querySelectorAll("*");

  const resolve = (el: Element) => {
    const htmlEl = el as HTMLElement;
    if (!htmlEl.style) return;

    const computed = window.getComputedStyle(htmlEl);

    // Simple colour properties — convert the whole value.
    for (const prop of COLOR_PROPERTIES) {
      const value = computed.getPropertyValue(prop);
      if (value && UNSUPPORTED_COLOR_RE.test(value)) {
        htmlEl.style.setProperty(prop, resolveColorToSrgb(value));
      }
    }

    // Complex properties — replace colour functions in-place.
    for (const prop of COMPLEX_COLOR_PROPERTIES) {
      const value = computed.getPropertyValue(prop);
      if (value && UNSUPPORTED_COLOR_RE.test(value)) {
        htmlEl.style.setProperty(prop, replaceUnsupportedColors(value));
      }
    }

    // CSS custom properties on this element (inline `--*` vars).
    const inlineStyle = htmlEl.style;
    for (let i = 0; i < inlineStyle.length; i++) {
      const prop = inlineStyle[i];
      if (!prop.startsWith("--")) continue;
      const value = inlineStyle.getPropertyValue(prop);
      if (value && UNSUPPORTED_COLOR_RE.test(value)) {
        inlineStyle.setProperty(prop, replaceUnsupportedColors(value));
      }
    }
  };

  resolve(root);
  elements.forEach(resolve);
}

/* ------------------------------------------------------------------ */
/*  CSS custom-property cleanup on <html> / <body> / :root            */
/* ------------------------------------------------------------------ */

/**
 * Tailwind v4 themes define colour tokens as oklch() on :root / <body>.
 * Resolve any inline custom properties whose values are unsupported
 * colour functions to sRGB equivalents.
 */
function resolveRootCustomProperties(doc: Document): void {
  const targets = [doc.documentElement, doc.body];

  for (const target of targets) {
    if (!target) continue;
    const inlineStyle = target.style;

    for (let i = 0; i < inlineStyle.length; i++) {
      const prop = inlineStyle[i];
      if (!prop.startsWith("--")) continue;

      const value = inlineStyle.getPropertyValue(prop);
      if (value && UNSUPPORTED_COLOR_RE.test(value)) {
        inlineStyle.setProperty(prop, replaceUnsupportedColors(value));
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Stylesheet patching                                               */
/* ------------------------------------------------------------------ */

/**
 * Patch `<style>` elements in the cloned document, replacing oklch()
 * and other unsupported colour-function calls with sRGB equivalents.
 *
 * This catches CSS custom-property declarations on :root (e.g. from
 * Tailwind v4's `--color-*` tokens) that are defined in stylesheets
 * and thus not reachable via `element.style`.
 */
function patchStylesheets(doc: Document): void {
  const styles = doc.querySelectorAll("style");
  for (const style of styles) {
    const text = style.textContent ?? "";
    if (!UNSUPPORTED_COLOR_RE.test(text)) continue;
    style.textContent = text.replace(UNSUPPORTED_COLOR_FN_RE, (match) =>
      resolveColorToSrgb(match),
    );
  }
}

/* ------------------------------------------------------------------ */
/*  Public API                                                        */
/* ------------------------------------------------------------------ */

/**
 * A drop-in replacement for `html2canvas(element, options)` that first
 * resolves any oklch / oklab / lch / lab / color() values in the cloned
 * DOM to rgb()/hex, preventing parse errors in html2canvas ≤ 1.x.
 *
 * Three-pronged approach:
 * 1. Patch `<style>` elements to replace oklch in CSS custom properties.
 * 2. Resolve `:root` / `<body>` inline custom properties.
 * 3. Walk every element and convert computed colour values to sRGB.
 *
 * Usage:
 * ```ts
 * import { renderToCanvas } from "../lib/canvas-export";
 * const canvas = await renderToCanvas(element, { scale: 2 });
 * ```
 */
export async function renderToCanvas(
  element: HTMLElement,
  options: Partial<Html2CanvasOptions> = {},
): Promise<HTMLCanvasElement> {
  const userOnClone = options.onclone;

  return html2canvas(element, {
    ...options,
    onclone: (doc: Document, clonedEl: HTMLElement) => {
      // Phase 1: Patch stylesheets and root custom properties (colour fix)
      patchStylesheets(doc);
      resolveRootCustomProperties(doc);
      resolveUnsupportedColours(clonedEl);

      // Phase 2: CSS preprocessing — flatten backdrop-filter, mix-blend-mode,
      // 3D transforms, and remove unsupported features
      preprocessCssForCapture(clonedEl);

      // Honour any caller-provided onclone as well.
      if (typeof userOnClone === "function") {
        userOnClone(doc, clonedEl);
      }
    },
  });
}
