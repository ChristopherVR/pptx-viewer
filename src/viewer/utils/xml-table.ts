import type {
  PptxElement,
  TextStyle,
  XmlObject,
} from "../../core";
import {
  DEFAULT_TEXT_FONT_SIZE,
  EMU_PER_PX,
  MAX_TABLE_DIMENSION,
  MIN_ELEMENT_SIZE,
  MIN_TABLE_DIMENSION,
} from "../constants";

export function createTableCellXml(text: string): XmlObject {
  return {
    "a:txBody": {
      "a:bodyPr": {},
      "a:lstStyle": {},
      "a:p": {
        "a:r": {
          "a:rPr": {
            "@_lang": "en-US",
            "@_sz": "1800",
          },
          "a:t": text,
        },
      },
    },
    "a:tcPr": {
      "a:lnL": {
        "a:solidFill": { "a:srgbClr": { "@_val": "D1D5DB" } },
      },
      "a:lnR": {
        "a:solidFill": { "a:srgbClr": { "@_val": "D1D5DB" } },
      },
      "a:lnT": {
        "a:solidFill": { "a:srgbClr": { "@_val": "D1D5DB" } },
      },
      "a:lnB": {
        "a:solidFill": { "a:srgbClr": { "@_val": "D1D5DB" } },
      },
      "@_anchor": "t",
    },
  };
}

export function createTableGraphicFrameRawXml(
  element: PptxElement,
  rowCount: number,
  columnCount: number,
): XmlObject {
  const safeRows = Math.max(
    MIN_TABLE_DIMENSION,
    Math.min(MAX_TABLE_DIMENSION, Math.round(rowCount)),
  );
  const safeColumns = Math.max(
    MIN_TABLE_DIMENSION,
    Math.min(MAX_TABLE_DIMENSION, Math.round(columnCount)),
  );

  const columnWidth = Math.max(
    1,
    Math.round(
      (Math.max(element.width, MIN_ELEMENT_SIZE) * EMU_PER_PX) / safeColumns,
    ),
  );
  const rowHeight = Math.max(
    1,
    Math.round(
      (Math.max(element.height, MIN_ELEMENT_SIZE) * EMU_PER_PX) / safeRows,
    ),
  );
  const objectId = Math.floor(Math.random() * 10000) + 1000;
  const objectLabel = Math.floor(Math.random() * 100);

  return {
    "p:nvGraphicFramePr": {
      "p:cNvPr": {
        "@_id": String(objectId),
        "@_name": `Table ${objectLabel}`,
      },
      "p:cNvGraphicFramePr": {
        "a:graphicFrameLocks": {
          "@_noGrp": "1",
        },
      },
      "p:nvPr": {},
    },
    "p:xfrm": {
      "a:off": {
        "@_x": String(Math.round(element.x * EMU_PER_PX)),
        "@_y": String(Math.round(element.y * EMU_PER_PX)),
      },
      "a:ext": {
        "@_cx": String(Math.round(element.width * EMU_PER_PX)),
        "@_cy": String(Math.round(element.height * EMU_PER_PX)),
      },
      "@_flipH": element.flipHorizontal ? "1" : undefined,
      "@_flipV": element.flipVertical ? "1" : undefined,
      "@_rot": element.rotation
        ? String(Math.round(element.rotation * 60000))
        : undefined,
    },
    "a:graphic": {
      "a:graphicData": {
        "@_uri": "http://schemas.openxmlformats.org/drawingml/2006/table",
        "a:tbl": {
          "a:tblPr": {
            "@_firstRow": "1",
            "@_bandRow": "1",
          },
          "a:tblGrid": {
            "a:gridCol": Array.from({ length: safeColumns }, () => ({
              "@_w": String(columnWidth),
            })),
          },
          "a:tr": Array.from({ length: safeRows }, (_rowValue, rowIndex) => ({
            "@_h": String(rowHeight),
            "a:tc": Array.from(
              { length: safeColumns },
              (_columnValue, columnIndex) =>
                createTableCellXml(
                  rowIndex === 0 ? `Header ${columnIndex + 1}` : "",
                ),
            ),
          })),
        },
      },
    },
  };
}

export function applyTableCellTextAndStyle(
  cellXml: XmlObject,
  text: string,
  stylePatch: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    align?: TextStyle["align"];
    fontSize?: number;
  },
): void {
  const normalizedText = String(text || "");
  const txBody = (cellXml["a:txBody"] || {}) as XmlObject;
  const paragraph = {
    "a:pPr": {
      "@_algn":
        stylePatch.align === "center"
          ? "ctr"
          : stylePatch.align === "right"
            ? "r"
            : stylePatch.align === "justify"
              ? "just"
              : "l",
    },
    "a:r": {
      "a:rPr": {
        "@_lang": "en-US",
        "@_b": stylePatch.bold ? "1" : "0",
        "@_i": stylePatch.italic ? "1" : "0",
        "@_u": stylePatch.underline ? "sng" : "none",
        "@_sz": String(
          Math.max(
            800,
            Math.round((stylePatch.fontSize || DEFAULT_TEXT_FONT_SIZE) * 75),
          ),
        ),
      },
      "a:t": normalizedText,
    },
  };
  txBody["a:bodyPr"] = txBody["a:bodyPr"] || {};
  txBody["a:lstStyle"] = txBody["a:lstStyle"] || {};
  txBody["a:p"] = paragraph;
  cellXml["a:txBody"] = txBody;
}
