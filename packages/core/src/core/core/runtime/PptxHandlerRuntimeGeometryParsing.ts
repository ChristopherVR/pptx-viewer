import {
  XmlObject,
  ShapeStyle,
  type PptxImageLikeElement,
  type GeometryAdjustmentHandle,
} from "../../types";
import {
  parseGuideDefinitions,
  parseAdjustmentValues,
  evaluateGuides,
  evaluateGeometryPaths,
  resolveCoordinate,
  createBuiltinVariables,
} from "../../geometry/guide-formula";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimePlaceholderLookup";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  protected parseGeometryAdjustments(
    prstGeom: XmlObject | undefined,
  ): Record<string, number> | undefined {
    if (!prstGeom) return undefined;
    const gdNodes = this.ensureArray(
      prstGeom?.["a:avLst"]?.["a:gd"],
    ) as XmlObject[];
    if (gdNodes.length === 0) return undefined;

    const adjustments: Record<string, number> = {};
    for (const gd of gdNodes) {
      const name = String(gd?.["@_name"] || "").trim();
      if (!name) continue;
      let value: number | undefined;

      if (gd?.["@_val"] !== undefined) {
        const parsed = Number.parseInt(String(gd["@_val"]), 10);
        if (Number.isFinite(parsed)) {
          value = parsed;
        }
      }
      if (value === undefined && gd?.["@_fmla"]) {
        const formula = String(gd["@_fmla"]).trim();
        const match = formula.match(/^val\s+(-?\d+)$/i);
        if (match) {
          const parsed = Number.parseInt(match[1], 10);
          if (Number.isFinite(parsed)) {
            value = parsed;
          }
        }
      }

      if (value !== undefined) {
        adjustments[name] = value;
      }
    }

    return Object.keys(adjustments).length > 0 ? adjustments : undefined;
  }

  /**
   * Parse adjustment handles from `a:ahLst` in a geometry definition.
   * Supports both `a:ahXY` (XY position handles) and `a:ahPolar` (polar handles).
   */
  protected parseAdjustmentHandles(
    geomNode: XmlObject | undefined,
    shapeWidth: number,
    shapeHeight: number,
    adjustments?: Record<string, number>,
  ): GeometryAdjustmentHandle[] | undefined {
    if (!geomNode) return undefined;
    const ahLst = geomNode["a:ahLst"] as XmlObject | undefined;
    if (!ahLst) return undefined;

    const handles: GeometryAdjustmentHandle[] = [];

    // Build variable context for resolving min/max positions
    const vars = createBuiltinVariables({
      w: shapeWidth,
      h: shapeHeight,
    });
    if (adjustments) {
      for (const [name, value] of Object.entries(adjustments)) {
        vars.set(name, value);
      }
    }

    // Parse XY adjustment handles
    const xyHandles = this.ensureArray(ahLst["a:ahXY"]) as XmlObject[];
    for (const ah of xyHandles) {
      const gdRefX = String(ah?.["@_gdRefX"] ?? "").trim();
      const gdRefY = String(ah?.["@_gdRefY"] ?? "").trim();
      const guideName = gdRefX || gdRefY;
      if (!guideName) continue;

      const pos = ah["a:pos"] as XmlObject | undefined;
      const posX = resolveCoordinate(
        pos?.["@_x"] as string | number | undefined,
        vars,
      );
      const posY = resolveCoordinate(
        pos?.["@_y"] as string | number | undefined,
        vars,
      );

      const handle: GeometryAdjustmentHandle = {
        guideName,
        xFraction: shapeWidth > 0 ? posX / shapeWidth : undefined,
        yFraction: shapeHeight > 0 ? posY / shapeHeight : undefined,
      };

      // Parse min/max constraints
      if (ah["@_minX"] !== undefined) {
        handle.minValue = resolveCoordinate(
          ah["@_minX"] as string | number,
          vars,
        );
      }
      if (ah["@_maxX"] !== undefined) {
        handle.maxValue = resolveCoordinate(
          ah["@_maxX"] as string | number,
          vars,
        );
      }
      if (ah["@_minY"] !== undefined && !handle.minValue) {
        handle.minValue = resolveCoordinate(
          ah["@_minY"] as string | number,
          vars,
        );
      }
      if (ah["@_maxY"] !== undefined && !handle.maxValue) {
        handle.maxValue = resolveCoordinate(
          ah["@_maxY"] as string | number,
          vars,
        );
      }

      handles.push(handle);
    }

    // Parse polar adjustment handles
    const polarHandles = this.ensureArray(ahLst["a:ahPolar"]) as XmlObject[];
    for (const ah of polarHandles) {
      const gdRefR = String(ah?.["@_gdRefR"] ?? "").trim();
      const gdRefAng = String(ah?.["@_gdRefAng"] ?? "").trim();
      const guideName = gdRefR || gdRefAng;
      if (!guideName) continue;

      const pos = ah["a:pos"] as XmlObject | undefined;
      const posX = resolveCoordinate(
        pos?.["@_x"] as string | number | undefined,
        vars,
      );
      const posY = resolveCoordinate(
        pos?.["@_y"] as string | number | undefined,
        vars,
      );

      handles.push({
        guideName,
        xFraction: shapeWidth > 0 ? posX / shapeWidth : undefined,
        yFraction: shapeHeight > 0 ? posY / shapeHeight : undefined,
      });
    }

    return handles.length > 0 ? handles : undefined;
  }

  protected parseCustomGeometry(
    custGeom: XmlObject | undefined,
    shapeWidth?: number,
    shapeHeight?: number,
  ): { pathData: string; pathWidth: number; pathHeight: number } | null {
    if (
      !custGeom ||
      !(custGeom as Record<string, unknown>)["a:pathLst"] ||
      !(
        (custGeom as Record<string, unknown>)["a:pathLst"] as Record<
          string,
          unknown
        >
      )?.["a:path"]
    ) {
      return null;
    }

    // Parse adjustment values from a:avLst
    const avGdNodes = this.ensureArray(
      (custGeom["a:avLst"] as XmlObject | undefined)?.["a:gd"],
    ) as Array<Record<string, unknown>>;
    const adjustments =
      avGdNodes.length > 0 ? parseAdjustmentValues(avGdNodes) : undefined;

    // Parse guide definitions from a:gdLst
    const gdGdNodes = this.ensureArray(
      (custGeom["a:gdLst"] as XmlObject | undefined)?.["a:gd"],
    ) as Array<Record<string, unknown>>;
    const guideDefinitions = parseGuideDefinitions(gdGdNodes);

    // Determine the coordinate space for formula evaluation
    const pathNodes = this.ensureArray(
      (custGeom["a:pathLst"] as XmlObject)["a:path"],
    ) as Array<Record<string, unknown>>;

    // Use the path coordinate dimensions or fall back to shape dimensions
    const firstPath = pathNodes[0];
    const coordW =
      Number.parseInt(String(firstPath?.["@_w"] ?? "0"), 10) ||
      (shapeWidth ?? 0);
    const coordH =
      Number.parseInt(String(firstPath?.["@_h"] ?? "0"), 10) ||
      (shapeHeight ?? 0);

    // If we have guide definitions that reference formulas, evaluate them
    const hasFormulas =
      guideDefinitions.length > 0 || (adjustments && adjustments.size > 0);

    if (hasFormulas) {
      // Evaluate all guides with formula resolution
      const variables = evaluateGuides(
        guideDefinitions,
        { w: coordW, h: coordH },
        adjustments,
      );

      // Evaluate paths with formula-resolved coordinates
      return evaluateGeometryPaths(pathNodes, variables, (val: unknown) =>
        this.ensureArray(val),
      );
    }

    // No formulas — fall back to simple path parsing (handles plain numeric coordinates)
    return evaluateGeometryPaths(
      pathNodes,
      new Map<string, number>(),
      (val: unknown) => this.ensureArray(val),
    );
  }

  protected parseCropFraction(value: unknown): number | undefined {
    const raw = Number.parseInt(String(value ?? ""), 10);
    if (!Number.isFinite(raw)) return undefined;
    const normalized = Math.max(0, Math.min(100000, raw)) / 100000;
    return normalized;
  }

  protected readImageCropFromBlipFill(
    blipFill: XmlObject | undefined,
  ): Pick<
    PptxImageLikeElement,
    "cropLeft" | "cropTop" | "cropRight" | "cropBottom"
  > {
    // Primary crop source: a:srcRect
    const sourceRect = blipFill?.["a:srcRect"] as XmlObject | undefined;
    if (sourceRect) {
      const cropLeft = this.parseCropFraction(sourceRect["@_l"]);
      const cropTop = this.parseCropFraction(sourceRect["@_t"]);
      const cropRight = this.parseCropFraction(sourceRect["@_r"]);
      const cropBottom = this.parseCropFraction(sourceRect["@_b"]);
      return { cropLeft, cropTop, cropRight, cropBottom };
    }

    // Fallback: a:stretch/a:fillRect with non-zero margins also acts as crop
    const stretchNode = blipFill?.["a:stretch"] as XmlObject | undefined;
    const fillRect = stretchNode?.["a:fillRect"] as XmlObject | undefined;
    if (fillRect) {
      const l = this.parseCropFraction(fillRect["@_l"]);
      const t = this.parseCropFraction(fillRect["@_t"]);
      const r = this.parseCropFraction(fillRect["@_r"]);
      const b = this.parseCropFraction(fillRect["@_b"]);
      if (
        l !== undefined ||
        t !== undefined ||
        r !== undefined ||
        b !== undefined
      ) {
        return {
          cropLeft: l,
          cropTop: t,
          cropRight: r,
          cropBottom: b,
        };
      }
    }

    return {};
  }

  protected extractShapeStyle(
    spPr: XmlObject | undefined,
    styleNode?: XmlObject,
  ): ShapeStyle {
    return this.shapeStyleExtractor.extractShapeStyle(spPr, styleNode);
  }
}
