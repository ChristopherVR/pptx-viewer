import {
  XmlObject,
  PptxElement,
  hasShapeProperties,
  hasTextProperties,
  type GroupPptxElement,
} from "../../types";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeSpTreeParsing";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  protected async parseGroupShape(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    group: any,
    baseId: string,
    slidePath: string,
    rawXmlStr?: string,
  ): Promise<PptxElement[]> {
    const grpSpPr = group["p:grpSpPr"];
    const xfrm = grpSpPr?.["a:xfrm"];

    let parentX = 0,
      parentY = 0,
      parentW = 0,
      parentH = 0;
    let chX = 0,
      chY = 0,
      chW = 0,
      chH = 0;

    if (xfrm) {
      if (xfrm["a:off"]) {
        parentX = Math.round(
          parseInt(xfrm["a:off"]["@_x"] || "0") / PptxHandlerRuntime.EMU_PER_PX,
        );
        parentY = Math.round(
          parseInt(xfrm["a:off"]["@_y"] || "0") / PptxHandlerRuntime.EMU_PER_PX,
        );
      }
      if (xfrm["a:ext"]) {
        parentW = Math.round(
          parseInt(xfrm["a:ext"]["@_cx"] || "0") /
            PptxHandlerRuntime.EMU_PER_PX,
        );
        parentH = Math.round(
          parseInt(xfrm["a:ext"]["@_cy"] || "0") /
            PptxHandlerRuntime.EMU_PER_PX,
        );
      }
      if (xfrm["a:chOff"]) {
        chX = Math.round(
          parseInt(xfrm["a:chOff"]["@_x"] || "0") /
            PptxHandlerRuntime.EMU_PER_PX,
        );
        chY = Math.round(
          parseInt(xfrm["a:chOff"]["@_y"] || "0") /
            PptxHandlerRuntime.EMU_PER_PX,
        );
      }
      if (xfrm["a:chExt"]) {
        chW = Math.round(
          parseInt(xfrm["a:chExt"]["@_cx"] || "0") /
            PptxHandlerRuntime.EMU_PER_PX,
        );
        chH = Math.round(
          parseInt(xfrm["a:chExt"]["@_cy"] || "0") /
            PptxHandlerRuntime.EMU_PER_PX,
        );
      }
    }

    const scaleX = chW > 0 ? parentW / chW : 1;
    const scaleY = chH > 0 ? parentH / chH : 1;

    const transformElement = (el: PptxElement) => {
      const relativeX = el.x - chX;
      const relativeY = el.y - chY;
      el.x = parentX + relativeX * scaleX;
      el.y = parentY + relativeY * scaleY;
      el.width = el.width * scaleX;
      el.height = el.height * scaleY;

      const avgScale = (Math.abs(scaleX) + Math.abs(scaleY)) / 2;
      if (hasShapeProperties(el) && el.shapeStyle?.strokeWidth) {
        el.shapeStyle.strokeWidth *= avgScale;
      }
      if (hasTextProperties(el)) {
        if (el.textStyle?.fontSize) {
          el.textStyle.fontSize *= Math.abs(scaleY);
        }
        if (el.textSegments) {
          el.textSegments.forEach((seg) => {
            if (seg.style.fontSize) seg.style.fontSize *= Math.abs(scaleY);
          });
        }
      }
      return el;
    };

    this.unwrapAlternateContent(group as Record<string, unknown>);

    const childOrder = this.extractSpTreeChildOrder(
      undefined,
      group as Record<string, unknown>,
      "p:grpSp",
    );
    const elements: PptxElement[] = [];

    for (const entry of childOrder) {
      if (entry.tag === "p:grpSp") {
        const subArr = this.ensureArray(group["p:grpSp"]);
        const subGroup = subArr[entry.indexInType];
        if (!subGroup) continue;
        const subElements = await this.parseGroupShape(
          subGroup,
          `${baseId}-group-${entry.indexInType}`,
          slidePath,
          rawXmlStr,
        );
        subElements.forEach((el) => transformElement(el));
        elements.push(...subElements);
      } else {
        const element = await this.parseSpTreeChild(
          entry.tag,
          entry.indexInType,
          group as Record<string, unknown>,
          slidePath,
          `${baseId}-`,
        );
        if (element) {
          transformElement(element);
          elements.push(element);
        }
      }
    }

    return elements;
  }

  /**
   * Parse a p:grpSp element into a GroupPptxElement with children.
   * Children have coordinates relative to the group's position.
   */
  protected override async parseGroupShapeAsGroup(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    group: any,
    baseId: string,
    slidePath: string,
    rawXmlStr?: string,
  ): Promise<PptxElement | null> {
    const grpSpPr = group["p:grpSpPr"];
    const xfrm = grpSpPr?.["a:xfrm"];

    let parentX = 0,
      parentY = 0,
      parentW = 0,
      parentH = 0;

    if (xfrm) {
      if (xfrm["a:off"]) {
        parentX = Math.round(
          parseInt(xfrm["a:off"]["@_x"] || "0") / PptxHandlerRuntime.EMU_PER_PX,
        );
        parentY = Math.round(
          parseInt(xfrm["a:off"]["@_y"] || "0") / PptxHandlerRuntime.EMU_PER_PX,
        );
      }
      if (xfrm["a:ext"]) {
        parentW = Math.round(
          parseInt(xfrm["a:ext"]["@_cx"] || "0") /
            PptxHandlerRuntime.EMU_PER_PX,
        );
        parentH = Math.round(
          parseInt(xfrm["a:ext"]["@_cy"] || "0") /
            PptxHandlerRuntime.EMU_PER_PX,
        );
      }
    }

    const grpFillStyle = grpSpPr
      ? this.extractShapeStyle(grpSpPr as XmlObject | undefined)
      : undefined;
    const hasGroupFill =
      grpFillStyle && grpFillStyle.fillMode && grpFillStyle.fillMode !== "none";

    const children = await this.parseGroupShape(
      group,
      baseId,
      slidePath,
      rawXmlStr,
    );
    if (children.length === 0) return null;

    // Apply group fill inheritance
    if (hasGroupFill) {
      for (const child of children) {
        if (
          hasShapeProperties(child) &&
          child.shapeStyle?.fillMode === "group"
        ) {
          child.shapeStyle = {
            ...child.shapeStyle,
            fillMode: grpFillStyle.fillMode,
            fillColor: grpFillStyle.fillColor,
            fillOpacity: grpFillStyle.fillOpacity,
            fillGradient: grpFillStyle.fillGradient,
            fillGradientStops: grpFillStyle.fillGradientStops,
            fillGradientAngle: grpFillStyle.fillGradientAngle,
            fillGradientType: grpFillStyle.fillGradientType,
            fillPatternPreset: grpFillStyle.fillPatternPreset,
            fillPatternBackgroundColor: grpFillStyle.fillPatternBackgroundColor,
          };
        }
      }
    }

    // Convert children to group-relative coordinates
    for (const child of children) {
      child.x -= parentX;
      child.y -= parentY;
    }

    const grpCNvPr = group?.["p:nvGrpSpPr"]?.["p:cNvPr"] as
      | XmlObject
      | undefined;
    const grpSlideRels = this.slideRelsMap.get(slidePath);
    const { actionClick: grpActionClick, actionHover: grpActionHover } =
      this.parseElementActions(grpCNvPr, grpSlideRels, this.orderedSlidePaths);

    const groupElement: GroupPptxElement = {
      type: "group",
      id: baseId,
      x: parentX,
      y: parentY,
      width: parentW || Math.max(...children.map((c) => c.x + c.width)),
      height: parentH || Math.max(...children.map((c) => c.y + c.height)),
      children,
      rawXml: group as XmlObject,
      actionClick: grpActionClick,
      actionHover: grpActionHover,
      groupFill: hasGroupFill ? grpFillStyle : undefined,
    };

    return groupElement;
  }

  protected extractGradientFillColor(gradFill: XmlObject): string | undefined {
    return this.colorStyleCodec.extractGradientFillColor(gradFill);
  }
}
