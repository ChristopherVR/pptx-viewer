import type { ShapeStyle, XmlObject } from "../../types";

export interface PptxGradientStyleCodecContext {
  ensureArray: (value: unknown) => unknown[];
  parseColor: (
    colorNode: XmlObject | undefined,
    placeholderColor?: string,
  ) => string | undefined;
  extractColorOpacity: (colorNode: XmlObject | undefined) => number | undefined;
  clampUnitInterval: (value: number) => number;
  hexToRgb: (hex: string) => { r: number; g: number; b: number } | undefined;
  rgbToHex: (r: number, g: number, b: number) => string;
}

export interface IPptxGradientStyleCodec {
  extractGradientOpacity(gradFill: XmlObject): number | undefined;
  extractGradientStops(
    gradFill: XmlObject,
  ): NonNullable<ShapeStyle["fillGradientStops"]>;
  extractGradientType(
    gradFill: XmlObject,
  ): NonNullable<ShapeStyle["fillGradientType"]>;
  extractGradientAngle(gradFill: XmlObject): number;
  extractGradientPathType(
    gradFill: XmlObject,
  ): ShapeStyle["fillGradientPathType"];
  extractGradientFocalPoint(
    gradFill: XmlObject,
  ): ShapeStyle["fillGradientFocalPoint"];
  buildGradientCssFromStops(
    stops: NonNullable<ShapeStyle["fillGradientStops"]>,
    type: NonNullable<ShapeStyle["fillGradientType"]>,
    angle: number,
    focalPoint?: ShapeStyle["fillGradientFocalPoint"],
  ): string | undefined;
  extractGradientFillCss(gradFill: XmlObject): string | undefined;
  buildGradientFillXml(shapeStyle: ShapeStyle): XmlObject | undefined;
  extractGradientFillColor(gradFill: XmlObject): string | undefined;
}

export class PptxGradientStyleCodec implements IPptxGradientStyleCodec {
  private readonly context: PptxGradientStyleCodecContext;

  public constructor(context: PptxGradientStyleCodecContext) {
    this.context = context;
  }

  public extractGradientOpacity(gradFill: XmlObject): number | undefined {
    const gradientStops = this.context.ensureArray(
      gradFill?.["a:gsLst"]?.["a:gs"],
    ) as XmlObject[];
    if (gradientStops.length === 0) return undefined;

    const opacities = gradientStops
      .map((stop) => this.context.extractColorOpacity(stop))
      .filter((opacity): opacity is number => opacity !== undefined);
    if (opacities.length === 0) return undefined;

    const opacityTotal = opacities.reduce((sum, value) => sum + value, 0);
    return this.context.clampUnitInterval(opacityTotal / opacities.length);
  }

  public extractGradientStops(
    gradFill: XmlObject,
  ): NonNullable<ShapeStyle["fillGradientStops"]> {
    const gradientStops = this.context.ensureArray(
      gradFill?.["a:gsLst"]?.["a:gs"],
    ) as XmlObject[];
    if (gradientStops.length === 0) return [];

    const sortedStops = [...gradientStops].sort((left, right) => {
      const leftPos = Number.parseInt(String(left["@_pos"] || "0"), 10);
      const rightPos = Number.parseInt(String(right["@_pos"] || "0"), 10);
      if (!Number.isFinite(leftPos) && !Number.isFinite(rightPos)) return 0;
      if (!Number.isFinite(leftPos)) return 1;
      if (!Number.isFinite(rightPos)) return -1;
      return leftPos - rightPos;
    });

    const stops: NonNullable<ShapeStyle["fillGradientStops"]> = [];
    sortedStops.forEach((stop) => {
      const color = this.context.parseColor(stop);
      if (!color) return;

      const positionRaw = Number.parseInt(String(stop["@_pos"] || "0"), 10);
      const position = Number.isFinite(positionRaw)
        ? this.context.clampUnitInterval(positionRaw / 100000) * 100
        : 0;
      const opacity = this.context.extractColorOpacity(stop);

      // Preserve original color XML for round-trip (scheme colors + transforms)
      const originalColorXml = this.extractColorSubNode(stop);

      stops.push({
        color,
        position,
        opacity,
        ...(originalColorXml ? { originalColorXml } : {}),
      });
    });
    return stops;
  }

  public extractGradientType(
    gradFill: XmlObject,
  ): NonNullable<ShapeStyle["fillGradientType"]> {
    return gradFill["a:path"] ? "radial" : "linear";
  }

