/**
 * Morph transition — matches elements on consecutive slides by name
 * (!! prefix convention), element name property, or element ID, then
 * produces per-element CSS keyframe animation data to smoothly
 * interpolate position, size, opacity, rotation, fill colors, stroke
 * properties, and shape geometry.
 *
 * Supports three morph granularity modes:
 *   - "object" (default): morph matched elements as wholes
 *   - "word": animate text word-by-word between matched elements
 *   - "character": animate text character-by-character
 *
 * When no matching pairs are found, falls back to a simple crossfade.
 */
import type { PptxElement, PptxSlide } from "pptx-viewer-core";
import { hasTextProperties, hasShapeProperties } from "pptx-viewer-core";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MorphPair {
  fromElement: PptxElement;
  toElement: PptxElement;
}

/** Result from full morph matching including unmatched elements. */
export interface MorphMatchResult {
  /** Matched element pairs to animate between. */
  pairs: MorphPair[];
  /** Element IDs only present on the outgoing (from) slide — these fade out. */
  unmatchedFrom: PptxElement[];
  /** Element IDs only present on the incoming (to) slide — these fade in. */
  unmatchedTo: PptxElement[];
}

export interface MorphAnimationStyle {
  elementId: string;
  /** CSS animation string. */
  animation: string;
  /** Inline keyframes block to inject. */
  keyframes: string;
}

/** Morph granularity mode matching PowerPoint's morph effect options. */
export type MorphMode = "object" | "word" | "character";

/** A single token (word or character) with its computed position for text morphing. */
export interface MorphTextToken {
  text: string;
  /** Normalised x offset within the text frame (0-1). */
  x: number;
  /** Normalised y offset within the text frame (0-1). */
  y: number;
  fontSize: number;
  fontWeight: string;
  color: string;
}

/** Paired tokens for text morph animation. */
export interface MorphTextTokenPair {
  from: MorphTextToken | null;
  to: MorphTextToken | null;
}

/** Parsed RGBA colour for interpolation. */
export interface RgbaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** PowerPoint's morph transition uses a specific cubic-bezier easing. */
export const MORPH_EASING = "cubic-bezier(0.4, 0, 0.2, 1)";

/** Maximum pixel distance for proximity-based element matching. */
const PROXIMITY_THRESHOLD = 300;

// ---------------------------------------------------------------------------
// Colour parsing and interpolation
// ---------------------------------------------------------------------------

/**
 * Parse a hex colour string (3, 4, 6, or 8 digits) into RGBA components.
 * Returns null for invalid or missing inputs.
 */
