import React from "react";
import { hasTextProperties } from "pptx-viewer-core";
import type { PptxElement, TextStyle } from "pptx-viewer-core";
import { gB, gL, grp, FMT, ATXT } from "./toolbar-constants";

export interface TextSectionProps {
  canEdit: boolean;
  selectedElement: PptxElement | null;
  onUpdateTextStyle: (updates: Partial<TextStyle>) => void;
}

export function TextSection(p: TextSectionProps): React.ReactElement {
  const hasSel = !!p.selectedElement;
  const canMut = hasSel && p.canEdit;
  const hasTxt =
    hasSel &&
    p.selectedElement !== null &&
    hasTextProperties(p.selectedElement);

  return (
    <>
      <div className={grp}>
        {FMT.map((b, i, a) => {
          const handleClick = () => {
            if (!hasTxt || !p.selectedElement) return;
            const ts = hasTextProperties(p.selectedElement)
              ? p.selectedElement.textStyle
              : undefined;
            switch (b.t) {
              case "Bold":
                p.onUpdateTextStyle({ bold: !ts?.bold });
                break;
              case "Italic":
                p.onUpdateTextStyle({ italic: !ts?.italic });
                break;
              case "Underline":
                p.onUpdateTextStyle({
                  underline: !ts?.underline,
                });
                break;
              case "Strikethrough":
                p.onUpdateTextStyle({
                  strikethrough: !ts?.strikethrough,
                });
                break;
            }
          };
          return (
            <button
              key={b.t}
              type="button"
              disabled={!canMut}
              onClick={handleClick}
              className={i < a.length - 1 ? gB : gL}
              title={b.t}
            >
              {b.i}
            </button>
          );
        })}
      </div>
      <div className={grp}>
        {ATXT.map((b, i, a) => {
          const handleClick = () => {
            if (!hasTxt) return;
            const alignMap: Record<
              string,
              "left" | "center" | "right" | "justify"
            > = {
              "Align left": "left",
              "Align center": "center",
              "Align right": "right",
              Justify: "justify",
            };
            const align = alignMap[b.t];
            if (align) p.onUpdateTextStyle({ align });
          };
          return (
            <button
              key={b.t}
              type="button"
              disabled={!canMut}
              onClick={handleClick}
              className={i < a.length - 1 ? gB : gL}
              title={b.t}
            >
              {b.i}
            </button>
          );
        })}
      </div>
    </>
  );
}
