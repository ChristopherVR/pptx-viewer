import type {
  ConnectorArrowType,
  ShapeStyle,
  StrokeDashType,
  XmlObject,
} from "../../types";

export interface ShapeLineStyleContext {
  emuPerPx: number;
  parseColor: (
    colorNode: XmlObject | undefined,
    placeholderColor?: string,
  ) => string | undefined;
  extractColorOpacity: (colorNode: XmlObject | undefined) => number | undefined;
  extractGradientFillColor: (gradFill: XmlObject) => string | undefined;
  extractGradientOpacity: (gradFill: XmlObject) => number | undefined;
  normalizeStrokeDashType: (value: unknown) => StrokeDashType | undefined;
  normalizeConnectorArrowType: (
    value: unknown,
  ) => ConnectorArrowType | undefined;
  ensureArray: (value: unknown) => unknown[];
}

/**
 * Extract line/stroke properties from an `a:ln` node and apply them to the style.
 * Returns `true` if the caller should perform an early return (noFill case).
 */
export function applyLineProperties(
  lineNode: XmlObject,
  shapeProps: XmlObject,
  style: ShapeStyle,
  context: ShapeLineStyleContext,
  resolveHiddenLine: (props: XmlObject) => XmlObject | undefined,
): boolean {
  if (lineNode["a:noFill"]) {
    const hiddenLineProps = resolveHiddenLine(shapeProps);
    if (hiddenLineProps) {
      if (hiddenLineProps["@_w"]) {
        style.strokeWidth =
          parseInt(String(hiddenLineProps["@_w"]), 10) / context.emuPerPx;
      }
      const hiddenLineFill = hiddenLineProps["a:solidFill"] as
        | XmlObject
        | undefined;
      if (hiddenLineFill) {
        style.strokeColor = context.parseColor(hiddenLineFill);
        style.strokeOpacity = context.extractColorOpacity(hiddenLineFill);
      }
    } else {
      style.strokeWidth = 0;
      style.strokeColor = "transparent";
    }
    return true;
  }

  if (lineNode["@_w"]) {
    style.strokeWidth =
      parseInt(String(lineNode["@_w"]), 10) / context.emuPerPx;
  }

  applyStrokeColor(lineNode, style, context);
  applyDashProperties(lineNode, style, context);
  applyArrowProperties(lineNode, style, context);
  applyJoinCapCompound(lineNode, style);
  applyLineEffects(lineNode, style, context);

  return false;
}

function applyStrokeColor(
  lineNode: XmlObject,
  style: ShapeStyle,
  context: ShapeLineStyleContext,
): void {
  if (lineNode["a:solidFill"]) {
    const lineFill = lineNode["a:solidFill"] as XmlObject;
    style.strokeColor = context.parseColor(lineFill);
    style.strokeOpacity = context.extractColorOpacity(lineFill);
  } else if (lineNode["a:gradFill"]) {
    style.strokeColor = context.extractGradientFillColor(
      lineNode["a:gradFill"] as XmlObject,
    );
    style.strokeOpacity = context.extractGradientOpacity(
      lineNode["a:gradFill"] as XmlObject,
    );
  } else if (lineNode["a:pattFill"]) {
    const linePatternFill = lineNode["a:pattFill"] as XmlObject;
    style.strokeColor =
      context.parseColor(linePatternFill["a:fgClr"] as XmlObject | undefined) ||
      context.parseColor(linePatternFill["a:bgClr"] as XmlObject | undefined);
    style.strokeOpacity =
      context.extractColorOpacity(
        linePatternFill["a:fgClr"] as XmlObject | undefined,
      ) ||
      context.extractColorOpacity(
        linePatternFill["a:bgClr"] as XmlObject | undefined,
      );
  }
}

function applyDashProperties(
  lineNode: XmlObject,
  style: ShapeStyle,
  context: ShapeLineStyleContext,
): void {
  const dashType = context.normalizeStrokeDashType(
    (lineNode["a:prstDash"] as XmlObject | undefined)?.["@_val"],
  );
  if (dashType) {
    style.strokeDash = dashType;
  } else if (lineNode["a:custDash"]) {
    style.strokeDash = "custom";
    const customDash = lineNode["a:custDash"] as XmlObject;
    const dashSegments = context.ensureArray(customDash["a:ds"]);
    if (dashSegments.length > 0) {
      style.customDashSegments = dashSegments.map((segment) => {
        const dashNode = segment as XmlObject;
        return {
          dash: parseInt(String(dashNode?.["@_d"] || "0"), 10),
          space: parseInt(String(dashNode?.["@_sp"] || "0"), 10),
        };
      });
    }
  }
}

