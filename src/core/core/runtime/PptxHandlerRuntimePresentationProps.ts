import {
  XmlObject,
  type PptxPresentationProperties,
  type PptxChartStyle,
  type PptxViewProperties,
} from "../../types";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeSlideMasters";
import { parseShowProperties } from "./pptx-presentation-props-helpers";
import { parseViewProperties } from "./pptx-view-props-helpers";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  /**
   * Parse presentation properties from `presentationPr.xml`.
   * Extracts show type, loop, narration, animation, and print settings.
   */
  protected async parsePresentationProperties(): Promise<
    PptxPresentationProperties | undefined
  > {
    try {
      // First find presentationPr relationship
      const relsXml = await this.zip
        .file("ppt/_rels/presentation.xml.rels")
        ?.async("string");
      if (!relsXml) return undefined;

      const relsData = this.parser.parse(relsXml);
      const rels = this.ensureArray(relsData?.Relationships?.Relationship);
      const prRel = rels.find(
        (r: XmlObject) =>
          String(r?.["@_Type"] || "").includes("presProps") ||
          String(r?.["@_Target"] || "").includes("presProps"),
      );

      const prTarget = prRel
        ? String(prRel["@_Target"] || "")
        : "presProps.xml";
      const prPath = prTarget.startsWith("/")
        ? prTarget.substring(1)
        : `ppt/${prTarget}`;

      const prXmlStr = await this.zip.file(prPath)?.async("string");
      if (!prXmlStr) return undefined;

      const prXml = this.parser.parse(prXmlStr);
      const presProps = prXml?.["p:presentationPr"];
      if (!presProps) return undefined;

      const props: PptxPresentationProperties = {};

      // Show properties (p:showPr)
      const showPr = presProps["p:showPr"] as XmlObject | undefined;
      if (showPr) {
        Object.assign(props, parseShowProperties(showPr));
      }

      // Print properties (p:prnPr)
      const prnPr = presProps["p:prnPr"] as XmlObject | undefined;
      if (prnPr) {
        props.printFrameSlides =
          prnPr["@_frameSlides"] === "1" || prnPr["@_frameSlides"] === true;
        const slidesPerPageRaw =
          prnPr["@_sldPerPg"] ?? prnPr["@_slidesPerPage"];
        if (slidesPerPageRaw !== undefined) {
          const slidesPerPage = Number.parseInt(String(slidesPerPageRaw), 10);
          if (Number.isFinite(slidesPerPage) && slidesPerPage > 0) {
            props.printSlidesPerPage = slidesPerPage;
          }
        }
        const clrMode = prnPr["@_clrMode"] as string | undefined;
        if (clrMode === "clr" || clrMode === "gray" || clrMode === "bw") {
          props.printColorMode = clrMode;
        }
      }

      // Most-recently-used colours (p:clrMru)
      const clrMru = presProps["p:clrMru"] as XmlObject | undefined;
      if (clrMru) {
        const colorNodes = this.ensureArray(clrMru["a:srgbClr"]);
        const mruColors = colorNodes
          .map((c: XmlObject) => {
            const val = String(c?.["@_val"] || "").trim();
            return val.length > 0 ? `#${val}` : "";
          })
          .filter((c: string) => c.length > 0);
        if (mruColors.length > 0) {
          props.mruColors = mruColors;
        }
      }

      // Grid spacing (p:gridSpacing)
      const gridSpacing = presProps["p:gridSpacing"] as XmlObject | undefined;
      if (gridSpacing) {
        const cx = parseInt(String(gridSpacing["@_cx"] ?? "0"), 10);
        const cy = parseInt(String(gridSpacing["@_cy"] ?? "0"), 10);
        if (cx > 0 && cy > 0) {
          props.gridSpacing = { cx, cy };
        }
      }

      return props;
    } catch (e) {
      console.warn("Failed to parse presentation properties:", e);
      return undefined;
    }
  }

  /**
   * Parse view properties from `ppt/viewProps.xml`.
   */
  protected async parseViewProperties(): Promise<
    PptxViewProperties | undefined
  > {
    try {
      const viewPropsXml = await this.zip
        .file("ppt/viewProps.xml")
        ?.async("string");
      if (!viewPropsXml) return undefined;

      const data = this.parser.parse(viewPropsXml) as XmlObject;
      const viewPrRoot = data?.["p:viewPr"] as XmlObject | undefined;
      if (!viewPrRoot) return undefined;

      return parseViewProperties(viewPrRoot);
    } catch (e) {
      console.warn("Failed to parse view properties:", e);
      return undefined;
    }
  }

  /**
   * Extract chart style metadata from chart XML.
   */
  protected extractChartStyle(
    chartSpace: XmlObject | undefined,
    chartRoot: XmlObject | undefined,
  ): PptxChartStyle | undefined {
    if (!chartSpace && !chartRoot) return undefined;
    const style: PptxChartStyle = {};
    let hasStyle = false;

    // Style ID from c:style
    const styleNode = this.xmlLookupService.getChildByLocalName(
      chartSpace,
      "style",
    );
    if (styleNode?.["@_val"]) {
      style.styleId = parseInt(String(styleNode["@_val"]));
      hasStyle = true;
    }

    if (chartRoot) {
      // Legend
      const legend = this.xmlLookupService.getChildByLocalName(
        chartRoot,
        "legend",
      );
      if (legend) {
        style.hasLegend = true;
        hasStyle = true;
        const legendPos = this.xmlLookupService.getChildByLocalName(
          legend,
          "legendPos",
        );
        if (legendPos?.["@_val"]) {
          style.legendPosition = String(legendPos["@_val"]);
        }
      }

      // Title
      const title = this.xmlLookupService.getChildByLocalName(
        chartRoot,
        "title",
      );
      if (title) {
        style.hasTitle = true;
        hasStyle = true;
      }

      // Plot area gridlines
      const plotArea = this.xmlLookupService.getChildByLocalName(
        chartRoot,
        "plotArea",
      );
      if (plotArea) {
        const valAx = this.xmlLookupService.getChildByLocalName(
          plotArea,
          "valAx",
        );
        if (valAx) {
          const majorGridlines = this.xmlLookupService.getChildByLocalName(
            valAx,
            "majorGridlines",
          );
          if (majorGridlines) {
            style.hasGridlines = true;
            hasStyle = true;
          }
        }

        // Data labels check across chart types
        const chartTypeKeys = Object.keys(plotArea).filter((key) =>
          this.compatibilityService.getXmlLocalName(key).endsWith("Chart"),
        );
        for (const ctKey of chartTypeKeys) {
          const ctNode = plotArea[ctKey] as XmlObject | undefined;
          if (!ctNode) continue;

          // Check chart-level dLbls (applies to all series)
          const chartDLbls = this.xmlLookupService.getChildByLocalName(
            ctNode,
            "dLbls",
          );
          if (chartDLbls) {
            const showVal = this.xmlLookupService.getChildByLocalName(
              chartDLbls,
              "showVal",
            );
            const showCatName = this.xmlLookupService.getChildByLocalName(
              chartDLbls,
              "showCatName",
            );
            const showSerName = this.xmlLookupService.getChildByLocalName(
              chartDLbls,
              "showSerName",
            );
            if (
              showVal?.["@_val"] === "1" ||
              showCatName?.["@_val"] === "1" ||
              showSerName?.["@_val"] === "1"
            ) {
              style.hasDataLabels = true;
              hasStyle = true;
            }
          }

          // Also check per-series dLbls
          if (!style.hasDataLabels) {
            const seriesList =
              this.xmlLookupService.getChildrenArrayByLocalName(ctNode, "ser");
            for (const ser of seriesList) {
              const dLbls = this.xmlLookupService.getChildByLocalName(
                ser,
                "dLbls",
              );
              if (dLbls) {
                const showVal = this.xmlLookupService.getChildByLocalName(
                  dLbls,
                  "showVal",
                );
                if (showVal?.["@_val"] === "1") {
                  style.hasDataLabels = true;
                  hasStyle = true;
                }
              }
            }
          }
        }
      }
    }

    return hasStyle ? style : undefined;
  }

  protected toPresentationTarget(slidePath: string): string {
    const normalized = slidePath.startsWith("/")
      ? slidePath.substring(1)
      : slidePath;
    return normalized.startsWith("ppt/") ? normalized.substring(4) : normalized;
  }

  protected toSlidePathFromTarget(target: string): string {
    const normalized = target.startsWith("/") ? target.substring(1) : target;
    return normalized.startsWith("ppt/") ? normalized : `ppt/${normalized}`;
  }

  protected toSlideRelsPath(slidePath: string): string {
    return slidePath.replace("slides/", "slides/_rels/") + ".rels";
  }
}
