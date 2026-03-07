import { XmlObject } from "../../types";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeColorAndEffects";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  protected async extractBackgroundImage(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    slideXml: any,
    slidePath: string,
    rootElement: string = "p:sld",
  ): Promise<string | undefined> {
    try {
      const bg = slideXml[rootElement]?.["p:cSld"]?.["p:bg"];
      if (!bg) return undefined;

      const bgPr = bg["p:bgPr"];
      if (bgPr?.["a:blipFill"]) {
        const blip = bgPr["a:blipFill"]["a:blip"];
        const rEmbed = blip?.["@_r:embed"];

        if (rEmbed) {
          const slideRels = this.slideRelsMap.get(slidePath);
          const target = slideRels?.get(rEmbed);

          if (target) {
            const imagePath = this.resolveImagePath(slidePath, target);
            return this.getImageData(imagePath);
          }
        }
      }
    } catch (e) {
      console.warn("Failed to extract background image:", e);
    }
    return undefined;
  }

  protected extractBackgroundColor(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    slideXml: any,
    rootElement: string = "p:sld",
  ): string | undefined {
    try {
      const bg = slideXml[rootElement]?.["p:cSld"]?.["p:bg"];
      if (!bg) return undefined;

      // Try solid fill from bgPr
      const bgPr = bg["p:bgPr"];
      if (bgPr) {
        const solidFill = bgPr["a:solidFill"];
        if (solidFill) {
          return this.parseColor(solidFill);
        }
        // Pattern fill foreground colour as fallback for solid rendering
        const pattFill = bgPr["a:pattFill"] as XmlObject | undefined;
        if (pattFill) {
          const fgClr = this.parseColor(pattFill["a:fgClr"]);
          if (fgClr) return fgClr;
          const bgClr = this.parseColor(pattFill["a:bgClr"]);
          if (bgClr) return bgClr;
        }
      }

      // Try bgRef (reference to theme background)
      const bgRef = bg["p:bgRef"];
      if (bgRef) {
        // Check for solid fill in bgRef
        const solidFill = bgRef["a:solidFill"];
        if (solidFill) {
          return this.parseColor(solidFill);
        }
        // Resolve via theme format scheme bgFillStyleLst
        const refColor = this.parseColor(bgRef);
        if (refColor) return refColor;
        // If it references a theme, default to white
        return "#FFFFFF";
      }
    } catch {
      // Ignore background parsing errors
    }
    return undefined;
  }

  /**
   * Extract a CSS gradient string from a slide/layout/master background.
   * Handles `a:gradFill` within `p:bgPr` and gradient-based `p:bgRef`.
   */
  protected extractBackgroundGradient(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    slideXml: any,
    rootElement: string = "p:sld",
  ): string | undefined {
    try {
      const bg = slideXml[rootElement]?.["p:cSld"]?.["p:bg"];
      if (!bg) return undefined;

      const bgPr = bg["p:bgPr"] as XmlObject | undefined;
      if (bgPr) {
        const gradFill = bgPr["a:gradFill"] as XmlObject | undefined;
        if (gradFill) {
          return this.extractGradientFillCss(gradFill);
        }
      }

      // bgRef may reference a theme background fill that is a gradient
      const bgRef = bg["p:bgRef"] as XmlObject | undefined;
      if (bgRef && this.themeFormatScheme) {
        const idx = parseInt(String(bgRef["@_idx"] || "0"), 10);
        if (idx >= 1001) {
          const offset = idx - 1001;
          const fillDef = this.themeFormatScheme.backgroundFillStyles[offset];
          if (fillDef?.kind === "gradient" && fillDef.rawNode) {
            const overrideColor = this.parseColor(bgRef);
            if (overrideColor) {
              const result = this.reResolveGradientWithPhClr(
                fillDef.rawNode as XmlObject,
                overrideColor,
              );
              return result.css;
            }
            return fillDef.gradientCss;
          }
        }
      }
    } catch {
      // Ignore
    }
    return undefined;
  }

  protected async getMasterBackgroundImage(
    layoutPath: string,
  ): Promise<string | undefined> {
    const layoutRels = this.slideRelsMap.get(layoutPath);
    if (!layoutRels) return undefined;

    for (const [, target] of layoutRels.entries()) {
      if (target.includes("slideMaster")) {
        const layoutDir = layoutPath.substring(
          0,
          layoutPath.lastIndexOf("/") + 1,
        );
        const masterPath = target.startsWith("..")
          ? this.resolvePath(layoutDir, target)
          : "ppt/" + target.replace("../", "");

        try {
          const masterXmlStr = await this.zip.file(masterPath)?.async("string");
          if (masterXmlStr) {
            const masterXmlObj = this.parser.parse(masterXmlStr);
            const masterRelsPath =
              masterPath.replace("slideMasters/", "slideMasters/_rels/") +
              ".rels";
            await this.loadSlideRelationships(masterPath, masterRelsPath);

            return this.extractBackgroundImage(
              masterXmlObj,
              masterPath,
              "p:sldMaster",
            );
          }
        } catch {
          // Ignore
        }
        break;
      }
    }
    return undefined;
  }

  protected async getLayoutBackgroundImage(
    slidePath: string,
  ): Promise<string | undefined> {
    const slideRels = this.slideRelsMap.get(slidePath);
    if (!slideRels) return undefined;

    for (const [, target] of slideRels.entries()) {
      if (target.includes("slideLayout")) {
        const slideDir = slidePath.substring(0, slidePath.lastIndexOf("/") + 1);
        const layoutPath = target.startsWith("..")
          ? this.resolvePath(slideDir, target)
          : "ppt/" + target.replace("../", "");

        try {
          const layoutXmlStr = await this.zip.file(layoutPath)?.async("string");
          if (layoutXmlStr) {
            const layoutXmlObj = this.parser.parse(layoutXmlStr);
            // We need to load layout rels to resolve images
            const layoutRelsPath =
              layoutPath.replace("slideLayouts/", "slideLayouts/_rels/") +
              ".rels";
            await this.loadSlideRelationships(layoutPath, layoutRelsPath);

            const bg = this.extractBackgroundImage(
              layoutXmlObj,
              layoutPath,
              "p:sldLayout",
            );

            if (bg) return bg;

            // Fallback to Master
            return this.getMasterBackgroundImage(layoutPath);
          }
        } catch {
          // Ignore
        }
        break;
      }
    }
    return undefined;
  }

  protected async getLayoutBackgroundColor(
    slidePath: string,
  ): Promise<string | undefined> {
    const slideRels = this.slideRelsMap.get(slidePath);
    if (!slideRels) return undefined;

    for (const [, target] of slideRels.entries()) {
      if (target.includes("slideLayout")) {
        const slideDir = slidePath.substring(0, slidePath.lastIndexOf("/") + 1);
        const layoutPath = target.startsWith("..")
          ? this.resolvePath(slideDir, target)
          : "ppt/" + target.replace("../", "");

        try {
          const layoutXmlStr = await this.zip.file(layoutPath)?.async("string");
          if (layoutXmlStr) {
            const layoutXmlObj = this.parser.parse(layoutXmlStr);
            const layoutBg = this.extractBackgroundColor(
              layoutXmlObj,
              "p:sldLayout",
            );
            if (layoutBg) return layoutBg;

            // Fallback to master background colour
            return this.getMasterBackgroundColor(layoutPath);
          }
        } catch {
          // Ignore
        }
        break;
      }
    }
    return undefined;
  }

  /**
   * Resolve the slide master's background colour given a layout path.
   */
  protected async getMasterBackgroundColor(
    layoutPath: string,
  ): Promise<string | undefined> {
    const layoutRels = this.slideRelsMap.get(layoutPath);
    if (!layoutRels) return undefined;

    for (const [, target] of layoutRels.entries()) {
      if (target.includes("slideMaster")) {
        const layoutDir = layoutPath.substring(
          0,
          layoutPath.lastIndexOf("/") + 1,
        );
        const masterPath = target.startsWith("..")
          ? this.resolvePath(layoutDir, target)
          : "ppt/" + target.replace("../", "");

        try {
          const masterXmlStr = await this.zip.file(masterPath)?.async("string");
          if (masterXmlStr) {
            const masterXmlObj = this.parser.parse(masterXmlStr);
            return this.extractBackgroundColor(masterXmlObj, "p:sldMaster");
          }
        } catch {
          // Ignore
        }
        break;
      }
    }
    return undefined;
  }
}
