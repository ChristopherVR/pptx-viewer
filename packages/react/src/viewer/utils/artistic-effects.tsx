/**
 * Artistic effects rendering — SVG filter definitions for complex effects
 * that cannot be adequately approximated with CSS filters alone.
 *
 * For simple effects (blur, grayscale, contrast, brightness, saturate),
 * CSS `filter` is used directly. For complex effects (film grain, cutout,
 * mosaic, cement texture, etc.), inline SVG `<filter>` definitions are
 * rendered and referenced via `filter: url(#id)`.
 *
 * @module artistic-effects
 */

import React from "react";

// ── Types ─────────────────────────────────────────────────────────────────

/** Describes an artistic effect that requires an SVG filter definition. */
export interface ArtisticEffectDescriptor {
  /** Unique SVG filter ID. */
  filterId: string;
  /** CSS filter string referencing the SVG filter (and optional CSS filters). */
  cssFilter: string;
  /** Whether an SVG `<filter>` definition needs to be rendered inline. */
  needsSvgFilter: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────

/**
 * Set of artistic effect names that require SVG filter definitions.
 * All others use CSS-only filters.
 */
const SVG_FILTER_EFFECTS = new Set([
  "artisticFilmGrain",
  "filmGrain",
  "artisticCutout",
  "cutout",
  "artisticCement",
  "cement",
  "artisticTexturizer",
  "texturizer",
  "artisticCrisscrossEtching",
  "crisscrossEtching",
  "artisticMosaic",
  "artisticMosaicBubbles",
  "mosaicBubbles",
  "mosaic",
  "artisticGlowEdges",
  "glowEdges",
  "glow_edges",
  "artisticChalkSketch",
  "chalkSketch",
  "chalk",
  "artisticPencilSketch",
  "pencilSketch",
  "artisticPencilGrayscale",
  "pencilGrayscale",
  "grayPencil",
]);

// ── Filter ID generation ──────────────────────────────────────────────────

/** Generate a stable, unique SVG filter ID for an artistic effect on an element. */
export function getArtisticFilterId(elementId: string): string {
  return `artistic-fx-${elementId}`;
}

// ── Query whether an effect needs SVG ─────────────────────────────────────

/**
 * Check whether the given artistic effect name requires an inline SVG
 * `<filter>` definition (as opposed to pure CSS filters).
 */
export function needsSvgArtisticFilter(
  effectName: string | undefined,
): boolean {
  if (!effectName) return false;
  return SVG_FILTER_EFFECTS.has(effectName);
}

// ── SVG filter renderer ───────────────────────────────────────────────────

/**
 * Build the artistic effect descriptor — returns the CSS filter string
 * (which may reference an SVG filter via `url(#id)`) and whether an SVG
 * `<filter>` element needs to be rendered.
 *
 * @param elementId  Unique element ID (used to build a stable filter ID).
 * @param effectName The artistic effect name from the parsed PPTX.
 * @param radius     The effect intensity / radius (0–100, typically).
 * @returns Descriptor with CSS filter string and SVG requirement flag,
 *          or `undefined` if the effect is not recognized as needing SVG.
 */
export function buildArtisticEffectDescriptor(
  elementId: string,
  effectName: string,
  radius: number,
): ArtisticEffectDescriptor | undefined {
  if (!needsSvgArtisticFilter(effectName)) return undefined;

  const filterId = getArtisticFilterId(elementId);
  return {
    filterId,
    cssFilter: `url(#${filterId})`,
    needsSvgFilter: true,
  };
}

/**
 * Render an inline SVG `<filter>` element for a complex artistic effect.
 *
 * The SVG is rendered as a zero-size absolutely-positioned element so it
 * is invisible but referenceable via CSS `filter: url(#id)`.
 *
 * @param elementId  Unique element ID.
 * @param effectName The artistic effect name.
 * @param radius     The effect intensity / radius.
 * @returns React node containing the SVG filter, or `null` if not needed.
 */
export function renderArtisticEffectSvgFilter(
  elementId: string,
  effectName: string | undefined,
  radius: number,
): React.ReactNode {
  if (!effectName || !needsSvgArtisticFilter(effectName)) return null;

  const filterId = getArtisticFilterId(elementId);
  const filterContent = buildFilterPrimitives(effectName, radius);

  if (!filterContent) return null;

  return (
    <svg
      width={0}
      height={0}
      style={{ position: "absolute", overflow: "hidden" }}
      aria-hidden="true"
    >
      <defs>
        <filter
          id={filterId}
          x="0%"
          y="0%"
          width="100%"
          height="100%"
          colorInterpolationFilters="sRGB"
        >
          {filterContent}
        </filter>
      </defs>
    </svg>
  );
}

// ── Filter primitive builders ─────────────────────────────────────────────

/**
 * Build the SVG filter primitives for a given artistic effect.
 * Returns a React fragment containing `<fe*>` elements, or `null`.
 */
function buildFilterPrimitives(
  effectName: string,
  radius: number,
): React.ReactNode {
  // Normalize radius to a 0-1 scale for turbulence/displacement
  const normalizedRadius = Math.max(0, Math.min(100, radius)) / 100;

  switch (effectName) {
    // ── Film Grain ──────────────────────────────────────────────────────
    // Subtle noise overlay using feTurbulence blended with the source.
    case "artisticFilmGrain":
    case "filmGrain": {
      const freq = 0.5 + normalizedRadius * 0.5; // 0.5–1.0
      const opacity = 0.15 + normalizedRadius * 0.25; // 0.15–0.40
      return (
        <>
          <feTurbulence
            type="fractalNoise"
            baseFrequency={freq}
            numOctaves={4}
            seed={1}
            stitchTiles="stitch"
            result="grain"
          />
          <feColorMatrix
            in="grain"
            type="saturate"
            values="0"
            result="grainGray"
          />
          <feBlend
            in="SourceGraphic"
            in2="grainGray"
            mode="overlay"
          />
          {/* Slight contrast and brightness boost to match PPTX feel */}
          <feComponentTransfer>
            <feFuncR
              type="linear"
              slope={1 + opacity * 0.3}
              intercept={opacity * 0.02}
            />
            <feFuncG
              type="linear"
              slope={1 + opacity * 0.3}
              intercept={opacity * 0.02}
            />
            <feFuncB
              type="linear"
              slope={1 + opacity * 0.3}
              intercept={opacity * 0.02}
            />
          </feComponentTransfer>
        </>
      );
    }

    // ── Cutout ──────────────────────────────────────────────────────────
    // Posterization: reduce colours to discrete steps using feComponentTransfer
    // with `discrete` table values.
    case "artisticCutout":
    case "cutout": {
      const steps = Math.max(2, Math.round(4 + normalizedRadius * 4)); // 4–8 steps
      const tableValues = buildDiscreteTable(steps);
      return (
        <>
          <feComponentTransfer>
            <feFuncR type="discrete" tableValues={tableValues} />
            <feFuncG type="discrete" tableValues={tableValues} />
            <feFuncB type="discrete" tableValues={tableValues} />
          </feComponentTransfer>
        </>
      );
    }

    // ── Cement ──────────────────────────────────────────────────────────
    // Desaturated image with a fine noise texture overlay.
    case "artisticCement":
    case "cement": {
      const freq = 1.5 + normalizedRadius * 2.5; // 1.5–4.0
      return (
        <>
          {/* Desaturate first */}
          <feColorMatrix
            type="saturate"
            values={`${Math.max(0, 0.4 - normalizedRadius * 0.3)}`}
            result="desat"
          />
          {/* Generate noise */}
          <feTurbulence
            type="fractalNoise"
            baseFrequency={freq}
            numOctaves={5}
            seed={2}
            stitchTiles="stitch"
            result="cementNoise"
          />
          <feColorMatrix
            in="cementNoise"
            type="saturate"
            values="0"
            result="cementGray"
          />
          {/* Blend noise with image */}
          <feBlend in="desat" in2="cementGray" mode="multiply" />
          {/* Boost contrast */}
          <feComponentTransfer>
            <feFuncR type="linear" slope={1.2} intercept={0} />
            <feFuncG type="linear" slope={1.2} intercept={0} />
            <feFuncB type="linear" slope={1.2} intercept={0} />
          </feComponentTransfer>
        </>
      );
    }

    // ── Texturizer ─────────────────────────────────────────────────────
    // Fine noise texture overlay on the original image.
    case "artisticTexturizer":
    case "texturizer": {
      const freq = 2.0 + normalizedRadius * 3.0; // 2.0–5.0
      return (
        <>
          <feTurbulence
            type="fractalNoise"
            baseFrequency={freq}
            numOctaves={3}
            seed={3}
            stitchTiles="stitch"
            result="texNoise"
          />
          <feColorMatrix
            in="texNoise"
            type="saturate"
            values="0"
            result="texGray"
          />
          <feBlend in="SourceGraphic" in2="texGray" mode="overlay" />
          <feComponentTransfer>
            <feFuncR type="linear" slope={1.1} intercept={0.02} />
            <feFuncG type="linear" slope={1.1} intercept={0.02} />
            <feFuncB type="linear" slope={1.1} intercept={0.02} />
          </feComponentTransfer>
        </>
      );
    }

    // ── Crisscross Etching ─────────────────────────────────────────────
    // Grayscale image with a hatching-like line pattern overlay.
    case "artisticCrisscrossEtching":
    case "crisscrossEtching": {
      const freq = 0.08 + normalizedRadius * 0.12; // fine hatching frequency
      return (
        <>
          {/* Convert to grayscale */}
          <feColorMatrix
            type="saturate"
            values="0"
            result="gray"
          />
          {/* Create line pattern */}
          <feTurbulence
            type="turbulence"
            baseFrequency={`${freq} ${freq * 3}`}
            numOctaves={1}
            seed={7}
            result="lines"
          />
          <feColorMatrix
            in="lines"
            type="saturate"
            values="0"
            result="linesGray"
          />
          {/* Multiply hatching onto grayscale image */}
          <feBlend in="gray" in2="linesGray" mode="multiply" />
          {/* Boost contrast for stronger etch look */}
          <feComponentTransfer>
            <feFuncR type="linear" slope={1.3} intercept={-0.05} />
            <feFuncG type="linear" slope={1.3} intercept={-0.05} />
            <feFuncB type="linear" slope={1.3} intercept={-0.05} />
          </feComponentTransfer>
        </>
      );
    }

    // ── Mosaic / Mosaic Bubbles ─────────────────────────────────────────
    // Pixelation effect — achieved via heavy blur + displacement noise.
    // True pixelation requires image-rendering: pixelated + downscale
    // but SVG filter gives a reasonable approximation.
    case "artisticMosaic":
    case "artisticMosaicBubbles":
    case "mosaicBubbles":
    case "mosaic": {
      const blurAmount = Math.max(2, Math.round(radius * 0.8));
      const freq = 0.02 + normalizedRadius * 0.03;
      return (
        <>
          {/* Heavy blur for block-like appearance */}
          <feGaussianBlur
            in="SourceGraphic"
            stdDeviation={blurAmount}
            result="blurred"
          />
          {/* Add slight cell-like texture */}
          <feTurbulence
            type="turbulence"
            baseFrequency={freq}
            numOctaves={1}
            seed={4}
            result="cells"
          />
          <feDisplacementMap
            in="blurred"
            in2="cells"
            scale={blurAmount * 0.5}
            xChannelSelector="R"
            yChannelSelector="G"
            result="mosaic"
          />
          {/* Slight contrast boost */}
          <feComponentTransfer in="mosaic">
            <feFuncR type="linear" slope={1.05} intercept={0} />
            <feFuncG type="linear" slope={1.05} intercept={0} />
            <feFuncB type="linear" slope={1.05} intercept={0} />
          </feComponentTransfer>
        </>
      );
    }

    // ── Glow Edges ─────────────────────────────────────────────────────
    // Edge detection with glow: invert, blur slightly, overlay to
    // create edge-glowing effect.
    case "artisticGlowEdges":
    case "glowEdges":
    case "glow_edges": {
      const edgeBlur = Math.max(1, Math.round(normalizedRadius * 3));
      return (
        <>
          {/* Invert to detect edges via blur difference */}
          <feColorMatrix
            type="matrix"
            values="-1 0 0 0 1  0 -1 0 0 1  0 0 -1 0 1  0 0 0 1 0"
            result="inverted"
          />
          {/* Slight blur on inverted */}
          <feGaussianBlur
            in="inverted"
            stdDeviation={edgeBlur}
            result="blurredInv"
          />
          {/* Composite: blend inverted-blur with source for edge glow */}
          <feBlend
            in="SourceGraphic"
            in2="blurredInv"
            mode="screen"
          />
          {/* High contrast to sharpen edges */}
          <feComponentTransfer>
            <feFuncR type="linear" slope={2.0} intercept={-0.3} />
            <feFuncG type="linear" slope={2.0} intercept={-0.3} />
            <feFuncB type="linear" slope={2.0} intercept={-0.3} />
          </feComponentTransfer>
        </>
      );
    }

    // ── Chalk Sketch ───────────────────────────────────────────────────
    // Grayscale with high contrast and chalk-like noise texture.
    case "artisticChalkSketch":
    case "chalkSketch":
    case "chalk": {
      const freq = 1.0 + normalizedRadius * 2.0;
      return (
        <>
          {/* Convert to grayscale with partial desaturation */}
          <feColorMatrix
            type="saturate"
            values={`${Math.max(0, 0.2 - normalizedRadius * 0.2)}`}
            result="gray"
          />
          {/* Generate chalk texture */}
          <feTurbulence
            type="fractalNoise"
            baseFrequency={freq}
            numOctaves={4}
            seed={5}
            stitchTiles="stitch"
            result="chalkTex"
          />
          <feColorMatrix
            in="chalkTex"
            type="saturate"
            values="0"
            result="chalkGray"
          />
          {/* Overlay chalk texture */}
          <feBlend in="gray" in2="chalkGray" mode="overlay" />
          {/* High contrast for sketch feel */}
          <feComponentTransfer>
            <feFuncR type="linear" slope={1.5} intercept={0.05} />
            <feFuncG type="linear" slope={1.5} intercept={0.05} />
            <feFuncB type="linear" slope={1.5} intercept={0.05} />
          </feComponentTransfer>
        </>
      );
    }

    // ── Pencil Sketch ──────────────────────────────────────────────────
    // Grayscale with edge enhancement: invert + blur + blend (multiply)
    // to create pencil-drawing look.
    case "artisticPencilSketch":
    case "pencilSketch": {
      const blurAmt = Math.max(3, Math.round(4 + normalizedRadius * 8));
      return (
        <>
          {/* Grayscale */}
          <feColorMatrix
            type="saturate"
            values="0"
            result="gray"
          />
          {/* Invert the grayscale */}
          <feColorMatrix
            in="gray"
            type="matrix"
            values="-1 0 0 0 1  0 -1 0 0 1  0 0 -1 0 1  0 0 0 1 0"
            result="invGray"
          />
          {/* Blur the inverted version */}
          <feGaussianBlur
            in="invGray"
            stdDeviation={blurAmt}
            result="blurInv"
          />
          {/* Blend: color dodge approximation via screen mode */}
          <feBlend in="blurInv" in2="gray" mode="screen" result="sketch" />
          {/* Boost contrast for sharper pencil lines */}
          <feComponentTransfer in="sketch">
            <feFuncR type="linear" slope={1.6} intercept={-0.15} />
            <feFuncG type="linear" slope={1.6} intercept={-0.15} />
            <feFuncB type="linear" slope={1.6} intercept={-0.15} />
          </feComponentTransfer>
        </>
      );
    }

    // ── Pencil Grayscale ───────────────────────────────────────────────
    // Desaturated image with enhanced edge contrast (sharpen effect).
    case "artisticPencilGrayscale":
    case "pencilGrayscale":
    case "grayPencil": {
      const sharpenBlur = Math.max(0.5, 1 + normalizedRadius * 2);
      return (
        <>
          {/* Convert to grayscale */}
          <feColorMatrix
            type="saturate"
            values="0"
            result="gray"
          />
          {/* Create a blurred version for unsharp-mask style sharpening */}
          <feGaussianBlur
            in="gray"
            stdDeviation={sharpenBlur}
            result="grayBlur"
          />
          {/* Subtract blurred from original to get edges, then add back */}
          <feComposite
            in="gray"
            in2="grayBlur"
            operator="arithmetic"
            k1={0}
            k2={1.5}
            k3={-0.5}
            k4={0}
          />
        </>
      );
    }

    default:
      return null;
  }
}

// ── Helper: build discrete table for posterization ────────────────────────

/**
 * Build an SVG `tableValues` string for `feComponentTransfer/feFuncR.type=discrete`.
 * Creates `steps` evenly-spaced discrete levels for posterization.
 *
 * @param steps Number of discrete colour levels (e.g. 4 → 4 colour steps).
 */
function buildDiscreteTable(steps: number): string {
  const values: number[] = [];
  for (let i = 0; i < steps; i++) {
    // Map each step to its midpoint in the 0-1 range
    const v = Math.round((i / (steps - 1)) * 100) / 100;
    // Each step covers 1/steps of the range, fill with the same value
    const count = Math.ceil(256 / steps);
    for (let j = 0; j < count; j++) {
      values.push(v);
    }
  }
  // SVG discrete requires exactly the number of entries = number of input intervals
  // Trim to 256 entries (8-bit per channel)
  return values.slice(0, 256).join(" ");
}