function applyArrowProperties(
  lineNode: XmlObject,
  style: ShapeStyle,
  context: ShapeLineStyleContext,
): void {
  const headEndType = context.normalizeConnectorArrowType(
    (lineNode["a:headEnd"] as XmlObject | undefined)?.["@_type"],
  );
  if (headEndType) {
    style.connectorStartArrow = headEndType;
  }
  const headEndWidth = String(
    (lineNode["a:headEnd"] as XmlObject | undefined)?.["@_w"] || "",
  )
    .trim()
    .toLowerCase();
  if (
    headEndWidth === "sm" ||
    headEndWidth === "med" ||
    headEndWidth === "lg"
  ) {
    style.connectorStartArrowWidth = headEndWidth;
  }
  const headEndLength = String(
    (lineNode["a:headEnd"] as XmlObject | undefined)?.["@_len"] || "",
  )
    .trim()
    .toLowerCase();
  if (
    headEndLength === "sm" ||
    headEndLength === "med" ||
    headEndLength === "lg"
  ) {
    style.connectorStartArrowLength = headEndLength;
  }

  const tailEndType = context.normalizeConnectorArrowType(
    (lineNode["a:tailEnd"] as XmlObject | undefined)?.["@_type"],
  );
  if (tailEndType) {
    style.connectorEndArrow = tailEndType;
  }
  const tailEndWidth = String(
    (lineNode["a:tailEnd"] as XmlObject | undefined)?.["@_w"] || "",
  )
    .trim()
    .toLowerCase();
  if (
    tailEndWidth === "sm" ||
    tailEndWidth === "med" ||
    tailEndWidth === "lg"
  ) {
    style.connectorEndArrowWidth = tailEndWidth;
  }
  const tailEndLength = String(
    (lineNode["a:tailEnd"] as XmlObject | undefined)?.["@_len"] || "",
  )
    .trim()
    .toLowerCase();
  if (
    tailEndLength === "sm" ||
    tailEndLength === "med" ||
    tailEndLength === "lg"
  ) {
    style.connectorEndArrowLength = tailEndLength;
  }
}

function applyJoinCapCompound(lineNode: XmlObject, style: ShapeStyle): void {
  if ("a:round" in lineNode) {
    style.lineJoin = "round";
  } else if ("a:bevel" in lineNode) {
    style.lineJoin = "bevel";
  } else if ("a:miter" in lineNode) {
    style.lineJoin = "miter";
  }

  const capValue = String(lineNode["@_cap"] || "")
    .trim()
    .toLowerCase();
  if (capValue === "rnd" || capValue === "sq" || capValue === "flat") {
    style.lineCap = capValue as ShapeStyle["lineCap"];
  }

  const compoundValue = String(lineNode["@_cmpd"] || "").trim();
  if (
    compoundValue === "sng" ||
    compoundValue === "dbl" ||
    compoundValue === "thickThin" ||
    compoundValue === "thinThick" ||
    compoundValue === "tri"
  ) {
    style.compoundLine = compoundValue as ShapeStyle["compoundLine"];
  }
}

function applyLineEffects(
  lineNode: XmlObject,
  style: ShapeStyle,
  context: ShapeLineStyleContext,
): void {
  const lineEffectList = lineNode["a:effectLst"] as XmlObject | undefined;
  if (!lineEffectList) return;

  const lineOuterShdw = lineEffectList["a:outerShdw"] as XmlObject | undefined;
  if (lineOuterShdw) {
    style.lineShadowColor = context.parseColor(lineOuterShdw) || "#000000";
    style.lineShadowOpacity = context.extractColorOpacity(lineOuterShdw) ?? 0.5;
    const lsBlurRaw = parseInt(String(lineOuterShdw["@_blurRad"] || ""), 10);
    const lsDistRaw = parseInt(String(lineOuterShdw["@_dist"] || ""), 10);
    const lsDirRaw = parseInt(String(lineOuterShdw["@_dir"] || ""), 10);
    style.lineShadowBlur =
      Number.isFinite(lsBlurRaw) && lsBlurRaw >= 0
        ? lsBlurRaw / context.emuPerPx
        : 4;
    const lsDist =
      Number.isFinite(lsDistRaw) && lsDistRaw >= 0
        ? lsDistRaw / context.emuPerPx
        : 0;
    const lsDirDeg = Number.isFinite(lsDirRaw) ? lsDirRaw / 60000 : 0;
    const lsDirRad = (lsDirDeg * Math.PI) / 180;
    style.lineShadowOffsetX =
      Math.round(Math.cos(lsDirRad) * lsDist * 100) / 100;
    style.lineShadowOffsetY =
      Math.round(Math.sin(lsDirRad) * lsDist * 100) / 100;
  }

  const lineGlow = lineEffectList["a:glow"] as XmlObject | undefined;
  if (lineGlow) {
    style.lineGlowColor = context.parseColor(lineGlow);
    style.lineGlowOpacity = context.extractColorOpacity(lineGlow);
    const lgRadRaw = parseInt(String(lineGlow["@_rad"] || ""), 10);
    style.lineGlowRadius =
      Number.isFinite(lgRadRaw) && lgRadRaw >= 0
        ? lgRadRaw / context.emuPerPx
        : undefined;
  }
}
