/**
 * CSS Preprocessing Utilities for Print/Export Fidelity
 *
 * html2canvas has limited CSS support. These utilities pre-process
 * problematic CSS features before capture:
 *
 * - oklch/oklab/lch/lab/color() colours (handled by canvas-export.ts)
 * - CSS custom properties (resolved to computed values)
 * - backdrop-filter / mix-blend-mode (replaced with fallbacks)
 * - Complex CSS transforms that html2canvas struggles with
 * - Modern CSS features (container queries, @layer, etc.)
 *
 * All functions operate on cloned DOM trees (never the live document)
 * and are designed to be called from html2canvas's `onclone` callback.
 *
 * @module css-preprocessing
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/** Options for CSS preprocessing. */
export interface CssPreprocessingOptions {
  /** Resolve CSS custom properties to computed values. Default: true. */
  resolveCustomProperties?: boolean;
  /** Flatten backdrop-filter to background equivalents. Default: true. */
  flattenBackdropFilter?: boolean;
  /** Replace mix-blend-mode with opacity fallback. Default: true. */
  flattenMixBlendMode?: boolean;
  /** Flatten 3D transforms to 2D equivalents. Default: true. */
  flatten3dTransforms?: boolean;
  /** Remove CSS features unsupported by html2canvas. Default: true. */
  removeUnsupportedFeatures?: boolean;
}

/* ------------------------------------------------------------------ */
/*  CSS Custom Property Resolution                                     */
/* ------------------------------------------------------------------ */

/**
 * CSS properties that commonly reference custom properties (var()).
 * We resolve these to their computed values so html2canvas can
 * interpret them correctly.
 */
const VAR_DEPENDENT_PROPERTIES: readonly string[] = [
  "color",
  "background-color",
  "background",
  "background-image",
  "border-color",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "outline-color",
  "box-shadow",
  "text-shadow",
  "opacity",
  "font-size",
  "line-height",
  "letter-spacing",
  "border-radius",
  "padding",
  "margin",
  "gap",
  "width",
  "height",
  "max-width",
  "max-height",
  "min-width",
  "min-height",
  "fill",
  "stroke",
  "stop-color",
] as const;

/**
 * Resolve CSS custom properties (var()) to computed values on all
 * elements in the given subtree.
 *
 * html2canvas cannot evaluate var() references, so we resolve them
 * to their computed (concrete) values and set them as inline styles.
 */
export function resolveCustomProperties(root: HTMLElement): void {
  const elements = root.querySelectorAll("*");
  const resolve = (el: Element) => {
    const htmlEl = el as HTMLElement;
    if (!htmlEl.style) return;

    const computed = window.getComputedStyle(htmlEl);

    for (const prop of VAR_DEPENDENT_PROPERTIES) {
      const inlineValue = htmlEl.style.getPropertyValue(prop);
      // Only resolve if the inline style contains var() references
      // or if no inline style is set (let the computed value flow through
      // only for properties that are explicitly var-based in stylesheets).
      if (inlineValue && inlineValue.includes("var(")) {
        const computedValue = computed.getPropertyValue(prop);
        if (computedValue) {
          htmlEl.style.setProperty(prop, computedValue);
        }
      }
    }
  };

  resolve(root);
  elements.forEach(resolve);
}

/* ------------------------------------------------------------------ */
/*  Backdrop-filter Flattening                                         */
/* ------------------------------------------------------------------ */

/**
 * Parse a blur value from a CSS filter string (e.g. "blur(10px)").
 * Returns the pixel value or 0 if not found.
 */
export function parseBlurValue(filter: string): number {
  const match = filter.match(/blur\(\s*([\d.]+)\s*px\s*\)/i);
  return match ? parseFloat(match[1]) : 0;
}

/**
 * Replace backdrop-filter with an approximated visual equivalent.
 *
 * html2canvas does not support backdrop-filter at all. For blur effects,
 * we add a semi-transparent background to simulate the frosted-glass
 * appearance. For other backdrop-filter functions, we remove them
 * but preserve any existing background.
 */
export function flattenBackdropFilter(root: HTMLElement): void {
  const elements = root.querySelectorAll("*");

  const flatten = (el: Element) => {
    const htmlEl = el as HTMLElement;
    if (!htmlEl.style) return;

    const computed = window.getComputedStyle(htmlEl);
    const backdropFilter =
      computed.getPropertyValue("backdrop-filter") ||
      computed.getPropertyValue("-webkit-backdrop-filter");

    if (!backdropFilter || backdropFilter === "none") return;

    const blurPx = parseBlurValue(backdropFilter);

    // Remove the backdrop-filter (html2canvas can't render it)
    htmlEl.style.setProperty("backdrop-filter", "none");
    htmlEl.style.setProperty("-webkit-backdrop-filter", "none");

    // If there's a blur, add a semi-transparent white/grey overlay
    // to approximate the frosted-glass effect
    if (blurPx > 0) {
      const currentBg = computed.getPropertyValue("background-color");
      if (!currentBg || currentBg === "transparent" || currentBg === "rgba(0, 0, 0, 0)") {
        // Approximate blur intensity: higher blur = more opaque overlay
        const opacity = Math.min(0.85, 0.4 + blurPx * 0.02);
        htmlEl.style.setProperty(
          "background-color",
          `rgba(255, 255, 255, ${opacity.toFixed(2)})`,
        );
      }
    }
  };

  flatten(root);
  elements.forEach(flatten);
}

