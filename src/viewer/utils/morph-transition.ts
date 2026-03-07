/**
 * Morph transition — matches elements on consecutive slides by name
 * (!! prefix convention) or element ID, then produces per-element
 * CSS keyframe animation data to smoothly interpolate position, size,
 * and opacity.
 *
 * When no matching pairs are found, falls back to a simple crossfade.
 */
import type { PptxElement, PptxSlide } from "../../core";
import { hasTextProperties } from "../../core";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MorphPair {
  fromElement: PptxElement;
  toElement: PptxElement;
}

export interface MorphAnimationStyle {
  elementId: string;
  /** CSS animation string. */
  animation: string;
  /** Inline keyframes block to inject. */
  keyframes: string;
}

// ---------------------------------------------------------------------------
// Element name extraction
// ---------------------------------------------------------------------------

function getElementName(element: PptxElement): string | undefined {
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

export function matchMorphElements(
  fromSlide: PptxSlide,
  toSlide: PptxSlide,
): MorphPair[] {
  const pairs: MorphPair[] = [];
  const usedTo = new Set<string>();

  // First pass: match by !! naming convention
  for (const fromEl of fromSlide.elements) {
    const fromName = getElementName(fromEl);
    if (!fromName) continue;
    for (const toEl of toSlide.elements) {
      if (usedTo.has(toEl.id)) continue;
      const toName = getElementName(toEl);
      if (toName === fromName) {
        pairs.push({ fromElement: fromEl, toElement: toEl });
        usedTo.add(toEl.id);
        break;
      }
    }
  }

  // Second pass: match by element ID
  for (const fromEl of fromSlide.elements) {
    if (pairs.some((p) => p.fromElement.id === fromEl.id)) continue;
    for (const toEl of toSlide.elements) {
      if (usedTo.has(toEl.id)) continue;
      if (fromEl.id === toEl.id) {
        pairs.push({ fromElement: fromEl, toElement: toEl });
        usedTo.add(toEl.id);
        break;
      }
    }
  }

  // Third pass: match by same type + similar position
  for (const fromEl of fromSlide.elements) {
    if (pairs.some((p) => p.fromElement.id === fromEl.id)) continue;
    let bestMatch: PptxElement | null = null;
    let bestDist = Infinity;
    for (const toEl of toSlide.elements) {
      if (usedTo.has(toEl.id)) continue;
      if (fromEl.type !== toEl.type) continue;
      const dx = fromEl.x - toEl.x;
      const dy = fromEl.y - toEl.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bestDist && dist < 300) {
        bestDist = dist;
        bestMatch = toEl;
      }
    }
    if (bestMatch) {
      pairs.push({ fromElement: fromEl, toElement: bestMatch });
      usedTo.add(bestMatch.id);
    }
  }

  return pairs;
}

// ---------------------------------------------------------------------------
// Generate CSS keyframes for morph pairs
// ---------------------------------------------------------------------------

export function generateMorphAnimations(
  pairs: MorphPair[],
  durationMs: number,
): MorphAnimationStyle[] {
  return pairs.map((pair, index) => {
    const { fromElement, toElement } = pair;
    const name = `pptx-morph-${index}-${toElement.id.replace(/[^a-zA-Z0-9]/g, "")}`;

    const keyframes = `
@keyframes ${name} {
	from {
		transform: translate(${fromElement.x - toElement.x}px, ${fromElement.y - toElement.y}px)
			scale(${Math.max(fromElement.width, 1) / Math.max(toElement.width, 1)}, ${Math.max(fromElement.height, 1) / Math.max(toElement.height, 1)})
			rotate(${(fromElement.rotation ?? 0) - (toElement.rotation ?? 0)}deg);
		opacity: ${fromElement.opacity ?? 1};
	}
	to {
		transform: translate(0, 0) scale(1, 1) rotate(0deg);
		opacity: ${toElement.opacity ?? 1};
	}
}`;

    return {
      elementId: toElement.id,
      animation: `${name} ${durationMs}ms ease-in-out forwards`,
      keyframes,
    };
  });
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
