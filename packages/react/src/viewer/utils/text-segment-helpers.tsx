import React from "react";

import type { BulletInfo } from "pptx-viewer-core";
import { convertOmmlToMathMl, type OmmlNode } from "./omml-to-mathml";
import {
  segmentByScript,
  resolveFontForScript,
} from "./unicode-script-detection";

/* Highlight info for a single segment, used by Find & Replace */
export interface TextSegmentHighlight {
  startOffset: number;
  length: number;
  isCurrent: boolean; // true for the currently focused match
}

/* Highlights grouped by segment index for an element */
export type ElementFindHighlights = Map<number, TextSegmentHighlight[]>;

/** Per-script font family set used by script-aware text rendering. */
export interface ScriptFonts {
  latin: string;
  eastAsia: string;
  complexScript: string;
  symbol: string;
}

/**
 * Render text with per-script font spans when fonts differ across Unicode
 * script categories (latin, eastAsia, complexScript, symbol).
 *
 * When all script fonts are the same (common case), returns the plain text
 * string with zero extra DOM overhead.
 */
export function renderScriptAwareText(
  text: string,
  needsScriptFonts: boolean,
  scriptFonts: ScriptFonts,
  baseFontFamily: string,
  keyPrefix: string,
): React.ReactNode {
  if (!needsScriptFonts || !text) return text;

  const runs = segmentByScript(text);
  if (runs.length <= 1) {
    // Single script — resolve font for that script inline
    if (runs.length === 1) {
      const font = resolveFontForScript(runs[0].script, scriptFonts);
      if (font && font !== baseFontFamily) {
        return <span style={{ fontFamily: font }}>{text}</span>;
      }
    }
    return text;
  }

  return runs.map((run, i) => {
    const font = resolveFontForScript(run.script, scriptFonts);
    if (!font || font === baseFontFamily) {
      return (
        <React.Fragment key={`${keyPrefix}-r${i}`}>{run.text}</React.Fragment>
      );
    }
    return (
      <span key={`${keyPrefix}-r${i}`} style={{ fontFamily: font }}>
        {run.text}
      </span>
    );
  });
}

/**
 * Render the inner content of a text segment span, handling both the
 * no-highlight fast path and the find-highlight split path.
 */
export function renderSegmentContent(
  elementId: string,
  segmentIndex: number,
  textValue: string,
  lines: string[],
  needsScriptFonts: boolean,
  scriptFonts: ScriptFonts,
  baseFontFamily: string,
  findHighlights: ElementFindHighlights | undefined,
): React.ReactNode {
  const segHl = findHighlights?.get(segmentIndex);
  if (!segHl || segHl.length === 0) {
    // Fast path: no highlights — render lines with script-aware fonts
    return lines.map((line: string, lineIndex: number) => (
      <React.Fragment
        key={`${elementId}-seg-${segmentIndex}-line-${lineIndex}`}
      >
        {renderScriptAwareText(
          line,
          needsScriptFonts,
          scriptFonts,
          baseFontFamily,
          `${elementId}-seg-${segmentIndex}-line-${lineIndex}`,
        )}
        {lineIndex < lines.length - 1 ? <br /> : null}
      </React.Fragment>
    ));
  }

  // Split the entire segment text into highlighted/plain chunks
  const sorted = [...segHl].sort((a, b) => a.startOffset - b.startOffset);
  const chunks: Array<{
    text: string;
    highlighted: boolean;
    isCurrent: boolean;
  }> = [];
  let cursor = 0;
  for (const hl of sorted) {
    if (hl.startOffset > cursor) {
      chunks.push({
        text: textValue.slice(cursor, hl.startOffset),
        highlighted: false,
        isCurrent: false,
      });
    }
    chunks.push({
      text: textValue.slice(hl.startOffset, hl.startOffset + hl.length),
      highlighted: true,
      isCurrent: hl.isCurrent,
    });
    cursor = hl.startOffset + hl.length;
  }
  if (cursor < textValue.length) {
    chunks.push({
      text: textValue.slice(cursor),
      highlighted: false,
      isCurrent: false,
    });
  }
  return chunks.map((chunk, ci) =>
    chunk.highlighted ? (
      <mark
        key={`${elementId}-seg-${segmentIndex}-hl-${ci}`}
        style={{
          backgroundColor: chunk.isCurrent ? "#f97316" : "#facc15",
          color: "inherit",
          borderRadius: 2,
        }}
      >
        {renderScriptAwareText(
          chunk.text,
          needsScriptFonts,
          scriptFonts,
          baseFontFamily,
          `${elementId}-seg-${segmentIndex}-hl-${ci}`,
        )}
      </mark>
    ) : (
      <React.Fragment key={`${elementId}-seg-${segmentIndex}-hl-${ci}`}>
        {renderScriptAwareText(
          chunk.text,
          needsScriptFonts,
          scriptFonts,
          baseFontFamily,
          `${elementId}-seg-${segmentIndex}-hl-${ci}`,
        )}
      </React.Fragment>
    ),
  );
}

