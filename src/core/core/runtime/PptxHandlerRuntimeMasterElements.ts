import { XmlObject, PlaceholderTextLevelStyle, PptxElement } from "../../types";
import { type PlaceholderInfo } from "./PptxHandlerRuntimeTypes";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimePlaceholderDefaults";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  protected parsePresentationDefaultTextStyle(): void {
    const presentation = this.presentationData?.["p:presentation"] as
      | XmlObject
      | undefined;
    const defaultTextStyle = presentation?.["p:defaultTextStyle"] as
      | XmlObject
      | undefined;
    if (!defaultTextStyle) {
      this.presentationDefaultTextStyle = undefined;
      return;
    }

    const levelStyles: Record<number, PlaceholderTextLevelStyle> = {};
    for (let level = 1; level <= 9; level++) {
      const parsed = this.parsePlaceholderLevelStyle(
        defaultTextStyle[`a:lvl${level}pPr`] as XmlObject | undefined,
      );
      if (parsed) {
        levelStyles[level - 1] = parsed;
      }
    }

    const defaultLevel = this.parsePlaceholderLevelStyle(
      defaultTextStyle["a:defPPr"] as XmlObject | undefined,
    );
    if (defaultLevel) {
      levelStyles[-1] = defaultLevel;
    }

    this.presentationDefaultTextStyle =
      Object.keys(levelStyles).length > 0
        ? {
            type: "body",
            levelStyles,
          }
        : undefined;
  }

  protected async getMasterElements(
    layoutPath: string,
  ): Promise<PptxElement[]> {
    // Get the layout's relationship file to find the master
    const layoutRels = this.slideRelsMap.get(layoutPath);
    if (!layoutRels) return [];

    let masterPath: string | undefined;
    for (const [, target] of layoutRels.entries()) {
      if (target.includes("slideMaster")) {
        const layoutDir = layoutPath.substring(
          0,
          layoutPath.lastIndexOf("/") + 1,
        );
        masterPath = target.startsWith("..")
          ? this.resolvePath(layoutDir, target)
          : "ppt/" + target.replace("../", "");
        break;
      }
    }

    if (!masterPath) return [];

    // Check cache first
    if (this.masterCache.has(masterPath)) {
      return this.masterCache.get(masterPath)!;
    }

    try {
      const masterXmlStr = await this.zip.file(masterPath)?.async("string");
      if (!masterXmlStr) return [];

      const masterXmlObj = this.parser.parse(masterXmlStr);
      this.masterXmlMap.set(masterPath, masterXmlObj as XmlObject);

      // Load master relationships
      const masterRelsPath =
        masterPath.replace("slideMasters/", "slideMasters/_rels/") + ".rels";
      await this.loadSlideRelationships(masterPath, masterRelsPath);

      const spTree = masterXmlObj["p:sldMaster"]?.["p:cSld"]?.["p:spTree"];
      if (!spTree) {
        this.masterCache.set(masterPath, []);
        return [];
      }

      // First pass: extract placeholder defaults from shapes
      const shapes = this.ensureArray(spTree["p:sp"]);
      const placeholderShapeIndices = new Set<number>();
      for (let idx = 0; idx < shapes.length; idx++) {
        const shape = shapes[idx];
        const nvSpPr = shape["p:nvSpPr"];
        const ph = nvSpPr?.["p:nvPr"]?.["p:ph"];
        if (ph) {
          placeholderShapeIndices.add(idx);
          const phDefaults = this.extractPlaceholderDefaultsFromShape(
            shape as XmlObject,
          );
          if (phDefaults) {
            if (!this.masterPlaceholderDefaultsCache.has(masterPath)) {
              this.masterPlaceholderDefaultsCache.set(masterPath, new Map());
            }
            const phInfo: PlaceholderInfo = {
              type: phDefaults.type,
              idx:
                phDefaults.idx !== undefined
                  ? String(phDefaults.idx)
                  : undefined,
            };
            const key = this.buildPlaceholderDefaultsKey(phInfo);
            this.masterPlaceholderDefaultsCache
              .get(masterPath)!
              .set(key, phDefaults);
          }
        }
      }

      // Parse elements in document order (preserving z-order)
      const childOrder = this.extractSpTreeChildOrder(
        masterXmlStr,
        spTree as Record<string, unknown>,
        "p:spTree",
      );
      const elements: PptxElement[] = [];

      for (const entry of childOrder) {
        if (entry.tag === "p:sp") {
          // Skip placeholder shapes
          if (placeholderShapeIndices.has(entry.indexInType)) continue;
          const shape = shapes[entry.indexInType];
          if (!shape) continue;

          const spPr = shape["p:spPr"];
          let element: PptxElement | null = null;

          if (spPr?.["a:blipFill"]) {
            element = await this.parseShapeWithImageFill(
              shape,
              `master-shape-img-${entry.indexInType}`,
              masterPath,
            );
          } else {
            element = this.parseShape(
              shape,
              `master-shape-${entry.indexInType}`,
              masterPath,
            );
          }

          if (element) {
            element.id = `master-${element.id}`;
            elements.push(element);
          }
        } else if (entry.tag === "p:pic") {
          const pics = this.ensureArray(spTree["p:pic"]);
          const pic = pics[entry.indexInType];
          if (!pic) continue;
          const element = await this.parsePicture(
            pic,
            `master-pic-${entry.indexInType}`,
            masterPath,
          );
          if (element) {
            element.id = `master-${element.id}`;
            elements.push(element);
          }
        } else if (entry.tag === "p:graphicFrame") {
          const frames = this.ensureArray(spTree["p:graphicFrame"]);
          const frame = frames[entry.indexInType];
          if (!frame) continue;
          const element = this.parseGraphicFrame(
            frame,
            `master-frame-${entry.indexInType}`,
            masterPath,
          );
          if (element) {
            element.id = `master-${element.id}`;
            elements.push(element);
          }
        }
        // Other element types (p:grpSp, p:cxnSp, p:contentPart) are
        // uncommon in masters but could be added here if needed.
      }

      this.masterCache.set(masterPath, elements);
      return elements;
    } catch (e) {
      console.warn("Failed to parse master:", e);
      return [];
    }
  }
}