  public extractGradientPathType(
    gradFill: XmlObject,
  ): ShapeStyle["fillGradientPathType"] {
    const pathNode = gradFill["a:path"] as XmlObject | undefined;
    if (!pathNode) return undefined;
    const pathValue = String(pathNode["@_path"] || "")
      .trim()
      .toLowerCase();
    if (
      pathValue === "circle" ||
      pathValue === "rect" ||
      pathValue === "shape"
    ) {
      return pathValue;
    }
    // Default to "circle" when a:path exists but path attr is missing
    return "circle";
  }

  public extractGradientFocalPoint(
    gradFill: XmlObject,
  ): ShapeStyle["fillGradientFocalPoint"] {
    const pathNode = gradFill["a:path"] as XmlObject | undefined;
    if (!pathNode) return undefined;
    const fillToRect = pathNode["a:fillToRect"] as XmlObject | undefined;
    if (!fillToRect) return undefined;

    // a:fillToRect has @l, @t, @r, @b as percentages in 1/100000 units.
    // The focal point is the center of the fillToRect.
    const l = Number.parseInt(String(fillToRect["@_l"] || "0"), 10);
    const t = Number.parseInt(String(fillToRect["@_t"] || "0"), 10);
    const r = Number.parseInt(String(fillToRect["@_r"] || "0"), 10);
    const b = Number.parseInt(String(fillToRect["@_b"] || "0"), 10);

    const safeL = Number.isFinite(l) ? l / 100000 : 0;
    const safeT = Number.isFinite(t) ? t / 100000 : 0;
    const safeR = Number.isFinite(r) ? r / 100000 : 0;
    const safeB = Number.isFinite(b) ? b / 100000 : 0;

    // Focal point is the center of the rectangle formed by (l, t) to (1-r, 1-b)
    const x = this.context.clampUnitInterval((safeL + (1 - safeR)) / 2);
    const y = this.context.clampUnitInterval((safeT + (1 - safeB)) / 2);

    return { x, y };
  }

  public extractGradientAngle(gradFill: XmlObject): number {
    const angleRaw = Number.parseInt(
      String((gradFill["a:lin"] as XmlObject | undefined)?.["@_ang"] || ""),
      10,
    );
    return Number.isFinite(angleRaw)
      ? (((angleRaw / 60000) % 360) + 360) % 360
      : 90;
  }

  public buildGradientCssFromStops(
    stops: NonNullable<ShapeStyle["fillGradientStops"]>,
    type: NonNullable<ShapeStyle["fillGradientType"]>,
    angle: number,
    focalPoint?: ShapeStyle["fillGradientFocalPoint"],
  ): string | undefined {
    if (stops.length === 0) return undefined;

    const stopTokens = stops.map((stop) => {
      const colorToken = this.colorWithOpacity(stop.color, stop.opacity);
      const normalizedPosition =
        typeof stop.position === "number" && Number.isFinite(stop.position)
          ? `${this.context.clampUnitInterval(stop.position / 100) * 100}%`
          : undefined;
      return normalizedPosition
        ? `${colorToken} ${normalizedPosition}`
        : colorToken;
    });

    if (type === "radial") {
      const posX = focalPoint ? `${Math.round(focalPoint.x * 100)}%` : "center";
      const posY = focalPoint ? `${Math.round(focalPoint.y * 100)}%` : "center";
      return `radial-gradient(circle at ${posX} ${posY}, ${stopTokens.join(", ")})`;
    }
    return `linear-gradient(${angle.toFixed(2)}deg, ${stopTokens.join(", ")})`;
  }

  public extractGradientFillCss(gradFill: XmlObject): string | undefined {
    const stops = this.extractGradientStops(gradFill);
    if (stops.length === 0) return undefined;

    return this.buildGradientCssFromStops(
      stops,
      this.extractGradientType(gradFill),
      this.extractGradientAngle(gradFill),
      this.extractGradientFocalPoint(gradFill),
    );
  }