/**
 * Render an equation segment (inline MathML from OMML).
 * Returns a React node, or `null` if not an equation.
 *
 * When `equationNumber` is provided, the equation is rendered centered with
 * the number right-aligned using a flexbox `justify-content: space-between`
 * layout, matching the standard academic equation numbering convention.
 */
export function renderEquationSegment(
  elementId: string,
  segmentIndex: number,
  equationXml: Record<string, unknown>,
  equationNumber?: string,
): React.ReactNode {
  const mathml = convertOmmlToMathMl(equationXml as OmmlNode);

  const equationContent = mathml ? (
    <span
      className="inline-block align-middle"
      style={{
        fontFamily: '"Cambria Math", "STIX Two Math", serif',
      }}
      dangerouslySetInnerHTML={{ __html: mathml }}
    />
  ) : (
    <span className="inline-block px-1 py-0.5 rounded text-xs bg-gray-200/20 text-gray-400 italic">
      Equation
    </span>
  );

  // When an equation number is provided, wrap in a flex container:
  // equation centered, number right-aligned.
  if (equationNumber) {
    return (
      <span
        key={`${elementId}-seg-${segmentIndex}`}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%",
        }}
      >
        {/* Left spacer to balance the right-aligned number */}
        <span style={{ visibility: "hidden", whiteSpace: "nowrap" }}>
          ({equationNumber})
        </span>
        <span style={{ textAlign: "center", flex: 1 }}>
          {equationContent}
        </span>
        <span
          style={{
            whiteSpace: "nowrap",
            fontFamily: '"Cambria Math", "STIX Two Math", serif',
          }}
        >
          ({equationNumber})
        </span>
      </span>
    );
  }

  return (
    <span key={`${elementId}-seg-${segmentIndex}`}>
      {equationContent}
    </span>
  );
}

/**
 * Render a picture bullet as an `<img>` element.
 *
 * When `bulletInfo.imageDataUrl` is available, renders an `<img>` sized to
 * match the bullet/font size. When only `imageRelId` is set (image not yet
 * resolved), falls back to a default character bullet so the user never sees
 * a broken image icon.
 */
export function renderPictureBullet(
  elementId: string,
  segmentIndex: number,
  bulletInfo: BulletInfo,
  baseFontSize: number,
): React.ReactNode {
  const bulletSize =
    typeof bulletInfo.sizePts === "number"
      ? bulletInfo.sizePts
      : typeof bulletInfo.sizePercent === "number"
        ? baseFontSize * (bulletInfo.sizePercent / 100)
        : baseFontSize;

  // Fallback: when no resolved image data URL is available, render a
  // default character bullet instead of a broken <img>.
  // Uses marginInlineEnd so that the spacing is correct in both LTR
  // (margin appears on the right) and RTL (margin appears on the left).
  if (!bulletInfo.imageDataUrl) {
    return (
      <span
        key={`${elementId}-seg-${segmentIndex}-bullet-fallback`}
        style={{
          fontSize: bulletSize,
          display: "inline-block",
          verticalAlign: "middle",
          marginInlineEnd: 4,
          color: bulletInfo.color || undefined,
          fontFamily: bulletInfo.fontFamily || undefined,
        }}
        aria-label="Bullet"
      >
        {"\u2022 "}
      </span>
    );
  }

  return (
    <img
      key={`${elementId}-seg-${segmentIndex}-bullet-img`}
      src={bulletInfo.imageDataUrl}
      alt="Bullet"
      style={{
        width: bulletSize,
        height: bulletSize,
        display: "inline-block",
        verticalAlign: "middle",
        marginInlineEnd: 4,
        objectFit: "contain",
      }}
    />
  );
}