export function parseHexColor(hex: string | undefined): RgbaColor | null {
  if (!hex || typeof hex !== "string") return null;
  let cleaned = hex.replace(/^#/, "");

  // Expand shorthand: #RGB -> #RRGGBB, #RGBA -> #RRGGBBAA
  if (cleaned.length === 3) {
    cleaned = cleaned[0] + cleaned[0] + cleaned[1] + cleaned[1] + cleaned[2] + cleaned[2];
  } else if (cleaned.length === 4) {
    cleaned =
      cleaned[0] + cleaned[0] + cleaned[1] + cleaned[1] +
      cleaned[2] + cleaned[2] + cleaned[3] + cleaned[3];
  }

  if (cleaned.length !== 6 && cleaned.length !== 8) return null;

  const r = Number.parseInt(cleaned.slice(0, 2), 16);
  const g = Number.parseInt(cleaned.slice(2, 4), 16);
  const b = Number.parseInt(cleaned.slice(4, 6), 16);
  const a = cleaned.length === 8 ? Number.parseInt(cleaned.slice(6, 8), 16) / 255 : 1;

  if ([r, g, b].some((v) => Number.isNaN(v))) return null;

  return { r, g, b, a: Number.isNaN(a) ? 1 : a };
}

/**
 * Linearly interpolate between two RGBA colours at parameter t (0-1).
 * Returns a CSS rgba() string.
 */
export function lerpColor(from: RgbaColor, to: RgbaColor, t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const r = Math.round(from.r + (to.r - from.r) * clamped);
  const g = Math.round(from.g + (to.g - from.g) * clamped);
  const b = Math.round(from.b + (to.b - from.b) * clamped);
  const a = +(from.a + (to.a - from.a) * clamped).toFixed(3);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * Convert an RgbaColor back to a hex string (6-digit or 8-digit if alpha < 1).
 */
export function rgbaToHex(c: RgbaColor): string {
  const r = c.r.toString(16).padStart(2, "0");
  const g = c.g.toString(16).padStart(2, "0");
  const b = c.b.toString(16).padStart(2, "0");
  if (c.a < 1) {
    const a = Math.round(c.a * 255).toString(16).padStart(2, "0");
    return `#${r}${g}${b}${a}`;
  }
  return `#${r}${g}${b}`;
}

// ---------------------------------------------------------------------------
// SVG path interpolation for shape morphing
// ---------------------------------------------------------------------------

/** A single SVG path command with its coordinate values. */
export interface SvgPathCommand {
  type: string;
  values: number[];
}

/**
 * Parse an SVG path `d` attribute string into a sequence of commands.
 * Supports M, L, C, Q, Z, A, H, V and their lowercase variants.
 */
export function parseSvgPath(d: string): SvgPathCommand[] {
  if (!d || typeof d !== "string") return [];

  const commands: SvgPathCommand[] = [];
  // Split on command letters while keeping the letter
  const tokens = d.match(/[MLCQZAHVSmlcqzahvs][^MLCQZAHVSmlcqzahvs]*/gi);
  if (!tokens) return [];

  for (const token of tokens) {
    const type = token[0];
    const rest = token.slice(1).trim();
    const values: number[] = [];

    if (rest.length > 0) {
      // Extract numbers (including negative and decimal)
      const nums = rest.match(/-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g);
      if (nums) {
        for (const n of nums) {
          const val = Number.parseFloat(n);
          if (Number.isFinite(val)) values.push(val);
        }
      }
    }

    commands.push({ type, values });
  }

  return commands;
}

/**
 * Serialize SVG path commands back to a `d` attribute string.
 */
export function serializeSvgPath(commands: SvgPathCommand[]): string {
  return commands
    .map((cmd) => {
      if (cmd.values.length === 0) return cmd.type;
      return `${cmd.type}${cmd.values.map((v) => +v.toFixed(2)).join(" ")}`;
    })
    .join(" ");
}

/**
 * Equalise two SVG path command arrays so they have the same number of
 * commands and each corresponding pair has the same type and value count.
 *
 * Strategy:
 * - If one path is shorter, duplicate its last non-Z command to pad.
 * - If command types differ at a position, convert simpler commands
 *   (L -> C by creating a degenerate cubic) so both have the same type.
 * - Z commands are kept aligned.
 *
 * Returns null if the paths are too structurally different to interpolate.
 */
export function equalizePaths(
  a: SvgPathCommand[],
  b: SvgPathCommand[],
): [SvgPathCommand[], SvgPathCommand[]] | null {
  if (a.length === 0 || b.length === 0) return null;

  const resultA = a.map((c) => ({ type: c.type, values: [...c.values] }));
  const resultB = b.map((c) => ({ type: c.type, values: [...c.values] }));

  // Pad shorter path by duplicating last non-Z command at its final position
  while (resultA.length < resultB.length) {
    const last = findLastNonZ(resultA);
    resultA.splice(resultA.length - (hasClosingZ(resultA) ? 1 : 0), 0, {
      type: last.type,
      values: [...last.values],
    });
  }
  while (resultB.length < resultA.length) {
    const last = findLastNonZ(resultB);
    resultB.splice(resultB.length - (hasClosingZ(resultB) ? 1 : 0), 0, {
      type: last.type,
      values: [...last.values],
    });
  }

  // Align command types and value counts
  for (let i = 0; i < resultA.length; i++) {
    const ca = resultA[i];
    const cb = resultB[i];

    // Both Z — fine
    if (ca.type.toUpperCase() === "Z" && cb.type.toUpperCase() === "Z") continue;

    // Promote L to C (degenerate cubic) if the other side is C
    if (ca.type.toUpperCase() === "L" && cb.type.toUpperCase() === "C") {
      resultA[i] = lineToCubic(ca);
    } else if (cb.type.toUpperCase() === "L" && ca.type.toUpperCase() === "C") {
      resultB[i] = lineToCubic(cb);
    }

    // Ensure value counts match by padding with zeros or trimming
    const maxLen = Math.max(resultA[i].values.length, resultB[i].values.length);
    while (resultA[i].values.length < maxLen) resultA[i].values.push(0);
    while (resultB[i].values.length < maxLen) resultB[i].values.push(0);
  }

  return [resultA, resultB];
}

function findLastNonZ(cmds: SvgPathCommand[]): SvgPathCommand {
  for (let i = cmds.length - 1; i >= 0; i--) {
    if (cmds[i].type.toUpperCase() !== "Z") return cmds[i];
  }
  return cmds[0];
}

function hasClosingZ(cmds: SvgPathCommand[]): boolean {
  return cmds.length > 0 && cmds[cmds.length - 1].type.toUpperCase() === "Z";
}

/** Convert an L (line-to) command into a degenerate C (cubic bezier). */
function lineToCubic(cmd: SvgPathCommand): SvgPathCommand {
  const isLower = cmd.type === "l";
  const [x, y] = cmd.values.length >= 2 ? cmd.values : [0, 0];
  // Degenerate cubic: control points at start (0,0 for relative) and end
  return {
    type: isLower ? "c" : "C",
    values: [0, 0, x, y, x, y],
  };
}

/**
 * Interpolate between two equalised SVG path command arrays at parameter t.
 * Both arrays must have the same length and matching command types.
 */
export function interpolatePaths(
  from: SvgPathCommand[],
  to: SvgPathCommand[],
  t: number,
): SvgPathCommand[] {
  const clamped = Math.max(0, Math.min(1, t));
  const result: SvgPathCommand[] = [];

  const len = Math.min(from.length, to.length);
  for (let i = 0; i < len; i++) {
    const fa = from[i];
    const fb = to[i];
    const interpolatedValues = fa.values.map((v, j) => {
      const target = j < fb.values.length ? fb.values[j] : v;
      return v + (target - v) * clamped;
    });
    result.push({ type: fb.type, values: interpolatedValues });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Element name extraction (matching)
// ---------------------------------------------------------------------------

/**
 * Extract the morph-matching name from an element.
 *
 * Priority:
 * 1. Text starting with "!!" (explicit morph name convention)
 * 2. (Future: element.name property from cNvPr/@name when available)
 */
export function getElementMorphName(element: PptxElement): string | undefined {
  // Check !! naming convention in text content
  if (hasTextProperties(element) && element.text) {
    const text = element.text.trim();
    if (text.startsWith("!!")) {
      return text;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Match elements between slides
// ---------------------------------------------------------------------------

/**
 * Match elements between two consecutive slides for morph transition.
 *
 * Matching passes (in priority order):
 *   1. Explicit !! naming convention (text content starting with "!!")
 *   2. Element ID matching (same `id` on both slides)
 *   3. Type + proximity matching (same type within 300px euclidean distance)
 *
 * Returns matched pairs and unmatched elements on both sides.
 */
export function matchMorphElements(
  fromSlide: PptxSlide,
  toSlide: PptxSlide,
): MorphPair[] {
  const result = matchMorphElementsFull(fromSlide, toSlide);
  return result.pairs;
}

/**
 * Full morph matching that also returns unmatched elements for fade in/out animations.
 */
export function matchMorphElementsFull(
  fromSlide: PptxSlide,
  toSlide: PptxSlide,
): MorphMatchResult {
  const pairs: MorphPair[] = [];
  const usedFrom = new Set<string>();
  const usedTo = new Set<string>();

  // Pass 1: match by !! naming convention
  for (const fromEl of fromSlide.elements) {
    const fromName = getElementMorphName(fromEl);
    if (!fromName) continue;
    for (const toEl of toSlide.elements) {
      if (usedTo.has(toEl.id)) continue;
      const toName = getElementMorphName(toEl);
      if (toName === fromName) {
        pairs.push({ fromElement: fromEl, toElement: toEl });
        usedFrom.add(fromEl.id);
        usedTo.add(toEl.id);
        break;
      }
    }
  }

  // Pass 2: match by element ID
  for (const fromEl of fromSlide.elements) {
    if (usedFrom.has(fromEl.id)) continue;
    for (const toEl of toSlide.elements) {
      if (usedTo.has(toEl.id)) continue;
      if (fromEl.id === toEl.id) {
        pairs.push({ fromElement: fromEl, toElement: toEl });
        usedFrom.add(fromEl.id);
        usedTo.add(toEl.id);
        break;
      }
    }
  }

  // Pass 3: match by same type + similar position (proximity)
  for (const fromEl of fromSlide.elements) {
    if (usedFrom.has(fromEl.id)) continue;
    let bestMatch: PptxElement | null = null;
    let bestDist = Infinity;
    for (const toEl of toSlide.elements) {
      if (usedTo.has(toEl.id)) continue;
      if (fromEl.type !== toEl.type) continue;
      const dx = fromEl.x - toEl.x;
      const dy = fromEl.y - toEl.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bestDist && dist < PROXIMITY_THRESHOLD) {
        bestDist = dist;
        bestMatch = toEl;
      }
    }
    if (bestMatch) {
      pairs.push({ fromElement: fromEl, toElement: bestMatch });
      usedFrom.add(fromEl.id);
      usedTo.add(bestMatch.id);
    }
  }

  // Collect unmatched elements
  const unmatchedFrom = fromSlide.elements.filter((el) => !usedFrom.has(el.id));
  const unmatchedTo = toSlide.elements.filter((el) => !usedTo.has(el.id));

  return { pairs, unmatchedFrom, unmatchedTo };
}

// ---------------------------------------------------------------------------
// Text tokenization for character/word morph
// ---------------------------------------------------------------------------

/**
 * Tokenize element text into word or character tokens with estimated positions.
 */
export function tokenizeText(
  element: PptxElement,
  mode: "word" | "character",
): MorphTextToken[] {
  if (!hasTextProperties(element) || !element.text) return [];

  const text = element.text;
  const style = element.textStyle;
  const fontSize = style?.fontSize ?? 14;
  const fontWeight = style?.bold ? "bold" : "normal";
  const color = style?.color ?? "#000000";

  const tokens: MorphTextToken[] = [];

  if (mode === "character") {
    const chars = Array.from(text); // handle multi-byte characters
    const totalChars = chars.length;
    if (totalChars === 0) return [];

    // Estimate character layout: simple left-to-right single-line model
    // Normalise positions to 0-1 range within the text frame
    for (let i = 0; i < chars.length; i++) {
      if (chars[i] === "\n") continue; // skip newlines for position calculation
      tokens.push({
        text: chars[i],
        x: totalChars > 1 ? i / (totalChars - 1) : 0.5,
        y: 0.5,
        fontSize,
        fontWeight,
        color,
      });
    }
  } else {
    // Word mode: split on whitespace
    const words = text.split(/(\s+)/);
    const nonEmptyWords = words.filter((w) => w.trim().length > 0);
    const totalWords = nonEmptyWords.length;
    if (totalWords === 0) return [];

    let wordIndex = 0;
    for (const word of words) {
      if (word.trim().length === 0) continue;
      tokens.push({
        text: word,
        x: totalWords > 1 ? wordIndex / (totalWords - 1) : 0.5,
        y: 0.5,
        fontSize,
        fontWeight,
        color,
      });
      wordIndex++;
    }
  }

  return tokens;
}

/**
 * Match text tokens between source and destination for text morphing.
 *
 * Uses a simple LCS-like approach: match tokens with identical text first,
 * then pair remaining tokens by position proximity, and mark the rest as
 * appearing/disappearing (null on one side).
 */
export function matchTextTokens(
  fromTokens: MorphTextToken[],
  toTokens: MorphTextToken[],
): MorphTextTokenPair[] {
  const pairs: MorphTextTokenPair[] = [];
  const usedFrom = new Set<number>();
  const usedTo = new Set<number>();

  // Pass 1: exact text matches (preserving order)
  for (let fi = 0; fi < fromTokens.length; fi++) {
    if (usedFrom.has(fi)) continue;
    for (let ti = 0; ti < toTokens.length; ti++) {
      if (usedTo.has(ti)) continue;
      if (fromTokens[fi].text === toTokens[ti].text) {
        pairs.push({ from: fromTokens[fi], to: toTokens[ti] });
        usedFrom.add(fi);
        usedTo.add(ti);
        break;
      }
    }
  }

  // Pass 2: match remaining tokens by position proximity
  for (let fi = 0; fi < fromTokens.length; fi++) {
    if (usedFrom.has(fi)) continue;
    let bestTi = -1;
    let bestDist = Infinity;
    for (let ti = 0; ti < toTokens.length; ti++) {
      if (usedTo.has(ti)) continue;
      const dx = fromTokens[fi].x - toTokens[ti].x;
      const dy = fromTokens[fi].y - toTokens[ti].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bestDist) {
        bestDist = dist;
        bestTi = ti;
      }
    }
    if (bestTi >= 0 && bestDist < 2) {
      pairs.push({ from: fromTokens[fi], to: toTokens[bestTi] });
      usedFrom.add(fi);
      usedTo.add(bestTi);
    }
  }

  // Unmatched from tokens: fade out
  for (let fi = 0; fi < fromTokens.length; fi++) {
    if (!usedFrom.has(fi)) {
      pairs.push({ from: fromTokens[fi], to: null });
    }
  }

  // Unmatched to tokens: fade in
  for (let ti = 0; ti < toTokens.length; ti++) {
    if (!usedTo.has(ti)) {
      pairs.push({ from: null, to: toTokens[ti] });
    }
  }

  return pairs;
}

// ---------------------------------------------------------------------------
// Build color interpolation keyframes
// ---------------------------------------------------------------------------

/**
 * Generate CSS keyframe properties for fill colour interpolation between two elements.
 * Returns an object with `from` and `to` background-color declarations, or null
 * if both elements lack fill or are identical.
 */
export function buildColorInterpolationProps(
  fromElement: PptxElement,
  toElement: PptxElement,
): { fromBg: string; toBg: string } | null {
  const fromFill = hasShapeProperties(fromElement)
    ? fromElement.shapeStyle?.fillColor
    : undefined;
  const toFill = hasShapeProperties(toElement)
    ? toElement.shapeStyle?.fillColor
    : undefined;

  if (!fromFill && !toFill) return null;
  if (fromFill === toFill) return null;

  const fromColor = parseHexColor(fromFill);
  const toColor = parseHexColor(toFill);

  if (!fromColor && !toColor) return null;

  const from = fromColor ?? { r: 255, g: 255, b: 255, a: 0 };
  const to = toColor ?? { r: 255, g: 255, b: 255, a: 0 };

  return {
    fromBg: lerpColor(from, from, 0),
    toBg: lerpColor(to, to, 0),
  };
}

/**
 * Generate CSS keyframe properties for stroke interpolation between two elements.
 */
export function buildStrokeInterpolationProps(
  fromElement: PptxElement,
  toElement: PptxElement,
): { fromStroke: string; toStroke: string; fromWidth: number; toWidth: number } | null {
  const fromStyle = hasShapeProperties(fromElement) ? fromElement.shapeStyle : undefined;
  const toStyle = hasShapeProperties(toElement) ? toElement.shapeStyle : undefined;

  const fromColor = fromStyle?.strokeColor;
  const toColor = toStyle?.strokeColor;
  const fromWidth = fromStyle?.strokeWidth ?? 0;
  const toWidth = toStyle?.strokeWidth ?? 0;

  if (!fromColor && !toColor && fromWidth === 0 && toWidth === 0) return null;
  if (fromColor === toColor && fromWidth === toWidth) return null;

  const fc = parseHexColor(fromColor) ?? { r: 0, g: 0, b: 0, a: 1 };
  const tc = parseHexColor(toColor) ?? { r: 0, g: 0, b: 0, a: 1 };

  return {
    fromStroke: lerpColor(fc, fc, 0),
    toStroke: lerpColor(tc, tc, 0),
    fromWidth,
    toWidth,
  };
}

// ---------------------------------------------------------------------------
// Generate CSS keyframes for morph pairs (enhanced)
// ---------------------------------------------------------------------------

/**
 * Generate morph animation keyframes for matched element pairs.
 *
 * Improvements over basic morph:
 * - PowerPoint-style cubic-bezier easing
 * - Fill color interpolation via background-color
 * - Stroke color and width interpolation via outline
 * - Shape type change detection (for geometry morphing indicator)
 */
export function generateMorphAnimations(
  pairs: MorphPair[],
  durationMs: number,
  _mode: MorphMode = "object",
): MorphAnimationStyle[] {
  const animations: MorphAnimationStyle[] = [];

  for (let index = 0; index < pairs.length; index++) {
    const { fromElement, toElement } = pairs[index];
    const safeName = `pptx-morph-${index}-${toElement.id.replace(/[^a-zA-Z0-9]/g, "")}`;

    // Position and geometry interpolation
    const dx = fromElement.x - toElement.x;
    const dy = fromElement.y - toElement.y;
    const sx = Math.max(fromElement.width, 1) / Math.max(toElement.width, 1);
    const sy = Math.max(fromElement.height, 1) / Math.max(toElement.height, 1);
    const dr = (fromElement.rotation ?? 0) - (toElement.rotation ?? 0);
    const fromOpacity = fromElement.opacity ?? 1;
    const toOpacity = toElement.opacity ?? 1;

    // Build from/to property blocks
    const fromProps: string[] = [
      `\t\ttransform: translate(${dx}px, ${dy}px) scale(${sx}, ${sy}) rotate(${dr}deg);`,
      `\t\topacity: ${fromOpacity};`,
    ];
    const toProps: string[] = [
      "\t\ttransform: translate(0, 0) scale(1, 1) rotate(0deg);",
      `\t\topacity: ${toOpacity};`,
    ];

    // Fill color interpolation
    const colorInterp = buildColorInterpolationProps(fromElement, toElement);
    if (colorInterp) {
      fromProps.push(`\t\tbackground-color: ${colorInterp.fromBg};`);
      toProps.push(`\t\tbackground-color: ${colorInterp.toBg};`);
    }

    // Stroke interpolation via outline
    const strokeInterp = buildStrokeInterpolationProps(fromElement, toElement);
    if (strokeInterp) {
      fromProps.push(
        `\t\toutline: ${strokeInterp.fromWidth}px solid ${strokeInterp.fromStroke};`,
      );
      toProps.push(
        `\t\toutline: ${strokeInterp.toWidth}px solid ${strokeInterp.toStroke};`,
      );
    }

    const keyframes = `
@keyframes ${safeName} {
\tfrom {
${fromProps.join("\n")}
\t}
\tto {
${toProps.join("\n")}
\t}
}`;

    animations.push({
      elementId: toElement.id,
      animation: `${safeName} ${durationMs}ms ${MORPH_EASING} forwards`,
      keyframes,
    });
  }

  return animations;
}

/**
 * Generate fade-out animations for elements that only exist on the outgoing slide.
 */
export function generateUnmatchedFadeOutAnimations(
  elements: PptxElement[],
  durationMs: number,
  startIndex: number,
): MorphAnimationStyle[] {
  return elements.map((el, i) => {
    const safeName = `pptx-morph-fadeout-${startIndex + i}-${el.id.replace(/[^a-zA-Z0-9]/g, "")}`;
    const keyframes = `
@keyframes ${safeName} {
\tfrom {
\t\topacity: ${el.opacity ?? 1};
\t\ttransform: scale(1);
\t}
\tto {
\t\topacity: 0;
\t\ttransform: scale(0.95);
\t}
}`;
    return {
      elementId: el.id,
      animation: `${safeName} ${durationMs}ms ${MORPH_EASING} forwards`,
      keyframes,
    };
  });
}

/**
 * Generate fade-in animations for elements that only exist on the incoming slide.
 */
export function generateUnmatchedFadeInAnimations(
  elements: PptxElement[],
  durationMs: number,
  startIndex: number,
): MorphAnimationStyle[] {
  return elements.map((el, i) => {
    const safeName = `pptx-morph-fadein-${startIndex + i}-${el.id.replace(/[^a-zA-Z0-9]/g, "")}`;
    const keyframes = `
@keyframes ${safeName} {
\tfrom {
\t\topacity: 0;
\t\ttransform: scale(0.95);
\t}
\tto {
\t\topacity: ${el.opacity ?? 1};
\t\ttransform: scale(1);
\t}
}`;
    return {
      elementId: el.id,
      animation: `${safeName} ${durationMs}ms ${MORPH_EASING} forwards`,
      keyframes,
    };
  });
}

/**
 * Generate text morph animations for a matched element pair with text content.
 *
 * Produces per-token (word or character) CSS keyframes that animate
 * position, font size, color, and opacity of individual text units.
 */
export function generateTextMorphAnimations(
  pair: MorphPair,
  durationMs: number,
  mode: "word" | "character",
  pairIndex: number,
): MorphAnimationStyle[] {
  const fromTokens = tokenizeText(pair.fromElement, mode);
  const toTokens = tokenizeText(pair.toElement, mode);

  if (fromTokens.length === 0 && toTokens.length === 0) return [];

  const tokenPairs = matchTextTokens(fromTokens, toTokens);
  const animations: MorphAnimationStyle[] = [];

  for (let ti = 0; ti < tokenPairs.length; ti++) {
    const tp = tokenPairs[ti];
    const safeName = `pptx-morph-text-${pairIndex}-${ti}`;

    if (tp.from && tp.to) {
      // Matched token: animate position, size, color
      const fromX = tp.from.x * 100;
      const toX = tp.to.x * 100;
      const fromColor = parseHexColor(tp.from.color);
      const toColor = parseHexColor(tp.to.color);
      const fromColorStr = fromColor ? lerpColor(fromColor, fromColor, 0) : tp.from.color;
      const toColorStr = toColor ? lerpColor(toColor, toColor, 0) : tp.to.color;

      const keyframes = `
@keyframes ${safeName} {
\tfrom {
\t\tleft: ${fromX}%;
\t\tfont-size: ${tp.from.fontSize}pt;
\t\tfont-weight: ${tp.from.fontWeight};
\t\tcolor: ${fromColorStr};
\t\topacity: 1;
\t}
\tto {
\t\tleft: ${toX}%;
\t\tfont-size: ${tp.to.fontSize}pt;
\t\tfont-weight: ${tp.to.fontWeight};
\t\tcolor: ${toColorStr};
\t\topacity: 1;
\t}
}`;
      animations.push({
        elementId: `${pair.toElement.id}__token_${ti}`,
        animation: `${safeName} ${durationMs}ms ${MORPH_EASING} forwards`,
        keyframes,
      });
    } else if (tp.from && !tp.to) {
      // Disappearing token: fade out
      const keyframes = `
@keyframes ${safeName} {
\tfrom { opacity: 1; }
\tto { opacity: 0; }
}`;
      animations.push({
        elementId: `${pair.fromElement.id}__token_${ti}`,
        animation: `${safeName} ${durationMs}ms ${MORPH_EASING} forwards`,
        keyframes,
      });
    } else if (!tp.from && tp.to) {
      // Appearing token: fade in
      const keyframes = `
@keyframes ${safeName} {
\tfrom { opacity: 0; }
\tto { opacity: 1; }
}`;
      animations.push({
        elementId: `${pair.toElement.id}__token_${ti}`,
        animation: `${safeName} ${durationMs}ms ${MORPH_EASING} forwards`,
        keyframes,
      });
    }
  }

  return animations;
}

/**
 * Generate a complete morph transition animation set, including:
 * - Matched element morphs (position, size, rotation, opacity, color, stroke)
 * - Unmatched element fade-out / fade-in
 * - Optional text morph (word or character level)
 */
export function generateFullMorphTransition(
  fromSlide: PptxSlide,
  toSlide: PptxSlide,
  durationMs: number,
  mode: MorphMode = "object",
): MorphAnimationStyle[] {
  const matchResult = matchMorphElementsFull(fromSlide, toSlide);
  const allAnimations: MorphAnimationStyle[] = [];

  // Generate main element morph animations
  const pairAnims = generateMorphAnimations(matchResult.pairs, durationMs, mode);
  allAnimations.push(...pairAnims);

  // Generate text morph animations for text-bearing matched pairs
  if (mode === "word" || mode === "character") {
    for (let i = 0; i < matchResult.pairs.length; i++) {
      const pair = matchResult.pairs[i];
      if (hasTextProperties(pair.fromElement) && hasTextProperties(pair.toElement)) {
        const textAnims = generateTextMorphAnimations(pair, durationMs, mode, i);
        allAnimations.push(...textAnims);
      }
    }
  }

  // Generate fade-out for unmatched from elements
  const fadeOuts = generateUnmatchedFadeOutAnimations(
    matchResult.unmatchedFrom,
    durationMs,
    pairAnims.length,
  );
  allAnimations.push(...fadeOuts);

  // Generate fade-in for unmatched to elements
  const fadeIns = generateUnmatchedFadeInAnimations(
    matchResult.unmatchedTo,
    durationMs,
    pairAnims.length + fadeOuts.length,
  );
  allAnimations.push(...fadeIns);

  return allAnimations;
}

// ---------------------------------------------------------------------------
// Inject morph keyframes into the document
// ---------------------------------------------------------------------------

let morphStyleElement: HTMLStyleElement | null = null;

export function injectMorphKeyframes(animations: MorphAnimationStyle[]): void {
  if (morphStyleElement) {
    morphStyleElement.remove();
    morphStyleElement = null;
  }

  if (animations.length === 0) return;

  const css = animations.map((a) => a.keyframes).join("\n");
  morphStyleElement = document.createElement("style");
  morphStyleElement.textContent = css;
  document.head.appendChild(morphStyleElement);
}

export function cleanupMorphKeyframes(): void {
  if (morphStyleElement) {
    morphStyleElement.remove();
    morphStyleElement = null;
  }
}
