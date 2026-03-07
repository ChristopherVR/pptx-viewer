import { XmlObject, type ShapeStyle } from "../../types";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeSaveXmlHelpers";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  /**
   * Serialize shape fill, stroke, dash, arrows, line join/cap/compound,
   * and line-level effects to the given spPr XML object.
   */
  protected applyFillAndStroke(spPr: XmlObject, shapeStyle: ShapeStyle): void {
    const requestedFillMode = shapeStyle.fillMode;
    const gradientFillXml = this.buildGradientFillXml(shapeStyle);

    // Fill
    if (
      requestedFillMode === "none" ||
      shapeStyle.fillColor === "transparent"
    ) {
      spPr["a:noFill"] = {};
      delete spPr["a:solidFill"];
      delete spPr["a:gradFill"];
      delete spPr["a:blipFill"];
    } else if (requestedFillMode === "gradient") {
      delete spPr["a:noFill"];
      delete spPr["a:solidFill"];
      delete spPr["a:blipFill"];
      if (gradientFillXml) {
        spPr["a:gradFill"] = gradientFillXml;
      }
    } else if (requestedFillMode === "pattern") {
      // Round-trip pattern fill: re-serialize from parsed fields
      delete spPr["a:noFill"];
      delete spPr["a:solidFill"];
      delete spPr["a:gradFill"];
      delete spPr["a:blipFill"];
      const pattNode: XmlObject = {};
      const preset = shapeStyle.fillPatternPreset;
      if (preset) {
        pattNode["@_prst"] = preset;
      }
      // Prefer preserved raw XML colour nodes (retains color transforms)
      if (shapeStyle.fillPatternFgClrXml) {
        pattNode["a:fgClr"] = shapeStyle.fillPatternFgClrXml;
      } else if (shapeStyle.fillColor) {
        pattNode["a:fgClr"] = {
          "a:srgbClr": {
            "@_val": shapeStyle.fillColor.replace("#", ""),
          },
        };
      }
      if (shapeStyle.fillPatternBgClrXml) {
        pattNode["a:bgClr"] = shapeStyle.fillPatternBgClrXml;
      } else if (shapeStyle.fillPatternBackgroundColor) {
        pattNode["a:bgClr"] = {
          "a:srgbClr": {
            "@_val": shapeStyle.fillPatternBackgroundColor.replace("#", ""),
          },
        };
      }
      spPr["a:pattFill"] = pattNode;
    } else if (
      requestedFillMode === "solid" ||
      shapeStyle.fillColor !== undefined
    ) {
      const fillColor = String(shapeStyle.fillColor || "").trim();
      if (fillColor.length > 0) {
        delete spPr["a:noFill"];
        delete spPr["a:gradFill"];
        delete spPr["a:blipFill"];
        const solidFill: XmlObject = {
          "a:srgbClr": {
            "@_val": fillColor.replace("#", ""),
          },
        };
        if (
          typeof shapeStyle.fillOpacity === "number" &&
          shapeStyle.fillOpacity >= 0 &&
          shapeStyle.fillOpacity < 1
        ) {
          (solidFill["a:srgbClr"] as XmlObject)["a:alpha"] = {
            "@_val": String(
              Math.round(
                this.clampUnitInterval(shapeStyle.fillOpacity) * 100000,
              ),
            ),
          };
        }
        spPr["a:solidFill"] = solidFill;
      }
    }

    // Stroke
    if (shapeStyle.strokeColor !== undefined) {
      if (!spPr["a:ln"]) spPr["a:ln"] = {};
      const lineNode = spPr["a:ln"] as XmlObject;
      const w = Math.round(
        (shapeStyle.strokeWidth || 1) * PptxHandlerRuntime.EMU_PER_PX,
      );
      lineNode["@_w"] = String(w);
      if (
        shapeStyle.strokeColor === "transparent" ||
        shapeStyle.strokeWidth === 0
      ) {
        lineNode["a:noFill"] = {};
        delete lineNode["a:solidFill"];
      } else {
        delete lineNode["a:noFill"];
        const lineFill: XmlObject = {
          "a:srgbClr": {
            "@_val": shapeStyle.strokeColor.replace("#", ""),
          },
        };
        if (
          typeof shapeStyle.strokeOpacity === "number" &&
          shapeStyle.strokeOpacity >= 0 &&
          shapeStyle.strokeOpacity < 1
        ) {
          (lineFill["a:srgbClr"] as XmlObject)["a:alpha"] = {
            "@_val": String(
              Math.round(
                this.clampUnitInterval(shapeStyle.strokeOpacity) * 100000,
              ),
            ),
          };
        }
        lineNode["a:solidFill"] = lineFill;
      }
    }
    if (shapeStyle.strokeDash !== undefined) {
      if (!spPr["a:ln"]) spPr["a:ln"] = {};
      const lineNode = spPr["a:ln"] as XmlObject;
      if (shapeStyle.strokeDash === "solid") {
        delete lineNode["a:prstDash"];
        delete lineNode["a:custDash"];
      } else if (shapeStyle.strokeDash === "custom") {
        delete lineNode["a:prstDash"];
        if (
          shapeStyle.customDashSegments &&
          shapeStyle.customDashSegments.length > 0
        ) {
          lineNode["a:custDash"] = {
            "a:ds": shapeStyle.customDashSegments.map((seg) => ({
              "@_d": String(seg.dash),
              "@_sp": String(seg.space),
            })),
          };
        } else {
          lineNode["a:custDash"] = {
            "a:ds": { "@_d": "200000", "@_sp": "200000" },
          };
        }
      } else {
        lineNode["a:prstDash"] = { "@_val": shapeStyle.strokeDash };
        delete lineNode["a:custDash"];
      }
    }

    // Connector arrows
    if (
      shapeStyle.connectorEndArrow !== undefined &&
      (spPr["a:ln"] || shapeStyle.connectorEndArrow !== "none")
    ) {
      if (!spPr["a:ln"]) spPr["a:ln"] = {};
      const lineNode = spPr["a:ln"] as XmlObject;
      if (shapeStyle.connectorEndArrow === "none") {
        delete lineNode["a:tailEnd"];
      } else {
        const tailEnd: XmlObject = { "@_type": shapeStyle.connectorEndArrow };
        if (shapeStyle.connectorEndArrowWidth)
          tailEnd["@_w"] = shapeStyle.connectorEndArrowWidth;
        if (shapeStyle.connectorEndArrowLength)
          tailEnd["@_len"] = shapeStyle.connectorEndArrowLength;
        lineNode["a:tailEnd"] = tailEnd;
      }
    }
    if (
      shapeStyle.connectorStartArrow !== undefined &&
      (spPr["a:ln"] || shapeStyle.connectorStartArrow !== "none")
    ) {
      if (!spPr["a:ln"]) spPr["a:ln"] = {};
      const lineNode = spPr["a:ln"] as XmlObject;
      if (shapeStyle.connectorStartArrow === "none") {
        delete lineNode["a:headEnd"];
      } else {
        const headEnd: XmlObject = {
          "@_type": shapeStyle.connectorStartArrow,
        };
        if (shapeStyle.connectorStartArrowWidth)
          headEnd["@_w"] = shapeStyle.connectorStartArrowWidth;
        if (shapeStyle.connectorStartArrowLength)
          headEnd["@_len"] = shapeStyle.connectorStartArrowLength;
        lineNode["a:headEnd"] = headEnd;
      }
    }

    // Line join style
    if (shapeStyle.lineJoin !== undefined) {
      if (!spPr["a:ln"]) spPr["a:ln"] = {};
      const lineNode = spPr["a:ln"] as XmlObject;
      delete lineNode["a:round"];
      delete lineNode["a:bevel"];
      delete lineNode["a:miter"];
      if (shapeStyle.lineJoin === "round") {
        lineNode["a:round"] = {};
      } else if (shapeStyle.lineJoin === "bevel") {
        lineNode["a:bevel"] = {};
      } else if (shapeStyle.lineJoin === "miter") {
        lineNode["a:miter"] = { "@_lim": "800000" };
      }
    }
    // Line cap style
    if (shapeStyle.lineCap !== undefined) {
      if (!spPr["a:ln"]) spPr["a:ln"] = {};
      (spPr["a:ln"] as XmlObject)["@_cap"] = shapeStyle.lineCap;
    }
    // Compound line type
    if (shapeStyle.compoundLine !== undefined) {
      if (!spPr["a:ln"]) spPr["a:ln"] = {};
      (spPr["a:ln"] as XmlObject)["@_cmpd"] = shapeStyle.compoundLine;
    }

    // Line-level effects (a:ln/a:effectLst)
    const lineEffectListXml = this.buildLineEffectListXml(shapeStyle);
    if (lineEffectListXml && spPr["a:ln"]) {
      (spPr["a:ln"] as XmlObject)["a:effectLst"] = lineEffectListXml;
    }
  }
}
