/**
 * Remap edited plain-text back onto original rich-text segments,
 * preserving per-segment styles (font, size, colour, bold, italic, etc.).
 */
import type { TextSegment, TextStyle } from "../../core";

/**
 * Strategy:
 * 1. Split both original segments and new text into paragraphs by "\n".
 * 2. Distribute new characters proportionally across segments.
 * 3. Extra chars go to last segment, extra paragraphs inherit last style.
 * 4. Re-insert paragraph-break markers between paragraphs.
 */
export function remapTextToSegments(
  newText: string,
  originalSegments: TextSegment[] | undefined,
  elementTextStyle: TextStyle | undefined,
): TextSegment[] {
  const fallbackStyle: TextStyle = { ...(elementTextStyle ?? {}) };

  if (!originalSegments || originalSegments.length === 0) {
    return [{ text: newText, style: fallbackStyle }];
  }

  // Split original segments into paragraphs by paragraph-break markers.
  const originalParagraphs: TextSegment[][] = [[]];
  for (const seg of originalSegments) {
    if (seg.text === "\n" || seg.isParagraphBreak) {
      originalParagraphs.push([]);
    } else {
      originalParagraphs[originalParagraphs.length - 1].push(seg);
    }
  }

  const newParagraphTexts = newText.split("\n");

  const firstContentSeg = originalParagraphs
    .flat()
    .find((s) => s.text.trim().length > 0);
  const baseFallbackStyle: TextStyle = firstContentSeg?.style
    ? { ...firstContentSeg.style }
    : fallbackStyle;

  function remapParagraph(
    paraNewText: string,
    paraOrigSegments: TextSegment[],
  ): TextSegment[] {
    if (paraOrigSegments.length === 0) {
      return paraNewText.length > 0
        ? [{ text: paraNewText, style: { ...baseFallbackStyle } }]
        : [{ text: "", style: { ...baseFallbackStyle } }];
    }

    const paragraphBulletInfo = paraOrigSegments[0].bulletInfo;

    if (paraNewText.length === 0) {
      const emptyStyle = { ...paraOrigSegments[0].style };
      const result: TextSegment[] = [{ text: "", style: emptyStyle }];
      if (paragraphBulletInfo) {
        result[0].bulletInfo = paragraphBulletInfo;
      }
      return result;
    }

    const totalOrigLen = paraOrigSegments.reduce(
      (sum, s) => sum + s.text.length,
      0,
    );

    if (totalOrigLen === 0) {
      const result: TextSegment[] = [
        { text: paraNewText, style: { ...paraOrigSegments[0].style } },
      ];
      if (paragraphBulletInfo) {
        result[0].bulletInfo = paragraphBulletInfo;
      }
      return result;
    }

    const remapped: TextSegment[] = [];
    let newPos = 0;

    for (let i = 0; i < paraOrigSegments.length; i++) {
      const origSeg = paraOrigSegments[i];
      const isLastSeg = i === paraOrigSegments.length - 1;
      const origLen = origSeg.text.length;

      if (newPos >= paraNewText.length) break;

      let segText: string;
      if (isLastSeg) {
        segText = paraNewText.slice(newPos);
      } else {
        segText = paraNewText.slice(newPos, newPos + origLen);
      }

      if (segText.length > 0) {
        const outSeg: TextSegment = {
          text: segText,
          style: { ...origSeg.style },
        };
        if (remapped.length === 0 && paragraphBulletInfo) {
          outSeg.bulletInfo = paragraphBulletInfo;
        }
        remapped.push(outSeg);
      }

      newPos += isLastSeg ? segText.length : origLen;
    }

    if (remapped.length === 0) {
      const fallback: TextSegment = {
        text: paraNewText,
        style: { ...paraOrigSegments[0].style },
      };
      if (paragraphBulletInfo) {
        fallback.bulletInfo = paragraphBulletInfo;
      }
      return [fallback];
    }

    return remapped;
  }

  const output: TextSegment[] = [];
  const lastOrigPara = originalParagraphs[originalParagraphs.length - 1];

  for (let pi = 0; pi < newParagraphTexts.length; pi++) {
    if (pi > 0) {
      const precedingOrigPara = originalParagraphs[pi - 1] ?? [];
      const breakStyle = precedingOrigPara[0]?.style
        ? { ...precedingOrigPara[0].style }
        : { ...baseFallbackStyle };
      output.push({ text: "\n", style: breakStyle, isParagraphBreak: true });
    }

    const origPara = originalParagraphs[pi] ?? lastOrigPara ?? [];
    const paraSegments = remapParagraph(newParagraphTexts[pi], origPara);
    output.push(...paraSegments);
  }

  return output.length > 0
    ? output
    : [{ text: "", style: { ...baseFallbackStyle } }];
}