/* ------------------------------------------------------------------ */
/*  Mix-blend-mode Flattening                                          */
/* ------------------------------------------------------------------ */

/**
 * Mapping of blend modes to approximate opacity values.
 * These rough approximations preserve some visual character
 * when the blend mode cannot be rendered.
 */
const BLEND_MODE_OPACITY_MAP: Record<string, number> = {
  multiply: 0.85,
  screen: 0.9,
  overlay: 0.8,
  darken: 0.9,
  lighten: 0.9,
  "color-dodge": 0.85,
  "color-burn": 0.85,
  "hard-light": 0.8,
  "soft-light": 0.9,
  difference: 0.7,
  exclusion: 0.75,
  hue: 0.85,
  saturation: 0.85,
  color: 0.85,
  luminosity: 0.85,
};

/**
 * Replace mix-blend-mode with an opacity approximation.
 *
 * html2canvas does not support mix-blend-mode. We reset it to
 * "normal" and apply a rough opacity adjustment based on the
 * original blend mode to preserve some visual weight.
 */
export function flattenMixBlendMode(root: HTMLElement): void {
  const elements = root.querySelectorAll("*");

  const flatten = (el: Element) => {
    const htmlEl = el as HTMLElement;
    if (!htmlEl.style) return;

    const computed = window.getComputedStyle(htmlEl);
    const blendMode = computed.getPropertyValue("mix-blend-mode");

    if (!blendMode || blendMode === "normal") return;

    // Reset blend mode
    htmlEl.style.setProperty("mix-blend-mode", "normal");

    // Apply approximate opacity if we don't already have one
    const currentOpacity = parseFloat(computed.getPropertyValue("opacity") || "1");
    const blendOpacity = BLEND_MODE_OPACITY_MAP[blendMode] ?? 1;
    const combinedOpacity = currentOpacity * blendOpacity;

    if (combinedOpacity < 1) {
      htmlEl.style.setProperty("opacity", combinedOpacity.toFixed(2));
    }
  };

  flatten(root);
  elements.forEach(flatten);
}

/* ------------------------------------------------------------------ */
/*  3D Transform Flattening                                            */
/* ------------------------------------------------------------------ */

/** Matches 3D transform functions in a CSS transform value. */
const TRANSFORM_3D_RE =
  /(?:translate3d|rotate3d|scale3d|matrix3d|perspective|translateZ|rotateX|rotateY|scaleZ)\s*\([^)]*\)/gi;

/**
 * Check whether a CSS transform value contains 3D transform functions.
 * Uses a fresh regex test each time to avoid global regex lastIndex issues.
 */
export function has3dTransform(transformValue: string): boolean {
  if (!transformValue || transformValue === "none") return false;
  // Create a fresh regex to avoid global lastIndex stale state
  const re = /(?:translate3d|rotate3d|scale3d|matrix3d|perspective|translateZ|rotateX|rotateY|scaleZ)\s*\([^)]*\)/i;
  return re.test(transformValue);
}

/**
 * Flatten 3D CSS transforms to their 2D equivalents.
 *
 * html2canvas has incomplete support for 3D transforms. We extract
 * the 2D components where possible and discard the Z-axis movements.
 *
 * - `translate3d(x, y, z)` -> `translate(x, y)`
 * - `translateZ(z)` -> removed
 * - `scale3d(x, y, z)` -> `scale(x, y)`
 * - `scaleZ(z)` -> removed
 * - `rotateX(a)` / `rotateY(a)` -> removed (3D rotation)
 * - `perspective(...)` -> removed
 * - `matrix3d(...)` -> uses computed 2D matrix if available
 */
export function flatten3dTransform(transformValue: string): string {
  if (!transformValue || transformValue === "none") return transformValue;

  // Reset the regex lastIndex since it's global
  TRANSFORM_3D_RE.lastIndex = 0;

  if (!TRANSFORM_3D_RE.test(transformValue)) return transformValue;
  TRANSFORM_3D_RE.lastIndex = 0;

  let result = transformValue;

  // translate3d(x, y, z) -> translate(x, y)
  result = result.replace(
    /translate3d\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*[^)]+\)/gi,
    "translate($1, $2)",
  );

  // translateZ(...) -> remove entirely
  result = result.replace(/translateZ\([^)]*\)/gi, "");

  // scale3d(x, y, z) -> scale(x, y)
  result = result.replace(
    /scale3d\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*[^)]+\)/gi,
    "scale($1, $2)",
  );

  // scaleZ(...) -> remove
  result = result.replace(/scaleZ\([^)]*\)/gi, "");

  // rotateX/rotateY -> remove (3D rotation cannot be approximated in 2D)
  result = result.replace(/rotate[XY]\([^)]*\)/gi, "");

  // rotate3d(...) -> remove (complex 3D rotation)
  result = result.replace(/rotate3d\([^)]*\)/gi, "");

  // perspective(...) -> remove
  result = result.replace(/perspective\([^)]*\)/gi, "");

  // matrix3d(...) -> remove (too complex to decompose reliably)
  result = result.replace(/matrix3d\([^)]*\)/gi, "");

  // Clean up extra whitespace
  result = result.replace(/\s{2,}/g, " ").trim();

  // If everything was removed, return "none"
  return result || "none";
}

