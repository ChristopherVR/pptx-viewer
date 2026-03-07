import { XmlObject, PptxSlide, PptxElement } from "../../types";
import {
  buildGuideListExtension,
  P14_GUIDE_URI,
  P15_GUIDE_URI,
} from "../../utils/guide-utils";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeSaveMediaTimingWrite";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  /**
   * Recursively walk an XML object tree and deduplicate extension list entries
   * by `@_uri`. When multiple `a:ext` or `p:ext` entries share the same URI,
   * only the last one is kept (which reflects the most recently written state).
   * This prevents extension entries from being duplicated across save cycles.
   */
  protected deduplicateExtensionLists(node: unknown): void {
    if (node === null || node === undefined || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) {
        this.deduplicateExtensionLists(item);
      }
      return;
    }

    const obj = node as XmlObject;
    for (const [key, value] of Object.entries(obj)) {
      // Check for extLst nodes (a:extLst, p:extLst, etc.)
      const localName = this.compatibilityService.getXmlLocalName(key);
      if (localName === "extLst" && value && typeof value === "object") {
        const extLst = value as XmlObject;
        // Find the ext array key (a:ext, p:ext, etc.)
        for (const extKey of Object.keys(extLst)) {
          const extLocalName =
            this.compatibilityService.getXmlLocalName(extKey);
          if (extLocalName !== "ext") continue;

          const rawExts = extLst[extKey];
          if (!rawExts) continue;

          const extsArray = Array.isArray(rawExts) ? rawExts : [rawExts];
          if (extsArray.length <= 1) continue;

          // Deduplicate by URI, keeping last occurrence
          const seenUris = new Map<string, number>();
          for (let i = 0; i < extsArray.length; i++) {
            const ext = extsArray[i] as XmlObject | undefined;
            const uri = String(ext?.["@_uri"] || "").trim();
            if (uri.length > 0) {
              seenUris.set(uri, i);
            }
          }

          // Only deduplicate if we found duplicates
          if (seenUris.size < extsArray.length) {
            const keepIndexes = new Set(seenUris.values());
            // Also keep entries without a URI (they cannot be deduped)
            for (let i = 0; i < extsArray.length; i++) {
              const ext = extsArray[i] as XmlObject | undefined;
              const uri = String(ext?.["@_uri"] || "").trim();
              if (uri.length === 0) {
                keepIndexes.add(i);
              }
            }
            const dedupedExts = extsArray.filter((_ext: unknown, idx: number) =>
              keepIndexes.has(idx),
            );
            extLst[extKey] =
              dedupedExts.length === 1 ? dedupedExts[0] : dedupedExts;
          }
        }
      }

      // Recurse into child nodes
      this.deduplicateExtensionLists(value);
    }
  }

  /**
   * Write drawing guides back to the slide's extension list.
   *
   * Removes any existing guide extensions (p14/p15) and, if the slide
   * has guides, inserts a new `p14:sldGuideLst` extension entry.
   */
  protected applySlideDrawingGuides(
    slideNode: XmlObject,
    slide: PptxSlide,
  ): void {
    let extLst = slideNode["p:extLst"] as XmlObject | undefined;

    // Remove existing guide extensions
    if (extLst) {
      const extKey = Object.keys(extLst).find((k) => {
        const ln = this.compatibilityService.getXmlLocalName(k);
        return ln === "ext";
      });
      if (extKey) {
        const rawExts = extLst[extKey];
        const extsArray = Array.isArray(rawExts)
          ? (rawExts as XmlObject[])
          : rawExts
            ? [rawExts as XmlObject]
            : [];
        const filtered = extsArray.filter((ext) => {
          const uri = String(ext["@_uri"] ?? "");
          return uri !== P14_GUIDE_URI && uri !== P15_GUIDE_URI;
        });
        if (filtered.length !== extsArray.length) {
          extLst[extKey] =
            filtered.length === 0
              ? undefined
              : filtered.length === 1
                ? filtered[0]
                : filtered;
        }
      }
    }

    // Add guide extension if slide has guides
    if (slide.guides && slide.guides.length > 0) {
      if (!extLst) {
        extLst = {};
        slideNode["p:extLst"] = extLst;
      }
      const guideExt = buildGuideListExtension(slide.guides);
      const extKey =
        Object.keys(extLst).find((k) => {
          const ln = this.compatibilityService.getXmlLocalName(k);
          return ln === "ext";
        }) ?? "p:ext";
      const rawExts = extLst[extKey];
      const extsArray = Array.isArray(rawExts)
        ? (rawExts as XmlObject[])
        : rawExts
          ? [rawExts as XmlObject]
          : [];
      extsArray.push(guideExt);
      extLst[extKey] = extsArray.length === 1 ? extsArray[0] : extsArray;
    }
  }

  protected resolveLayoutPathForSlide(slidePath: string): string | undefined {
    const slideRels = this.slideRelsMap.get(slidePath);
    if (!slideRels) return undefined;

    for (const [, target] of slideRels.entries()) {
      if (!target.includes("slideLayout")) continue;
      const slideDir = slidePath.substring(0, slidePath.lastIndexOf("/") + 1);
      return target.startsWith("..")
        ? this.resolvePath(slideDir, target)
        : `ppt/${target.replace("../", "")}`;
    }
    return undefined;
  }

  protected resolveMasterPathForLayout(layoutPath: string): string | undefined {
    const layoutRels = this.slideRelsMap.get(layoutPath);
    if (!layoutRels) return undefined;

    for (const [, target] of layoutRels.entries()) {
      if (!target.includes("slideMaster")) continue;
      const layoutDir = layoutPath.substring(
        0,
        layoutPath.lastIndexOf("/") + 1,
      );
      return target.startsWith("..")
        ? this.resolvePath(layoutDir, target)
        : `ppt/${target.replace("../", "")}`;
    }
    return undefined;
  }

  protected getTemplateSpTree(
    slidePath: string,
    elementId: string,
  ): XmlObject | undefined {
    const layoutPath = this.resolveLayoutPathForSlide(slidePath);
    if (!layoutPath) return undefined;

    if (elementId.startsWith("master-")) {
      const masterPath = this.resolveMasterPathForLayout(layoutPath);
      if (!masterPath) return undefined;
      const masterXml = this.masterXmlMap.get(masterPath);
      return masterXml?.["p:sldMaster"]?.["p:cSld"]?.["p:spTree"] as
        | XmlObject
        | undefined;
    }

    const layoutXml = this.layoutXmlMap.get(layoutPath);
    return layoutXml?.["p:sldLayout"]?.["p:cSld"]?.["p:spTree"] as
      | XmlObject
      | undefined;
  }

  protected isSameShapeIdentity(
    key: string,
    left: XmlObject,
    right: XmlObject,
  ): boolean {
    if (left === right) return true;

    const leftNv = this.getCnvPrNode(left, key);
    const rightNv = this.getCnvPrNode(right, key);
    const leftId = String(leftNv?.["@_id"] || "");
    const rightId = String(rightNv?.["@_id"] || "");
    const leftName = String(leftNv?.["@_name"] || "");
    const rightName = String(rightNv?.["@_name"] || "");

    if (!leftId || !rightId) return false;
    if (leftId !== rightId) return false;
    if (!leftName || !rightName) return true;
    return leftName === rightName;
  }

  protected ensureTemplateShapeAttached(
    spTree: XmlObject,
    elementType: PptxElement["type"],
    shape: XmlObject,
  ): XmlObject {
    const key = this.getTreeBucketKeyForElementType(elementType);
    const existingBucket = this.ensureArray(spTree[key]) as XmlObject[];
    for (const candidate of existingBucket) {
      if (this.isSameShapeIdentity(key, candidate, shape)) {
        return candidate;
      }
    }

    existingBucket.push(shape);
    spTree[key] = existingBucket;
    return shape;
  }
}
