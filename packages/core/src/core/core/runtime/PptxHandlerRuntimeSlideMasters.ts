import {
  XmlObject,
  type PptxSlideMaster,
  type PptxSlideLayout,
  type PptxCustomShow,
  type PptxHandoutMaster,
  type PptxNotesMaster,
} from "../../types";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeDocProperties";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  /**
   * Parse background colour from a `p:bg` node.
   */
  protected parseBackgroundColor(
    bg: XmlObject | undefined,
  ): string | undefined {
    if (!bg) return undefined;
    const bgPr = bg["p:bgPr"] as XmlObject | undefined;
    if (bgPr) {
      return this.parseColor(bgPr["a:solidFill"]);
    }
    const bgRef = bg["p:bgRef"] as XmlObject | undefined;
    if (bgRef) {
      return this.parseColor(bgRef);
    }
    return undefined;
  }

  /**
   * Extract placeholder type+idx from all shapes in a shape tree.
   */
  protected extractPlaceholderList(
    spTree: XmlObject | undefined,
  ): Array<{ type: string; idx?: string }> {
    if (!spTree) return [];
    const shapes = this.ensureArray(spTree["p:sp"]);
    const result: Array<{ type: string; idx?: string }> = [];
    for (const sp of shapes) {
      const nvPr = sp?.["p:nvSpPr"]?.["p:nvPr"] as XmlObject | undefined;
      const ph = nvPr?.["p:ph"] as XmlObject | undefined;
      if (!ph) continue;
      const type = String(ph["@_type"] || "body").trim();
      const idx = ph["@_idx"] != null ? String(ph["@_idx"]) : undefined;
      result.push({ type, idx });
    }
    return result;
  }

  protected resolvePath(base: string, relative: string): string {
    const baseParts = base.split("/").filter(Boolean);
    const relParts = relative.split("/");

    // Remove filename from base if present
    if (baseParts.length > 0 && !base.endsWith("/")) {
      baseParts.pop();
    }

    for (const part of relParts) {
      if (part === "..") {
        baseParts.pop();
      } else if (part !== ".") {
        baseParts.push(part);
      }
    }

    return baseParts.join("/");
  }

  protected resolveImagePath(slidePath: string, target: string): string {
    const slideDir = slidePath.substring(0, slidePath.lastIndexOf("/") + 1);
    return target.startsWith("..")
      ? this.resolvePath(slideDir, target)
      : target.startsWith("/")
        ? target.substring(1)
        : slideDir + target;
  }

  /**
   * Parse all slide masters into structured PptxSlideMaster objects.
   */
  protected async parseSlideMasters(): Promise<PptxSlideMaster[]> {
    const results: PptxSlideMaster[] = [];
    try {
      const masterFiles = this.zip.file(
        /^ppt\/slideMasters\/slideMaster\d+\.xml$/,
      );
      if (!masterFiles || masterFiles.length === 0) return results;

      for (const file of masterFiles) {
        const path = file.name;
        const xml = await file.async("string");
        const data = this.parser.parse(xml) as XmlObject;
        const sldMaster = data?.["p:sldMaster"] as XmlObject | undefined;
        if (!sldMaster) continue;

        // Background
        const bg = sldMaster["p:cSld"]?.["p:bg"] as XmlObject | undefined;
        const backgroundColor = this.parseBackgroundColor(bg);

        // Placeholders
        const spTree = sldMaster["p:cSld"]?.["p:spTree"] as
          | XmlObject
          | undefined;
        const placeholders = this.extractPlaceholderList(spTree);

        // Theme reference (from relationship)
        let themePath: string | undefined;
        const relsPath = path.replace(
          /ppt\/slideMasters\/(slideMaster\d+)\.xml/,
          "ppt/slideMasters/_rels/$1.xml.rels",
        );
        const relsFile = this.zip.file(relsPath);
        if (relsFile) {
          const relsXml = await relsFile.async("string");
          const relsData = this.parser.parse(relsXml) as XmlObject;
          const rels = this.ensureArray(
            relsData?.["Relationships"]?.["Relationship"],
          ) as XmlObject[];
          for (const rel of rels) {
            const relType = String(rel["@_Type"] || "");
            if (relType.includes("/theme")) {
              themePath = this.resolveImagePath(
                path,
                String(rel["@_Target"] || ""),
              );
              break;
            }
          }
        }

        // Layouts associated with this master
        const layoutPaths: string[] = [];
        if (relsFile) {
          const relsXml = await relsFile.async("string");
          const relsData = this.parser.parse(relsXml) as XmlObject;
          const rels = this.ensureArray(
            relsData?.["Relationships"]?.["Relationship"],
          ) as XmlObject[];
          for (const rel of rels) {
            const relType = String(rel["@_Type"] || "");
            if (relType.includes("/slideLayout")) {
              layoutPaths.push(
                this.resolveImagePath(path, String(rel["@_Target"] || "")),
              );
            }
          }
        }

        // Parse layout attributes
        const layouts: PptxSlideLayout[] = [];
        for (const lp of layoutPaths) {
          const layout = await this.parseSlideLayoutAttributes(lp);
          if (layout) layouts.push(layout);
        }

        results.push({
          path,
          backgroundColor,
          themePath,
          layoutPaths: layoutPaths.length > 0 ? layoutPaths : undefined,
          layouts: layouts.length > 0 ? layouts : undefined,
          placeholders: placeholders.length > 0 ? placeholders : undefined,
        });
      }
    } catch (e) {
      console.warn("Failed to parse slide masters:", e);
    }
    return results;
  }

  /**
   * Parse the handout master from `ppt/handoutMasters/handoutMaster1.xml`.
   */
  protected async parseHandoutMaster(): Promise<PptxHandoutMaster | undefined> {
    try {
      const files = this.zip.file(
        /^ppt\/handoutMasters\/handoutMaster\d+\.xml$/,
      );
      if (!files || files.length === 0) return undefined;

      const path = files[0].name;
      const xml = await files[0].async("string");
      const data = this.parser.parse(xml) as XmlObject;
      const master = data?.["p:handoutMaster"] as XmlObject | undefined;
      if (!master) return undefined;

      const bg = master["p:cSld"]?.["p:bg"] as XmlObject | undefined;
      const bgColor = this.parseBackgroundColor(bg);

      const spTree = master["p:cSld"]?.["p:spTree"] as XmlObject | undefined;
      const placeholders = this.extractPlaceholderList(spTree);

      return { path, backgroundColor: bgColor, placeholders };
    } catch (e) {
      console.warn("Failed to parse handout master:", e);
      return undefined;
    }
  }

  /**
   * Parse the notes master from `ppt/notesMasters/notesMaster1.xml`.
   */
  protected async parseNotesMaster(): Promise<PptxNotesMaster | undefined> {
    try {
      const files = this.zip.file(/^ppt\/notesMasters\/notesMaster\d+\.xml$/);
      if (!files || files.length === 0) return undefined;

      const path = files[0].name;
      const xml = await files[0].async("string");
      const data = this.parser.parse(xml) as XmlObject;
      const master = data?.["p:notesMaster"] as XmlObject | undefined;
      if (!master) return undefined;

      const bg = master["p:cSld"]?.["p:bg"] as XmlObject | undefined;
      const bgColor = this.parseBackgroundColor(bg);

      const spTree = master["p:cSld"]?.["p:spTree"] as XmlObject | undefined;
      const placeholders = this.extractPlaceholderList(spTree);

      return { path, backgroundColor: bgColor, placeholders };
    } catch (e) {
      console.warn("Failed to parse notes master:", e);
      return undefined;
    }
  }

  /**
   * Parse attributes and metadata from a single slide layout XML file.
   */
  private async parseSlideLayoutAttributes(
    layoutPath: string,
  ): Promise<PptxSlideLayout | undefined> {
    try {
      const layoutFile = this.zip.file(layoutPath);
      if (!layoutFile) return undefined;
      const xml = await layoutFile.async("string");
      const data = this.parser.parse(xml) as XmlObject;
      const sldLayout = data?.["p:sldLayout"] as XmlObject | undefined;
      if (!sldLayout) return undefined;

      const layout: PptxSlideLayout = { path: layoutPath };

      // Name from p:cSld/@name
      const cSldName = String(sldLayout["p:cSld"]?.["@_name"] || "").trim();
      if (cSldName) layout.name = cSldName;

      // Layout-level attributes
      const matchingName = String(sldLayout["@_matchingName"] || "").trim();
      if (matchingName) layout.matchingName = matchingName;

      const preserve = sldLayout["@_preserve"];
      if (preserve !== undefined) {
        const pVal = String(preserve).trim().toLowerCase();
        layout.preserve = pVal === "1" || pVal === "true";
      }

      const showMasterPhAnim = sldLayout["@_showMasterPhAnim"];
      if (showMasterPhAnim !== undefined) {
        const sVal = String(showMasterPhAnim).trim().toLowerCase();
        layout.showMasterPhAnim = sVal !== "0" && sVal !== "false";
      }

      const userDrawn = sldLayout["@_userDrawn"];
      if (userDrawn !== undefined) {
        const uVal = String(userDrawn).trim().toLowerCase();
        layout.userDrawn = uVal === "1" || uVal === "true";
      }

      // Colour map override (inline parse — parseClrMapOverrideNode is further in chain)
      const clrMapOvr = sldLayout["p:clrMapOvr"] as XmlObject | undefined;
      if (clrMapOvr && clrMapOvr["a:masterClrMapping"] === undefined) {
        const overrideNode = clrMapOvr["a:overrideClrMapping"] as XmlObject | undefined;
        if (overrideNode) {
          const aliasKeys = [
            "bg1", "tx1", "bg2", "tx2",
            "accent1", "accent2", "accent3", "accent4",
            "accent5", "accent6", "hlink", "folHlink",
          ];
          const overrideMap: Record<string, string> = {};
          for (const key of aliasKeys) {
            const mapped = String(overrideNode[`@_${key}`] || "").trim().toLowerCase();
            if (mapped) overrideMap[key] = mapped;
          }
          if (Object.keys(overrideMap).length > 0) layout.clrMapOverride = overrideMap;
        }
      }

      // Background
      const bg = sldLayout["p:cSld"]?.["p:bg"] as XmlObject | undefined;
      const bgColor = this.parseBackgroundColor(bg);
      if (bgColor) layout.backgroundColor = bgColor;

      // Placeholders
      const spTree = sldLayout["p:cSld"]?.["p:spTree"] as XmlObject | undefined;
      const placeholders = this.extractPlaceholderList(spTree);
      if (placeholders.length > 0) layout.placeholders = placeholders;

      return layout;
    } catch (e) {
      console.warn("Failed to parse slide layout attributes:", e);
      return undefined;
    }
  }

  /**
   * Parse custom slide shows from `p:presentation/p:custShowLst`.
   */
  protected parseCustomShows(): PptxCustomShow[] | undefined {
    try {
      const custShowLst =
        this.presentationData?.["p:presentation"]?.["p:custShowLst"];
      if (!custShowLst) return undefined;

      const custShows = this.ensureArray(custShowLst["p:custShow"]);
      if (custShows.length === 0) return undefined;

      return custShows.map((show: XmlObject) => {
        const name = String(show["@_name"] || "");
        const id = String(show["@_id"] || "");
        const sldLst = show["p:sldLst"];
        const sldEntries = sldLst ? this.ensureArray(sldLst["p:sld"]) : [];
        const slideRIds = sldEntries
          .map((sld: XmlObject) => String(sld["@_r:id"] || ""))
          .filter((rId: string) => rId.length > 0);

        return { name, id, slideRIds };
      });
    } catch (e) {
      console.warn("Failed to parse custom slide shows:", e);
      return undefined;
    }
  }
}
