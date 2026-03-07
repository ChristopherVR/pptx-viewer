import type {
  PptxSlide,
  PptxElement,
  PptxData,
} from "../../core";
import { hasTextProperties } from "../../core";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SlideDiffStatus = "added" | "removed" | "changed" | "unchanged";

export interface ElementChange {
  elementId: string;
  label: string;
  kind: "added" | "removed" | "moved" | "resized" | "textChanged";
  description: string;
}

export interface SlideDiff {
  status: SlideDiffStatus;
  /** Index in the base (current) presentation, or -1 for added slides. */
  baseIndex: number;
  /** Index in the compare (other) presentation, or -1 for removed slides. */
  compareIndex: number;
  /** The base slide data (undefined for added slides). */
  baseSlide?: PptxSlide;
  /** The compare slide data (undefined for removed slides). */
  compareSlide?: PptxSlide;
  /** Per-element changes when status is 'changed'. */
  changes: ElementChange[];
}

export interface CompareResult {
  diffs: SlideDiff[];
  baseSlideCount: number;
  compareSlideCount: number;
  addedCount: number;
  removedCount: number;
  changedCount: number;
  unchangedCount: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getElementText(element: PptxElement): string {
  if (!hasTextProperties(element)) return "";
  if (element.textSegments && element.textSegments.length > 0) {
    return element.textSegments.map((s) => s.text).join("");
  }
  return element.text ?? "";
}

function getElementLabel(element: PptxElement): string {
  const typeLabel =
    element.type.charAt(0).toUpperCase() + element.type.slice(1);
  const text = getElementText(element);
  if (text.length > 0) {
    const preview = text.length > 30 ? text.slice(0, 30) + "..." : text;
    return `${typeLabel}: "${preview}"`;
  }
  return `${typeLabel} (${element.id})`;
}

function collectElementsFlat(elements: PptxElement[]): PptxElement[] {
  const result: PptxElement[] = [];
  for (const el of elements) {
    result.push(el);
    if (el.type === "group" && el.children) {
      result.push(...collectElementsFlat(el.children));
    }
  }
  return result;
}

function diffSlideElements(
  baseElements: PptxElement[],
  compareElements: PptxElement[],
): ElementChange[] {
  const changes: ElementChange[] = [];
  const baseFlat = collectElementsFlat(baseElements);
  const compareFlat = collectElementsFlat(compareElements);

  const baseById = new Map<string, PptxElement>();
  for (const el of baseFlat) {
    baseById.set(el.id, el);
  }
  const compareById = new Map<string, PptxElement>();
  for (const el of compareFlat) {
    compareById.set(el.id, el);
  }

  // Removed elements (in base but not in compare)
  for (const [id, el] of baseById) {
    if (!compareById.has(id)) {
      changes.push({
        elementId: id,
        label: getElementLabel(el),
        kind: "removed",
        description: `Element removed: ${getElementLabel(el)}`,
      });
    }
  }

  // Added elements (in compare but not in base)
  for (const [id, el] of compareById) {
    if (!baseById.has(id)) {
      changes.push({
        elementId: id,
        label: getElementLabel(el),
        kind: "added",
        description: `Element added: ${getElementLabel(el)}`,
      });
    }
  }

  // Changed elements (present in both)
  for (const [id, baseEl] of baseById) {
    const compareEl = compareById.get(id);
    if (!compareEl) continue;

    // Position change
    const posThreshold = 2; // px tolerance
    if (
      Math.abs(baseEl.x - compareEl.x) > posThreshold ||
      Math.abs(baseEl.y - compareEl.y) > posThreshold
    ) {
      changes.push({
        elementId: id,
        label: getElementLabel(baseEl),
        kind: "moved",
        description: `Moved from (${Math.round(baseEl.x)}, ${Math.round(baseEl.y)}) to (${Math.round(compareEl.x)}, ${Math.round(compareEl.y)})`,
      });
    }

    // Size change
    const sizeThreshold = 2;
    if (
      Math.abs(baseEl.width - compareEl.width) > sizeThreshold ||
      Math.abs(baseEl.height - compareEl.height) > sizeThreshold
    ) {
      changes.push({
        elementId: id,
        label: getElementLabel(baseEl),
        kind: "resized",
        description: `Resized from ${Math.round(baseEl.width)}x${Math.round(baseEl.height)} to ${Math.round(compareEl.width)}x${Math.round(compareEl.height)}`,
      });
    }

    // Text change
    const baseText = getElementText(baseEl);
    const compareText = getElementText(compareEl);
    if (baseText !== compareText) {
      changes.push({
        elementId: id,
        label: getElementLabel(baseEl),
        kind: "textChanged",
        description: "Text content changed",
      });
    }
  }

  return changes;
}

// ---------------------------------------------------------------------------
// Main compare function
// ---------------------------------------------------------------------------

export function comparePresentation(
  base: PptxData,
  compare: PptxData,
): CompareResult {
  const diffs: SlideDiff[] = [];
  const maxLen = Math.max(base.slides.length, compare.slides.length);

  let addedCount = 0;
  let removedCount = 0;
  let changedCount = 0;
  let unchangedCount = 0;

  for (let i = 0; i < maxLen; i++) {
    const baseSlide = base.slides[i] as PptxSlide | undefined;
    const compareSlide = compare.slides[i] as PptxSlide | undefined;

    if (baseSlide && !compareSlide) {
      // Slide removed in compare
      diffs.push({
        status: "removed",
        baseIndex: i,
        compareIndex: -1,
        baseSlide,
        changes: [],
      });
      removedCount++;
    } else if (!baseSlide && compareSlide) {
      // Slide added in compare
      diffs.push({
        status: "added",
        baseIndex: -1,
        compareIndex: i,
        compareSlide,
        changes: [],
      });
      addedCount++;
    } else if (baseSlide && compareSlide) {
      // Both exist — diff elements
      const changes = diffSlideElements(
        baseSlide.elements,
        compareSlide.elements,
      );
      const bgChanged =
        baseSlide.backgroundColor !== compareSlide.backgroundColor;
      const notesChanged =
        (baseSlide.notes ?? "") !== (compareSlide.notes ?? "");

      if (changes.length > 0 || bgChanged || notesChanged) {
        if (bgChanged) {
          changes.push({
            elementId: "__background__",
            label: "Background",
            kind: "textChanged",
            description: `Background changed from ${baseSlide.backgroundColor ?? "default"} to ${compareSlide.backgroundColor ?? "default"}`,
          });
        }
        if (notesChanged) {
          changes.push({
            elementId: "__notes__",
            label: "Speaker Notes",
            kind: "textChanged",
            description: "Speaker notes changed",
          });
        }
        diffs.push({
          status: "changed",
          baseIndex: i,
          compareIndex: i,
          baseSlide,
          compareSlide,
          changes,
        });
        changedCount++;
      } else {
        diffs.push({
          status: "unchanged",
          baseIndex: i,
          compareIndex: i,
          baseSlide,
          compareSlide,
          changes: [],
        });
        unchangedCount++;
      }
    }
  }

  return {
    diffs,
    baseSlideCount: base.slides.length,
    compareSlideCount: compare.slides.length,
    addedCount,
    removedCount,
    changedCount,
    unchangedCount,
  };
}
