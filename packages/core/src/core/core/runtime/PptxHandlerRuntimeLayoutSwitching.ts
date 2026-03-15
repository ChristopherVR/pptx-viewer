import { XmlObject, PptxElement } from "../../types";
import { EMU_PER_PX } from "../../constants";
import { type PlaceholderInfo } from "./PptxHandlerRuntimeTypes";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeTextEditing";

/**
 * Layout-switching helpers for the PptxHandlerRuntime mixin chain.
 *
 * Provides methods that map slide elements to a new layout's placeholders
 * by type, reposition matched placeholders, remove unmatched ones, and
 * inject empty placeholders that exist only in the target layout.
 */
export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  // ── Placeholder info extraction ─────────────────────────────────────

  /**
   * Read placeholder info from a `p:nvPr` XML node.
   *
   * This is a local helper that mirrors the logic in
   * `PptxHandlerRuntimeElementParsing.extractPlaceholderInfo` — we
   * duplicate it here because that mixin sits higher in the chain and
   * is not yet available at this level.
   */
  private readPlaceholderInfoFromNvPr(
    nvPr: XmlObject | undefined,
  ): PlaceholderInfo | null {
    if (!nvPr) return null;
    const ph = nvPr["p:ph"] as XmlObject | undefined;
    if (!ph) return null;

    const idx = ph["@_idx"];
    const type = ph["@_type"];
    const sz = ph["@_sz"];

    return {
      idx: idx !== undefined ? String(idx) : undefined,
      type: type !== undefined ? String(type).toLowerCase() : undefined,
      sz: sz !== undefined ? String(sz).toLowerCase() : undefined,
    };
  }

  /**
   * Extract placeholder info from a parsed slide element's rawXml.
   * Works for shapes (`p:nvSpPr`), pictures (`p:nvPicPr`), and
   * graphic frames (`p:nvGraphicFramePr`).
   */
  protected getElementPlaceholderInfo(
    element: PptxElement,
  ): PlaceholderInfo | null {
    const raw = element.rawXml;
    if (!raw) return null;

    const nvPr =
      (raw["p:nvSpPr"]?.["p:nvPr"] as XmlObject | undefined) ??
      (raw["p:nvPicPr"]?.["p:nvPr"] as XmlObject | undefined) ??
      (raw["p:nvGraphicFramePr"]?.["p:nvPr"] as XmlObject | undefined);

    return this.readPlaceholderInfoFromNvPr(nvPr);
  }

  // ── Layout placeholder extraction ───────────────────────────────────

  /**
   * Extract all placeholders from a layout's `p:spTree`, returning
   * their placeholder info and their transform (position/size in EMU).
   */
  protected extractLayoutPlaceholders(
    layoutXml: XmlObject,
  ): Array<{
    phInfo: PlaceholderInfo;
    xEmu: number;
    yEmu: number;
    cxEmu: number;
    cyEmu: number;
    shapeXml: XmlObject;
  }> {
    const sldLayout = layoutXml["p:sldLayout"] as XmlObject | undefined;
    const spTree = sldLayout?.["p:cSld"]?.["p:spTree"] as
      | XmlObject
      | undefined;
    if (!spTree) return [];

    const result: Array<{
      phInfo: PlaceholderInfo;
      xEmu: number;
      yEmu: number;
      cxEmu: number;
      cyEmu: number;
      shapeXml: XmlObject;
    }> = [];

    const shapes = this.ensureArray(spTree["p:sp"]) as XmlObject[];
    for (const shape of shapes) {
      const nvPr = shape?.["p:nvSpPr"]?.["p:nvPr"] as XmlObject | undefined;
      const phInfo = this.readPlaceholderInfoFromNvPr(nvPr);
      if (!phInfo) continue;

      // Get transform
      const spPr = shape["p:spPr"] as XmlObject | undefined;
      const xfrm = spPr?.["a:xfrm"] as XmlObject | undefined;
      const off = xfrm?.["a:off"] as XmlObject | undefined;
      const ext = xfrm?.["a:ext"] as XmlObject | undefined;

      const xEmu = off ? Number(off["@_x"] || 0) : 0;
      const yEmu = off ? Number(off["@_y"] || 0) : 0;
      const cxEmu = ext ? Number(ext["@_cx"] || 0) : 0;
      const cyEmu = ext ? Number(ext["@_cy"] || 0) : 0;

      result.push({ phInfo, xEmu, yEmu, cxEmu, cyEmu, shapeXml: shape });
    }

    return result;
  }

  // ── Placeholder matching key ────────────────────────────────────────

  /**
   * Build a matching key for a placeholder. Placeholders match primarily
   * by type. When both have an idx, the idx must also match.
   */
  protected buildPlaceholderMatchKey(phInfo: PlaceholderInfo): string {
    // Normalise missing type to "body" (the OOXML default)
    const type = phInfo.type || "body";
    if (phInfo.idx !== undefined) {
      return `${type}:${phInfo.idx}`;
    }
    return type;
  }

  // ── Core layout switching logic ─────────────────────────────────────

  /**
   * Re-map slide elements to a new layout's placeholders.
   *
   * - Placeholder elements whose type matches a new-layout placeholder
   *   get their position/size updated to the new layout's values.
   * - Placeholder elements with no match in the new layout are removed.
   * - New-layout placeholders with no matching slide element produce
   *   empty text elements that are appended to the slide.
   * - Non-placeholder elements are left untouched.
   *
   * @returns The updated elements array.
   */
  protected remapElementsToNewLayout(
    elements: PptxElement[],
    newLayoutXml: XmlObject,
    newLayoutPath: string,
  ): PptxElement[] {
    const layoutPlaceholders = this.extractLayoutPlaceholders(newLayoutXml);

    // Build a map from match-key -> layout placeholder info
    const layoutPhMap = new Map<
      string,
      {
        phInfo: PlaceholderInfo;
        xEmu: number;
        yEmu: number;
        cxEmu: number;
        cyEmu: number;
        shapeXml: XmlObject;
        matched: boolean;
      }
    >();
    for (const lp of layoutPlaceholders) {
      const key = this.buildPlaceholderMatchKey(lp.phInfo);
      layoutPhMap.set(key, { ...lp, matched: false });
    }

    const resultElements: PptxElement[] = [];

    for (const element of elements) {
      const phInfo = this.getElementPlaceholderInfo(element);

      if (!phInfo) {
        // Non-placeholder element: keep as-is
        resultElements.push(element);
        continue;
      }

      const matchKey = this.buildPlaceholderMatchKey(phInfo);
      const layoutPh = layoutPhMap.get(matchKey);

      // Fall back to matching by type only (ignoring idx) for common
      // placeholder types like title/ctrTitle/subTitle/body
      let resolvedLayoutPh = layoutPh;
      if (!resolvedLayoutPh && phInfo.type) {
        for (const [, lp] of layoutPhMap.entries()) {
          if (!lp.matched && lp.phInfo.type === phInfo.type) {
            resolvedLayoutPh = lp;
            break;
          }
        }
      }

      if (resolvedLayoutPh) {
        // Matched: update position and size from new layout
        resolvedLayoutPh.matched = true;

        const updatedElement = { ...element };
        if (
          resolvedLayoutPh.cxEmu > 0 &&
          resolvedLayoutPh.cyEmu > 0
        ) {
          updatedElement.x = Math.round(resolvedLayoutPh.xEmu / EMU_PER_PX);
          updatedElement.y = Math.round(resolvedLayoutPh.yEmu / EMU_PER_PX);
          updatedElement.width = Math.round(
            resolvedLayoutPh.cxEmu / EMU_PER_PX,
          );
          updatedElement.height = Math.round(
            resolvedLayoutPh.cyEmu / EMU_PER_PX,
          );
        }

        // Update the element's rawXml transform to match
        if (
          updatedElement.rawXml &&
          resolvedLayoutPh.cxEmu > 0 &&
          resolvedLayoutPh.cyEmu > 0
        ) {
          this.updateElementRawXmlTransform(
            updatedElement.rawXml,
            resolvedLayoutPh.xEmu,
            resolvedLayoutPh.yEmu,
            resolvedLayoutPh.cxEmu,
            resolvedLayoutPh.cyEmu,
          );
        }

        resultElements.push(updatedElement);
      }
      // Else: placeholder has no match in the new layout -- drop it
    }

    // Add empty placeholders from the new layout that were not matched
    for (const [, lp] of layoutPhMap) {
      if (lp.matched) continue;
      // Skip footers, date-time, and slide number placeholders -- they
      // are rendered from the layout/master and don't need slide-level
      // elements.
      const skipTypes = new Set(["dt", "ftr", "sldnum", "hdr"]);
      if (lp.phInfo.type && skipTypes.has(lp.phInfo.type)) continue;

      // Create an empty text element for this placeholder
      const emptyElement = this.createEmptyPlaceholderElement(
        lp.phInfo,
        lp.xEmu,
        lp.yEmu,
        lp.cxEmu,
        lp.cyEmu,
        newLayoutPath,
      );
      if (emptyElement) {
        resultElements.push(emptyElement);
      }
    }

    return resultElements;
  }

  // ── rawXml transform update ─────────────────────────────────────────

  /**
   * Update the transform (`a:xfrm`) inside an element's rawXml to
   * reflect new position and size values in EMU.
   */
  protected updateElementRawXmlTransform(
    rawXml: XmlObject,
    xEmu: number,
    yEmu: number,
    cxEmu: number,
    cyEmu: number,
  ): void {
    // Find spPr in the appropriate container
    const spPr = rawXml["p:spPr"] as XmlObject | undefined;
    if (!spPr) return;

    let xfrm = spPr["a:xfrm"] as XmlObject | undefined;
    if (!xfrm) {
      xfrm = {};
      spPr["a:xfrm"] = xfrm;
    }

    let off = xfrm["a:off"] as XmlObject | undefined;
    if (!off) {
      off = {};
      xfrm["a:off"] = off;
    }
    off["@_x"] = String(xEmu);
    off["@_y"] = String(yEmu);

    let ext = xfrm["a:ext"] as XmlObject | undefined;
    if (!ext) {
      ext = {};
      xfrm["a:ext"] = ext;
    }
    ext["@_cx"] = String(cxEmu);
    ext["@_cy"] = String(cyEmu);
  }

  // ── Empty placeholder creation ──────────────────────────────────────

  /**
   * Create a minimal text element representing an empty placeholder
   * from the new layout. The element has the correct position/size and
   * a `rawXml` with a `p:ph` reference so that the save pipeline
   * preserves the placeholder binding.
   */
  protected createEmptyPlaceholderElement(
    phInfo: PlaceholderInfo,
    xEmu: number,
    yEmu: number,
    cxEmu: number,
    cyEmu: number,
    _layoutPath: string,
  ): PptxElement | null {
    if (cxEmu <= 0 || cyEmu <= 0) return null;

    const phNode: XmlObject = {};
    if (phInfo.type) {
      phNode["@_type"] = phInfo.type;
    }
    if (phInfo.idx !== undefined) {
      phNode["@_idx"] = phInfo.idx;
    }

    const rawXml: XmlObject = {
      "p:nvSpPr": {
        "p:cNvPr": {
          "@_id": String(Date.now() + Math.floor(Math.random() * 10000)),
          "@_name": `Placeholder ${phInfo.type || "content"}`,
        },
        "p:cNvSpPr": {
          "a:spLocks": { "@_noGrp": "1" },
        },
        "p:nvPr": {
          "p:ph": phNode,
        },
      },
      "p:spPr": {
        "a:xfrm": {
          "a:off": { "@_x": String(xEmu), "@_y": String(yEmu) },
          "a:ext": { "@_cx": String(cxEmu), "@_cy": String(cyEmu) },
        },
      },
      "p:txBody": {
        "a:bodyPr": {},
        "a:lstStyle": {},
        "a:p": { "a:endParaRPr": { "@_lang": "en-US" } },
      },
    };

    const element: PptxElement = {
      type: "text" as const,
      id: `ph-${phInfo.type || "content"}-${phInfo.idx || "0"}-${Date.now()}`,
      x: Math.round(xEmu / EMU_PER_PX),
      y: Math.round(yEmu / EMU_PER_PX),
      width: Math.round(cxEmu / EMU_PER_PX),
      height: Math.round(cyEmu / EMU_PER_PX),
      text: "",
      rawXml,
    };

    return element;
  }
}