/**
 * CSS properties that fully describe the visual appearance of an underline
 * or strikethrough decoration. Returned by {@link resolveUnderlineDecorationStyle}.
 */
export interface UnderlineDecorationCss {
  textDecorationStyle?: React.CSSProperties["textDecorationStyle"];
  textDecorationThickness?: string;
  textUnderlineOffset?: string;
}

/**
 * Resolve an OOXML underline / strikethrough style to a set of CSS
 * text-decoration properties that make all 16 underline types visually
 * distinct.
 *
 * CSS `text-decoration-style` only has 5 variants (solid, double, dotted,
 * dashed, wavy), so we use `text-decoration-thickness` to differentiate
 * heavy variants and `text-underline-offset` for additional visual
 * separation where compound patterns (dotDash, dotDotDash, dashLong)
 * share the same CSS base style.
 */
export function resolveUnderlineDecorationStyle(
  isDoubleStrike: boolean,
  underlineStyle?: string,
): UnderlineDecorationCss | undefined {
  if (isDoubleStrike) return { textDecorationStyle: "double" };
  if (!underlineStyle || underlineStyle === "none") return undefined;

  switch (underlineStyle) {
    // ── Single / default ──
    case "sng":
      return { textDecorationStyle: "solid", textDecorationThickness: "1px" };

    // ── Double ──
    case "dbl":
      return { textDecorationStyle: "double", textDecorationThickness: "1px" };

    // ── Heavy (thick solid) ──
    case "heavy":
      return { textDecorationStyle: "solid", textDecorationThickness: "3px" };

    // ── Dotted ──
    case "dotted":
      return { textDecorationStyle: "dotted", textDecorationThickness: "1px" };
    case "dottedHeavy":
      return { textDecorationStyle: "dotted", textDecorationThickness: "3px" };

    // ── Dashed ──
    case "dash":
      return { textDecorationStyle: "dashed", textDecorationThickness: "1px" };
    case "dashHeavy":
      return { textDecorationStyle: "dashed", textDecorationThickness: "3px" };

    // ── Long dashed (offset to distinguish from regular dash) ──
    case "dashLong":
      return { textDecorationStyle: "dashed", textDecorationThickness: "1px", textUnderlineOffset: "3px" };
    case "dashLongHeavy":
      return { textDecorationStyle: "dashed", textDecorationThickness: "3px", textUnderlineOffset: "3px" };

    // ── Dot-dash (CSS closest: dashed with offset) ──
    case "dotDash":
      return { textDecorationStyle: "dashed", textDecorationThickness: "1px", textUnderlineOffset: "2px" };
    case "dotDashHeavy":
      return { textDecorationStyle: "dashed", textDecorationThickness: "3px", textUnderlineOffset: "2px" };

    // ── Dot-dot-dash (CSS closest: dotted with offset) ──
    case "dotDotDash":
      return { textDecorationStyle: "dotted", textDecorationThickness: "1px", textUnderlineOffset: "3px" };
    case "dotDotDashHeavy":
      return { textDecorationStyle: "dotted", textDecorationThickness: "3px", textUnderlineOffset: "3px" };

    // ── Wavy ──
    case "wavy":
      return { textDecorationStyle: "wavy", textDecorationThickness: "1px" };
    case "wavyHeavy":
      return { textDecorationStyle: "wavy", textDecorationThickness: "3px" };

    // ── Wavy double (wavy + thicker as closest CSS approximation) ──
    case "wavyDbl":
      return { textDecorationStyle: "wavy", textDecorationThickness: "2px", textUnderlineOffset: "1px" };

    default:
      return undefined;
  }
}