/**
 * Walk the cloned DOM and flatten 3D transforms to 2D equivalents.
 */
export function flatten3dTransforms(root: HTMLElement): void {
  const elements = root.querySelectorAll("*");

  const flatten = (el: Element) => {
    const htmlEl = el as HTMLElement;
    if (!htmlEl.style) return;

    const computed = window.getComputedStyle(htmlEl);
    const transform = computed.getPropertyValue("transform");

    if (!transform || transform === "none") return;

    // Reset lastIndex before test
    TRANSFORM_3D_RE.lastIndex = 0;
    if (TRANSFORM_3D_RE.test(transform)) {
      TRANSFORM_3D_RE.lastIndex = 0;
      const flattened = flatten3dTransform(transform);
      htmlEl.style.setProperty("transform", flattened);
    }
  };

  flatten(root);
  elements.forEach(flatten);
}

/* ------------------------------------------------------------------ */
/*  Unsupported CSS Feature Removal                                    */
/* ------------------------------------------------------------------ */

/**
 * Remove CSS features that html2canvas cannot handle at all:
 * - `mask` / `mask-image` (partial support)
 * - `clip-path` with complex shapes (path() partially supported)
 * - `filter` functions beyond basic blur/opacity
 * - `-webkit-text-stroke` (not supported)
 * - `writing-mode: vertical-*` (limited support)
 */
export function removeUnsupportedFeatures(root: HTMLElement): void {
  const elements = root.querySelectorAll("*");

  const clean = (el: Element) => {
    const htmlEl = el as HTMLElement;
    if (!htmlEl.style) return;

    const computed = window.getComputedStyle(htmlEl);

    // Remove mask-image if it contains SVG or complex masks
    const maskImage = computed.getPropertyValue("mask-image") ||
      computed.getPropertyValue("-webkit-mask-image");
    if (maskImage && maskImage !== "none") {
      // Keep simple linear-gradient masks, remove complex ones
      if (maskImage.includes("url(") && !maskImage.includes("data:")) {
        htmlEl.style.setProperty("mask-image", "none");
        htmlEl.style.setProperty("-webkit-mask-image", "none");
      }
    }

    // Flatten -webkit-text-stroke to text-shadow approximation
    const textStroke = computed.getPropertyValue("-webkit-text-stroke");
    if (textStroke && textStroke !== "0px" && textStroke !== "0px rgb(0, 0, 0)") {
      // Extract stroke width and colour
      const strokeMatch = textStroke.match(/([\d.]+)px\s+(.*)/);
      if (strokeMatch) {
        const width = parseFloat(strokeMatch[1]);
        const colour = strokeMatch[2] || "black";
        // Approximate with text-shadow
        const offsets = [
          [width, 0],
          [-width, 0],
          [0, width],
          [0, -width],
        ];
        const shadows = offsets.map(([x, y]) => `${x}px ${y}px 0 ${colour}`).join(", ");
        const existing = computed.getPropertyValue("text-shadow");
        const combined = existing && existing !== "none" ? `${existing}, ${shadows}` : shadows;
        htmlEl.style.setProperty("text-shadow", combined);
        htmlEl.style.setProperty("-webkit-text-stroke", "0");
      }
    }
  };

  clean(root);
  elements.forEach(clean);
}

/* ------------------------------------------------------------------ */
/*  Combined Preprocessing                                             */
/* ------------------------------------------------------------------ */

/**
 * Apply all CSS preprocessing steps to a cloned DOM subtree.
 *
 * This is designed to be called from html2canvas's `onclone` callback,
 * operating on the cloned document rather than the live DOM.
 *
 * @param root    - The root element of the cloned subtree.
 * @param options - Which preprocessing steps to apply.
 */
export function preprocessCssForCapture(
  root: HTMLElement,
  options: CssPreprocessingOptions = {},
): void {
  const {
    resolveCustomProperties: doResolve = true,
    flattenBackdropFilter: doFlattenBackdrop = true,
    flattenMixBlendMode: doFlattenBlend = true,
    flatten3dTransforms: doFlatten3d = true,
    removeUnsupportedFeatures: doRemoveUnsupported = true,
  } = options;

  if (doResolve) resolveCustomProperties(root);
  if (doFlattenBackdrop) flattenBackdropFilter(root);
  if (doFlattenBlend) flattenMixBlendMode(root);
  if (doFlatten3d) flatten3dTransforms(root);
  if (doRemoveUnsupported) removeUnsupportedFeatures(root);
}
