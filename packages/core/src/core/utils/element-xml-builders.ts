/**
 * Template raw XML builders for creating new shapes and connectors
 * in the PPTX editor.
 */

import type {
  PptxElementWithText,
  ConnectorPptxElement,
  XmlObject,
} from "../types";
import { EMU_PER_PX } from "../constants";
import { normalizeStrokeDashType } from "./stroke-utils";
import { normalizeHexColor } from "../color/color-utils";
import { DEFAULT_STROKE_COLOR } from "../constants";

// ---------------------------------------------------------------------------
// Shape XML builder
// ---------------------------------------------------------------------------

export function createTemplateShapeRawXml(
  element: PptxElementWithText,
): XmlObject {
  const isText = element.type === "text";
  const name = isText ? "TextBox" : "Rectangle";
  const geometry =
    element.shapeType === "cylinder" ? "can" : element.shapeType || "rect";
  const adjustmentEntries = Object.entries(
    element.shapeAdjustments || {},
  ).filter(([key, value]) => key.trim().length > 0 && Number.isFinite(value));

  const avLst =
    adjustmentEntries.length > 0
      ? {
          "a:gd": adjustmentEntries.map(([key, value]) => ({
            "@_name": key,
            "@_fmla": `val ${Math.round(value)}`,
          })),
        }
      : {};
  return {
    "p:nvSpPr": {
      "p:cNvPr": {
        "@_id": String(Math.floor(Math.random() * 10000) + 1000),
        "@_name": `${name} ${Math.floor(Math.random() * 100)}`,
      },
      "p:cNvSpPr": {
        "@_txBox": isText ? "1" : "0",
      },
      "p:nvPr": {},
    },
    "p:spPr": {
      "a:xfrm": {
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
      },
      "a:prstGeom": {
        "@_prst": geometry,
        "a:avLst": avLst,
      },
    },
    "p:txBody": {
      "a:bodyPr": {
        "@_wrap": "square",
        "@_rtlCol": "0",
      },
      "a:lstStyle": {},
      "a:p": [
        {
          "a:r": {
            "a:rPr": { "@_lang": "en-US" },
            "a:t": isText ? element.text || "" : element.text || "",
          },
        },
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// Connector XML builder
// ---------------------------------------------------------------------------

export function createTemplateConnectorRawXml(
  element: ConnectorPptxElement,
): XmlObject {
  const geometry =
    element.shapeType && element.shapeType !== "connector"
      ? element.shapeType
      : "straightConnector1";
  const strokeColor = normalizeHexColor(
    element.shapeStyle?.strokeColor,
    DEFAULT_STROKE_COLOR,
  );
  const strokeWidth = Math.max(1, element.shapeStyle?.strokeWidth || 1);
  const lineNode: XmlObject = {
    "@_w": String(Math.round(strokeWidth * EMU_PER_PX)),
    "a:solidFill": {
      "a:srgbClr": {
        "@_val": strokeColor.replace("#", ""),
      },
    },
  };
  const normalizedDash = normalizeStrokeDashType(
    element.shapeStyle?.strokeDash,
  );
  if (normalizedDash && normalizedDash !== "solid") {
    if (normalizedDash === "custom") {
      lineNode["a:custDash"] = {
        "a:ds": {
          "@_d": "28222",
          "@_sp": "10583",
        },
      };
    } else {
      lineNode["a:prstDash"] = {
        "@_val": normalizedDash,
      };
    }
  }
  if (
    element.shapeStyle?.connectorStartArrow &&
    element.shapeStyle.connectorStartArrow !== "none"
  ) {
    lineNode["a:headEnd"] = {
      "@_type": element.shapeStyle.connectorStartArrow,
    };
  }
  if (
    element.shapeStyle?.connectorEndArrow &&
    element.shapeStyle.connectorEndArrow !== "none"
  ) {
    lineNode["a:tailEnd"] = {
      "@_type": element.shapeStyle.connectorEndArrow,
    };
  }

  return {
    "p:nvCxnSpPr": {
      "p:cNvPr": {
        "@_id": String(Math.floor(Math.random() * 10000) + 1000),
        "@_name": `Connector ${Math.floor(Math.random() * 100)}`,
      },
      "p:cNvCxnSpPr": {},
      "p:nvPr": {},
    },
    "p:spPr": {
      "a:xfrm": {
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
      },
      "a:prstGeom": {
        "@_prst": geometry,
        "a:avLst": {},
      },
      "a:ln": lineNode,
    },
  };
}
