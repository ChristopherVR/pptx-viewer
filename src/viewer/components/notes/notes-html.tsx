import React from "react";
import type {
  BulletInfo,
  TextSegment,
  TextStyle,
} from "../../../core";
import {
  INDENT_PX,
  escapeHtml,
  normalizeSegments,
  parsePt,
  segmentsToParagraphs,
} from "./notes-utils";

/* ------------------------------------------------------------------ */
/*  Style derivation from DOM elements                                 */
/* ------------------------------------------------------------------ */

function deriveStyleFromElement(
  element: HTMLElement,
  inheritedStyle: TextStyle,
): TextStyle {
  const style: TextStyle = { ...inheritedStyle };
  const tagName = element.tagName.toLowerCase();
  if (tagName === "b" || tagName === "strong") style.bold = true;
  if (tagName === "i" || tagName === "em") style.italic = true;
  if (tagName === "u") style.underline = true;
  if (tagName === "s" || tagName === "strike") style.strikethrough = true;
  if (tagName === "a") {
    const href = element.getAttribute("href");
    if (href) style.hyperlink = href;
    style.underline = true;
    style.color = "#4a9eff";
  }

  const inlineStyle = element.style;
  if (
    inlineStyle.fontWeight === "bold" ||
    Number(inlineStyle.fontWeight) >= 600
  ) {
    style.bold = true;
  }
  if (inlineStyle.fontStyle === "italic") style.italic = true;
  if (
    inlineStyle.textDecoration.includes("underline") ||
    inlineStyle.textDecorationLine.includes("underline")
  ) {
    style.underline = true;
  }
  if (
    inlineStyle.textDecoration.includes("line-through") ||
    inlineStyle.textDecorationLine.includes("line-through")
  ) {
    style.strikethrough = true;
  }
  if (inlineStyle.color) style.color = inlineStyle.color;
  const fontSizePt = parsePt(inlineStyle.fontSize);
  if (fontSizePt !== undefined) style.fontSize = fontSizePt;
  if (inlineStyle.fontFamily) style.fontFamily = inlineStyle.fontFamily;
  return style;
}

/* ------------------------------------------------------------------ */
/*  Parse segments from a contentEditable rich editor                  */
/* ------------------------------------------------------------------ */

export function parseSegmentsFromRichEditor(root: HTMLElement): TextSegment[] {
  const segments: TextSegment[] = [];

  const walk = (node: Node, inheritedStyle: TextStyle) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const value = node.textContent ?? "";
      if (value.length > 0) {
        segments.push({ text: value, style: { ...inheritedStyle } });
      }
      return;
    }
    if (!(node instanceof HTMLElement)) return;

    if (node.tagName.toLowerCase() === "br") {
      segments.push({ text: "", style: {}, isParagraphBreak: true });
      return;
    }

    const nextStyle = deriveStyleFromElement(node, inheritedStyle);
    const tag = node.tagName.toLowerCase();
    const isBlock = ["div", "p", "li"].includes(tag);

    // Parse bullet/indent data attributes from paragraph divs
    let bulletInfo: BulletInfo | undefined;
    let paraIndent = 0;
    if (isBlock && node.dataset.bulletType) {
      const bt = node.dataset.bulletType;
      if (bt === "bullet") {
        bulletInfo = { char: "\u2022" };
      } else if (bt === "numbered") {
        bulletInfo = { autoNumType: "arabicPeriod" };
      }
    }
    if (isBlock && node.dataset.indentLevel) {
      paraIndent = Number.parseInt(node.dataset.indentLevel, 10) || 0;
    }

    // If this is a list item paragraph, mark the first text segment
    const segStartIdx = segments.length;
    node.childNodes.forEach((child) => walk(child, nextStyle));

    if (isBlock && (bulletInfo || paraIndent > 0)) {
      // Apply to first non-break segment in this block
      for (let i = segStartIdx; i < segments.length; i++) {
        if (!segments[i].isParagraphBreak) {
          if (bulletInfo) segments[i].bulletInfo = bulletInfo;
          if (paraIndent > 0) {
            segments[i].style = {
              ...segments[i].style,
              paragraphMarginLeft: paraIndent * INDENT_PX,
            };
          }
          break;
        }
      }
    }

    if (isBlock) {
      segments.push({ text: "", style: {}, isParagraphBreak: true });
    }
  };

  root.childNodes.forEach((child) => walk(child, {}));
  return normalizeSegments(segments);
}

/* ------------------------------------------------------------------ */
/*  Segments → editor HTML (for contentEditable innerHTML)             */
/* ------------------------------------------------------------------ */

