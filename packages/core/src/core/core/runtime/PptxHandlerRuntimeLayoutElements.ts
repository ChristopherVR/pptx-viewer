import { XmlObject, PptxElement } from "../../types";
import { type PlaceholderInfo } from "./PptxHandlerRuntimeTypes";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeMasterElements";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  protected async getLayoutElements(slidePath: string): Promise<PptxElement[]> {
    // Get the slide's relationship file to find the layout
    const slideRels = this.slideRelsMap.get(slidePath);
    if (!slideRels) return [];

    // Find the slideLayout relationship
    let layoutPath: string | undefined;
    for (const [, target] of slideRels.entries()) {
      if (target.includes("slideLayout")) {
        const slideDir = slidePath.substring(0, slidePath.lastIndexOf("/") + 1);
        layoutPath = target.startsWith("..")
          ? this.resolvePath(slideDir, target)
          : "ppt/" + target.replace("../", "");
        break;
      }
    }

    if (!layoutPath) return [];

    // Check cache first
    if (this.layoutCache.has(layoutPath)) {
      return this.layoutCache.get(layoutPath)!;
    }

    try {
      const layoutXmlStr = await this.zip.file(layoutPath)?.async("string");
      if (!layoutXmlStr) return [];

      const layoutXmlObj = this.parser.parse(layoutXmlStr);
      this.layoutXmlMap.set(layoutPath, layoutXmlObj as XmlObject);

      // Load layout relationships
      const layoutRelsPath =
        layoutPath.replace("slideLayouts/", "slideLayouts/_rels/") + ".rels";
      await this.loadSlideRelationships(layoutPath, layoutRelsPath);

      // Apply layout-level colour map override while parsing its elements
      const layoutClrMapOverride = this.parseLayoutClrMapOverride(
        layoutXmlObj as XmlObject,
      );
      const prevClrMapOverride = this.currentSlideClrMapOverride;
      if (layoutClrMapOverride) {
        this.currentSlideClrMapOverride = layoutClrMapOverride;
      }

      // Parse layout elements - but mark them as from layout (non-editable in basic editor)
      const spTree = layoutXmlObj["p:sldLayout"]?.["p:cSld"]?.["p:spTree"];
      if (!spTree) {
        this.layoutCache.set(layoutPath, []);
        return [];
      }

      // Unwrap mc:AlternateContent blocks before accessing element arrays
      this.unwrapAlternateContent(spTree as Record<string, unknown>);

      // First pass: extract placeholder defaults from shapes (before
      // document-order iteration) so that the inheritance chain is fully
      // populated regardless of element order.
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
            if (!this.layoutPlaceholderDefaultsCache.has(layoutPath)) {
              this.layoutPlaceholderDefaultsCache.set(layoutPath, new Map());
            }
            const phInfo: PlaceholderInfo = {
              type: phDefaults.type,
              idx:
                phDefaults.idx !== undefined
                  ? String(phDefaults.idx)
                  : undefined,
            };
            const key = this.buildPlaceholderDefaultsKey(phInfo);
            this.layoutPlaceholderDefaultsCache
              .get(layoutPath)!
              .set(key, phDefaults);
          }
        }
      }

      // Parse elements in document order (preserving z-order)
      const childOrder = this.extractSpTreeChildOrder(
        layoutXmlStr,
        spTree as Record<string, unknown>,
        "p:spTree",
      );
      const elements: PptxElement[] = [];

      for (const entry of childOrder) {
        if (entry.tag === "p:sp") {
          // Skip placeholder shapes — they were already processed above
          if (placeholderShapeIndices.has(entry.indexInType)) continue;
          const shape = shapes[entry.indexInType];
          if (!shape) continue;

          const spPr = shape["p:spPr"];
          let element: PptxElement | null = null;

          if (spPr?.["a:blipFill"]) {
            element = await this.parseShapeWithImageFill(
              shape,
              `layout-shape-img-${entry.indexInType}`,
              layoutPath,
            );
          } else {
            element = this.parseShape(
              shape,
              `layout-shape-${entry.indexInType}`,
              layoutPath,
            );
          }

          if (element) {
            element.id = `layout-${element.id}`;
            elements.push(element);
          }
        } else if (entry.tag === "p:pic") {
          const pics = this.ensureArray(spTree["p:pic"]);
          const pic = pics[entry.indexInType];
          if (!pic) continue;
          const element = await this.parsePicture(
            pic,
            `layout-pic-${entry.indexInType}`,
            layoutPath,
          );
          if (element) {
            element.id = `layout-${element.id}`;
            elements.push(element);
          }
        } else if (entry.tag === "p:graphicFrame") {
          const frames = this.ensureArray(spTree["p:graphicFrame"]);
          const frame = frames[entry.indexInType];
          if (!frame) continue;
          const element = this.parseGraphicFrame(
            frame,
            `layout-frame-${entry.indexInType}`,
            layoutPath,
          );
          if (element) {
            element.id = `layout-${element.id}`;
            elements.push(element);
          }
        }
        // Other element types (p:grpSp, p:cxnSp, p:contentPart) are
        // uncommon in layouts but could be added here if needed.
      }

      // Restore colour map override
      this.currentSlideClrMapOverride = prevClrMapOverride;

      // Check whether master shapes should be shown on this layout
      // (p:sldLayout/@showMasterSp — defaults to true when absent)
      const layoutShowMasterSp = (layoutXmlObj as XmlObject)["p:sldLayout"]?.[
        "@_showMasterSp"
      ];
      const showMasterSp =
        layoutShowMasterSp === undefined ||
        (String(layoutShowMasterSp).trim().toLowerCase() !== "0" &&
          String(layoutShowMasterSp).trim().toLowerCase() !== "false");

      // Also get master elements (only if the layout does not hide them)
      const masterElements = showMasterSp
        ? await this.getMasterElements(layoutPath)
        : [];
      const allElements = [...masterElements, ...elements];

      this.layoutCache.set(layoutPath, allElements);
      return allElements;
    } catch (e) {
      console.warn("Failed to parse layout:", e);
      return [];
    }
  }
}