  public buildGradientFillXml(shapeStyle: ShapeStyle): XmlObject | undefined {
    const stops = (shapeStyle.fillGradientStops || [])
      .filter((stop) => Boolean(stop?.color))
      .map((stop) => {
        const positionRaw =
          typeof stop.position === "number" && Number.isFinite(stop.position)
            ? stop.position
            : 0;
        const position = Math.round(
          this.context.clampUnitInterval(positionRaw / 100) * 100000,
        );

        // Prefer original color XML to preserve scheme colors and transforms
        if (stop.originalColorXml) {
          const stopXml: XmlObject = {
            "@_pos": String(position),
            ...stop.originalColorXml,
          };
          return stopXml;
        }

        const normalizedColor = String(stop.color || "").trim();
        const normalizedOpacity =
          typeof stop.opacity === "number" && Number.isFinite(stop.opacity)
            ? this.context.clampUnitInterval(stop.opacity)
            : undefined;
        const stopXml: XmlObject = {
          "@_pos": String(position),
          "a:srgbClr": {
            "@_val": normalizedColor.replace("#", ""),
          },
        };
        if (normalizedOpacity !== undefined) {
          (stopXml["a:srgbClr"] as XmlObject)["a:alpha"] = {
            "@_val": String(Math.round(normalizedOpacity * 100000)),
          };
        }
        return stopXml;
      });
    if (stops.length === 0) return undefined;

    const gradientType = shapeStyle.fillGradientType || "linear";
    const gradientXml: XmlObject = {
      "a:gsLst": {
        "a:gs": stops,
      },
    };
    if (gradientType === "radial") {
      const pathType = shapeStyle.fillGradientPathType || "circle";
      const pathXml: XmlObject = {
        "@_path": pathType,
      };
      if (shapeStyle.fillGradientFocalPoint) {
        const fp = shapeStyle.fillGradientFocalPoint;
        // Convert focal point back to fillToRect LTRB values
        const l = Math.round(fp.x * 100000);
        const t = Math.round(fp.y * 100000);
        const r = Math.round((1 - fp.x) * 100000);
        const b = Math.round((1 - fp.y) * 100000);
        pathXml["a:fillToRect"] = {
          "@_l": String(l),
          "@_t": String(t),
          "@_r": String(r),
          "@_b": String(b),
        };
      }
      gradientXml["a:path"] = pathXml;
    } else {
      const normalizedAngle =
        typeof shapeStyle.fillGradientAngle === "number" &&
        Number.isFinite(shapeStyle.fillGradientAngle)
          ? shapeStyle.fillGradientAngle
          : 90;
      gradientXml["a:lin"] = {
        "@_ang": String(Math.round(normalizedAngle * 60000)),
        "@_scaled": "1",
      };
    }
    return gradientXml;
  }

  public extractGradientFillColor(gradFill: XmlObject): string | undefined {
    const sortedStops = this.extractStopsSorted(gradFill);
    if (sortedStops.length === 0) return undefined;

    const firstColor = this.context.parseColor(sortedStops[0]);
    const lastColor =
      sortedStops.length > 1
        ? this.context.parseColor(sortedStops[sortedStops.length - 1])
        : undefined;

    if (!firstColor) return lastColor;
    if (!lastColor) return firstColor;

    const firstRgb = this.context.hexToRgb(firstColor);
    const lastRgb = this.context.hexToRgb(lastColor);
    if (!firstRgb || !lastRgb) return firstColor;

    return this.context.rgbToHex(
      (firstRgb.r + lastRgb.r) / 2,
      (firstRgb.g + lastRgb.g) / 2,
      (firstRgb.b + lastRgb.b) / 2,
    );
  }

  private extractStopsSorted(gradFill: XmlObject): XmlObject[] {
    const gradientStops = this.context.ensureArray(
      gradFill?.["a:gsLst"]?.["a:gs"],
    ) as XmlObject[];
    if (gradientStops.length === 0) return [];

    return [...gradientStops].sort((left, right) => {
      const leftPos = Number.parseInt(String(left["@_pos"] || "0"), 10);
      const rightPos = Number.parseInt(String(right["@_pos"] || "0"), 10);
      if (!Number.isFinite(leftPos) && !Number.isFinite(rightPos)) return 0;
      if (!Number.isFinite(leftPos)) return 1;
      if (!Number.isFinite(rightPos)) return -1;
      return leftPos - rightPos;
    });
  }

  /**
   * Extract the raw color sub-node from a gradient stop for round-trip preservation.
   * Returns the color choice node (e.g. a:schemeClr with transforms, a:srgbClr, etc.).
   */
  private extractColorSubNode(stop: XmlObject): XmlObject | undefined {
    const colorKeys = [
      'a:srgbClr',
      'a:schemeClr',
      'a:sysClr',
      'a:prstClr',
      'a:scrgbClr',
      'a:hslClr',
    ];
    for (const key of colorKeys) {
      if (stop[key]) {
        return { [key]: stop[key] } as XmlObject;
      }
    }
    return undefined;
  }

  private colorWithOpacity(color: string, opacity: number | undefined): string {
    if (opacity === undefined) return color;
    const rgb = this.context.hexToRgb(color);
    if (!rgb) return color;
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${this.context.clampUnitInterval(opacity)})`;
  }
}