export function segmentsToEditorHtml(segments: TextSegment[]): string {
  const paragraphs = segmentsToParagraphs(segments);
  let numberedCounter = 0;

  return paragraphs
    .map((para) => {
      if (para.bulletType === "numbered") {
        numberedCounter++;
      } else {
        numberedCounter = 0;
      }

      const runsHtml = para.segments
        .map((segment) => {
          if (segment.isParagraphBreak) return "";
          const inlineStyles: string[] = [];
          if (segment.style.bold) inlineStyles.push("font-weight:700");
          if (segment.style.italic) inlineStyles.push("font-style:italic");
          if (segment.style.underline)
            inlineStyles.push("text-decoration:underline");
          if (segment.style.strikethrough) {
            inlineStyles.push("text-decoration:line-through");
          }
          if (segment.style.color)
            inlineStyles.push(`color:${segment.style.color}`);
          if (segment.style.fontSize)
            inlineStyles.push(`font-size:${segment.style.fontSize}pt`);
          if (segment.style.fontFamily) {
            inlineStyles.push(`font-family:${segment.style.fontFamily}`);
          }

          const text = escapeHtml(segment.text);

          // Render hyperlinks as anchor tags
          if (segment.style.hyperlink) {
            const href = escapeHtml(segment.style.hyperlink);
            return `<a href="${href}" style="color:#4a9eff;text-decoration:underline;cursor:pointer" data-hyperlink="${href}">${text}</a>`;
          }

          const styleAttr =
            inlineStyles.length > 0 ? ` style="${inlineStyles.join(";")}"` : "";
          return `<span${styleAttr}>${text}</span>`;
        })
        .join("");

      // Wrap in a div with bullet/indent data
      const attrs: string[] = [];
      if (para.bulletType !== "none") {
        attrs.push(`data-bullet-type="${para.bulletType}"`);
      }
      if (para.indentLevel > 0) {
        attrs.push(`data-indent-level="${para.indentLevel}"`);
      }

      const indent = para.indentLevel * INDENT_PX;
      const divStyles: string[] = [];
      if (indent > 0) divStyles.push(`padding-left:${indent}px`);

      let prefix = "";
      if (para.bulletType === "bullet") {
        prefix = `<span style="margin-right:6px;color:#9ca3af" contenteditable="false">\u2022</span>`;
      } else if (para.bulletType === "numbered") {
        prefix = `<span style="margin-right:6px;color:#9ca3af" contenteditable="false">${numberedCounter}.</span>`;
      }

      const styleStr =
        divStyles.length > 0 ? ` style="${divStyles.join(";")}"` : "";
      const attrStr = attrs.length > 0 ? ` ${attrs.join(" ")}` : "";

      return `<div${attrStr}${styleStr}>${prefix}${runsHtml || "<br />"}</div>`;
    })
    .join("");
}

/* ------------------------------------------------------------------ */
/*  Render rich notes segments as React nodes (read-only display)      */
/* ------------------------------------------------------------------ */

export function renderRichNotesSegments(
  segments: TextSegment[],
): React.ReactNode[] {
  const paragraphs = segmentsToParagraphs(segments);
  const nodes: React.ReactNode[] = [];
  let numberedCounter = 0;

  paragraphs.forEach((para, pIdx) => {
    if (para.bulletType === "numbered") {
      numberedCounter++;
    } else {
      numberedCounter = 0;
    }

    const divStyle: React.CSSProperties = {};
    if (para.indentLevel > 0) {
      divStyle.paddingLeft = para.indentLevel * INDENT_PX;
    }

    const children: React.ReactNode[] = [];

    if (para.bulletType === "bullet") {
      children.push(
        <span key="bullet" style={{ marginRight: 6, color: "#9ca3af" }}>
          {"\u2022"}
        </span>,
      );
    } else if (para.bulletType === "numbered") {
      children.push(
        <span key="num" style={{ marginRight: 6, color: "#9ca3af" }}>
          {numberedCounter}.
        </span>,
      );
    }

    para.segments.forEach((segment, sIdx) => {
      if (segment.isParagraphBreak) return;
      const style: React.CSSProperties = {};
      if (segment.style.bold) style.fontWeight = "bold";
      if (segment.style.italic) style.fontStyle = "italic";
      if (segment.style.underline) style.textDecoration = "underline";
      if (segment.style.strikethrough) {
        style.textDecoration =
          (style.textDecoration ? `${style.textDecoration} ` : "") +
          "line-through";
      }
      if (segment.style.color) style.color = segment.style.color;
      if (segment.style.fontSize)
        style.fontSize = `${segment.style.fontSize}pt`;
      if (segment.style.fontFamily) style.fontFamily = segment.style.fontFamily;

      if (segment.style.hyperlink) {
        style.color = "#4a9eff";
        style.textDecoration = "underline";
        style.cursor = "pointer";
        children.push(
          <a
            key={`seg-${pIdx}-${sIdx}`}
            href={segment.style.hyperlink}
            style={style}
            onClick={(e) => {
              e.preventDefault();
              window.open(segment.style.hyperlink, "_blank");
            }}
          >
            {segment.text}
          </a>,
        );
      } else {
        children.push(
          <span key={`seg-${pIdx}-${sIdx}`} style={style}>
            {segment.text}
          </span>,
        );
      }
    });

    nodes.push(
      <div key={`p-${pIdx}`} style={divStyle}>
        {children.length > 0 ? children : <br />}
      </div>,
    );
  });

  return nodes;
}
