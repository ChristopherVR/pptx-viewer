import type {
  PptxNativeAnimation,
  PptxTextBuildType,
} from "../../core";

// ==========================================================================
// Text-build segment counts
// ==========================================================================

/** Paragraph / word / character counts used to expand text-build animations. */
export interface TextBuildSegmentCounts {
  /** Number of paragraphs in the text body. */
  paragraphCount: number;
  /** Number of words per paragraph (undefined when not needed). */
  wordCounts?: number[];
  /** Number of characters per paragraph (undefined when not needed). */
  charCounts?: number[];
}

/**
 * Count paragraphs, words and characters from an element's text segments.
 * Paragraph boundaries are segments whose text is exactly `"\n"`.
 */
export function countTextSegments(
  textSegments: ReadonlyArray<{ text: string }>,
): TextBuildSegmentCounts {
  const paragraphs: string[] = [""];
  for (const seg of textSegments) {
    if (seg.text === "\n") {
      paragraphs.push("");
    } else {
      paragraphs[paragraphs.length - 1] += seg.text;
    }
  }

  const wordCounts = paragraphs.map(
    (p) => p.trim().split(/\s+/).filter(Boolean).length,
  );
  const charCounts = paragraphs.map((p) => p.length);

  return {
    paragraphCount: paragraphs.length,
    wordCounts,
    charCounts,
  };
}

/**
 * Separator used between element ID and sub-element identifier
 * in composite animation target IDs (e.g. `"shape3::p0"`).
 */
export const TEXT_BUILD_ID_SEP = "::";

/**
 * Expand text-build animations into per-paragraph, per-word or per-character
 * sub-element animations.
 *
 * - **byParagraph**: each paragraph becomes its own click-group entry (trigger: onClick).
 * - **byWord**: words within each paragraph stagger with afterPrevious within same click.
 * - **byChar**: characters stagger with afterPrevious within same click.
 *
 * @param animations - Original animations (some may have `buildType` set).
 * @param segmentCounts - Map of elementId → segment counts from `countTextSegments()`.
 * @returns Expanded animation list with composite target IDs.
 */
export function expandTextBuildAnimations(
  animations: ReadonlyArray<PptxNativeAnimation>,
  segmentCounts: ReadonlyMap<string, TextBuildSegmentCounts>,
): PptxNativeAnimation[] {
  const result: PptxNativeAnimation[] = [];

  for (const anim of animations) {
    const buildType = anim.buildType;
    const targetId = anim.targetId ?? "";

    if (!buildType || buildType === "allAtOnce" || !targetId) {
      result.push(anim);
      continue;
    }

    const counts = segmentCounts.get(targetId);
    if (!counts) {
      result.push(anim);
      continue;
    }

    expandSingleBuildAnimation(anim, buildType, counts, result);
  }

  return result;
}

/**
 * Expand a single text-build animation into sub-element animations.
 */
function expandSingleBuildAnimation(
  anim: PptxNativeAnimation,
  buildType: PptxTextBuildType,
  counts: TextBuildSegmentCounts,
  output: PptxNativeAnimation[],
): void {
  const targetId = anim.targetId ?? "";
  const baseDuration = anim.durationMs ?? 500;

  if (buildType === "byParagraph") {
    for (let i = 0; i < counts.paragraphCount; i++) {
      output.push({
        ...anim,
        targetId: `${targetId}${TEXT_BUILD_ID_SEP}p${i}`,
        trigger: i === 0 ? anim.trigger : "onClick",
        buildType: undefined,
      });
    }
    return;
  }

  if (buildType === "byWord") {
    const wordCounts = counts.wordCounts ?? [];
    let stepIndex = 0;
    for (let pIdx = 0; pIdx < counts.paragraphCount; pIdx++) {
      const wc = wordCounts[pIdx] ?? 0;
      for (let wIdx = 0; wIdx < wc; wIdx++) {
        output.push({
          ...anim,
          targetId: `${targetId}${TEXT_BUILD_ID_SEP}w${pIdx}-${wIdx}`,
          trigger: stepIndex === 0 ? anim.trigger : "afterPrevious",
          durationMs: Math.max(100, Math.round(baseDuration / 2)),
          delayMs: stepIndex === 0 ? (anim.delayMs ?? 0) : 50,
          buildType: undefined,
        });
        stepIndex++;
      }
    }
    return;
  }

  if (buildType === "byChar") {
    const charCounts = counts.charCounts ?? [];
    let stepIndex = 0;
    for (let pIdx = 0; pIdx < counts.paragraphCount; pIdx++) {
      const cc = charCounts[pIdx] ?? 0;
      for (let cIdx = 0; cIdx < cc; cIdx++) {
        output.push({
          ...anim,
          targetId: `${targetId}${TEXT_BUILD_ID_SEP}c${pIdx}-${cIdx}`,
          trigger: stepIndex === 0 ? anim.trigger : "afterPrevious",
          durationMs: Math.max(50, Math.round(baseDuration / 4)),
          delayMs: stepIndex === 0 ? (anim.delayMs ?? 0) : 20,
          buildType: undefined,
        });
        stepIndex++;
      }
    }
    return;
  }

  // Unknown build type — keep original
  output.push(anim);
}
