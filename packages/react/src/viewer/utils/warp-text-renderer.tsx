/**
 * SVG textPath-based text warp (WordArt) React component.
 *
 * Uses path generators from `warp-path-generators.ts` to render warped
 * text along SVG paths for presets that require it.
 */
import React from "react";

import type {
  PptxElement,
  PptxElementWithText,
  TextSegment,
  TextStyle,
} from "pptx-viewer-core";
import { hasTextProperties } from "pptx-viewer-core";
import {
  DEFAULT_TEXT_FONT_SIZE,
  DEFAULT_FONT_FAMILY,
  HYPERLINK_COLOR,
} from "../constants";
import { normalizeHexColor } from "./color";
import type {
  ElementFindHighlights,
  FieldSubstitutionContext,
} from "./text-render";
import { substituteFieldText } from "./text-render";
import { shouldUseSvgWarp, getWarpPath } from "./warp-path-generators";

// ── Paragraph grouping helper ──────────────────────────────────────────

interface WarpParagraph {
  segments: TextSegment[];
}

/**
 * Group an element's text segments into paragraphs (delimited by
 * `isParagraphBreak` segments), substituting field values when provided.
 */
function groupIntoParagraphs(
  element: PptxElementWithText,
  fieldContext?: FieldSubstitutionContext,
): WarpParagraph[] {
  if (!element.textSegments || element.textSegments.length === 0) {
    if (element.text) {
      return [{ segments: [{ text: element.text, style: {} }] }];
    }
    return [];
  }
  const paragraphs: WarpParagraph[] = [];
  let current: TextSegment[] = [];
  for (const seg of element.textSegments) {
    if (seg.isParagraphBreak) {
      if (current.length > 0) {
        paragraphs.push({ segments: current });
      }
      current = [];
    } else {
      let effective: TextSegment = seg;
      if (seg.fieldType && fieldContext) {
        const substituted = substituteFieldText(
          seg.text,
          seg.fieldType,
          fieldContext,
        );
        if (substituted !== seg.text) {
          effective = { ...seg, text: substituted };
        }
      }
      current.push(effective);
    }
  }
  if (current.length > 0) {
    paragraphs.push({ segments: current });
  }
  return paragraphs;
}

// ── SVG text-styling helpers ───────────────────────────────────────────

/** Map paragraph alignment to SVG textPath properties. */
function getAlignmentProps(align: TextStyle["align"]): {
  startOffset: string;
  textAnchor: "start" | "middle" | "end";
} {
  switch (align) {
    case "center":
      return { startOffset: "50%", textAnchor: "middle" };
    case "right":
      return { startOffset: "100%", textAnchor: "end" };
    case "left":
    case "justify":
    default:
      return { startOffset: "0%", textAnchor: "start" };
  }
}

/** Build SVG-compatible attribute props for a single text segment `<tspan>`. */
function getSegmentTspanProps(
  segment: TextSegment,
  element: PptxElementWithText,
  fallbackColor: string,
): React.SVGProps<SVGTSpanElement> {
  const s = segment.style || ({} as TextStyle);
  const decos: string[] = [];
  if (s.underline || s.hyperlink) decos.push("underline");
  if (s.strikethrough) decos.push("line-through");

  const fill = s.hyperlink
    ? normalizeHexColor(s.color || element.textStyle?.color, HYPERLINK_COLOR)
    : normalizeHexColor(s.color || element.textStyle?.color, fallbackColor);

  return {
    fill,
    fontSize: (s.fontSize ??
      element.textStyle?.fontSize ??
      DEFAULT_TEXT_FONT_SIZE) as number | undefined,
    fontWeight: s.bold ? 700 : 400,
    fontStyle: s.italic ? "italic" : undefined,
    fontFamily:
      s.fontFamily || element.textStyle?.fontFamily || DEFAULT_FONT_FAMILY,
    textDecoration: decos.length > 0 ? decos.join(" ") : undefined,
  };
}

// ── Public API - React component ───────────────────────────────────────

/** Props for the `WarpedText` SVG renderer. */
export interface WarpedTextProps {
  element: PptxElement;
  width: number;
  height: number;
  fallbackColor: string;
  findHighlights?: ElementFindHighlights;
  fieldContext?: FieldSubstitutionContext;
}

/**
 * Render warped (WordArt) text using SVG `<textPath>`.
 *
 * Call `shouldUseSvgWarp(preset)` first to determine if this component
 * should be used. For presets that return `false`, the existing HTML +
 * CSS transform approach in `getTextWarpStyle()` is used instead.
 */
export function WarpedText({
  element,
  width,
  height,
  fallbackColor,
  fieldContext,
}: WarpedTextProps): React.ReactElement | null {
  if (!hasTextProperties(element)) return null;
  const textEl = element as PptxElementWithText;
  const preset = textEl.textStyle?.textWarpPreset;
  if (!preset || !shouldUseSvgWarp(preset)) return null;

  const paragraphs = groupIntoParagraphs(textEl, fieldContext);
  if (paragraphs.length === 0) return null;

  const lineCount = paragraphs.length;
  const pathIdPrefix = `warp-${element.id}`;

  // Alignment
  const align = textEl.textStyle?.align ?? "center";
  const { startOffset, textAnchor } = getAlignmentProps(align);

  // Base font properties from element-level text style
  const baseFontSize = (textEl.textStyle?.fontSize ??
    DEFAULT_TEXT_FONT_SIZE) as number;
  const baseFontFamily = textEl.textStyle?.fontFamily ?? DEFAULT_FONT_FAMILY;
  const baseFill = normalizeHexColor(textEl.textStyle?.color, fallbackColor);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{
        overflow: "visible",
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
      }}
      aria-hidden="true"
    >
      <defs>
        {paragraphs.map((_para, i) => (
          <path
            key={`${pathIdPrefix}-def-${i}`}
            id={`${pathIdPrefix}-${i}`}
            d={getWarpPath(preset, width, height, i, lineCount)}
            fill="none"
          />
        ))}
      </defs>
      {paragraphs.map((para, paraIdx) => (
        <text
          key={`${pathIdPrefix}-txt-${paraIdx}`}
          fontSize={baseFontSize}
          fontFamily={baseFontFamily}
          fill={baseFill}
          fontWeight={textEl.textStyle?.bold ? 700 : 400}
          fontStyle={textEl.textStyle?.italic ? "italic" : "normal"}
        >
          <textPath
            href={`#${pathIdPrefix}-${paraIdx}`}
            startOffset={startOffset}
            textAnchor={textAnchor}
          >
            {para.segments.map((seg, segIdx) => (
              <tspan
                key={`${pathIdPrefix}-ts-${paraIdx}-${segIdx}`}
                {...getSegmentTspanProps(seg, textEl, fallbackColor)}
              >
                {seg.text}
              </tspan>
            ))}
          </textPath>
        </text>
      ))}
    </svg>
  );
}
