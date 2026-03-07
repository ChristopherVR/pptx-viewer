import {
  XmlObject,
  type PptxActiveXControl,
  type PptxAppProperties,
  type PptxCoreProperties,
  type PptxCustomProperty,
  type PptxCustomerData,
  type PptxTag,
  type PptxTagCollection,
} from "../../types";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeMediaData";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  protected buildRelativeTargetPath(
    fromPartPath: string,
    toPartPath: string,
  ): string {
    const fromParts = fromPartPath.split("/");
    const toParts = toPartPath.split("/");
    // Remove file name from source part path.
    fromParts.pop();

    while (
      fromParts.length > 0 &&
      toParts.length > 0 &&
      fromParts[0] === toParts[0]
    ) {
      fromParts.shift();
      toParts.shift();
    }

    const upSegments = new Array(fromParts.length).fill("..");
    return [...upSegments, ...toParts].join("/");
  }

  protected async setMasterThemeRelationship(
    masterPath: string,
    themePath: string,
  ): Promise<void> {
    const relsPath = masterPath.replace(
      /ppt\/slideMasters\/(slideMaster\d+)\.xml/,
      "ppt/slideMasters/_rels/$1.xml.rels",
    );
    const relsFile = this.zip.file(relsPath);
    if (!relsFile) return;

    const relsXml = await relsFile.async("string");
    const relsData = this.parser.parse(relsXml) as XmlObject;
    const relRoot = (relsData["Relationships"] || {}) as XmlObject;
    const relationships = this.ensureArray(
      relRoot["Relationship"],
    ) as XmlObject[];
    const themeRel = relationships.find((rel) =>
      String(rel["@_Type"] || "").includes("/theme"),
    );
    if (!themeRel) return;

    themeRel["@_Target"] = this.buildRelativeTargetPath(masterPath, themePath);
    relRoot["Relationship"] = relationships;
    relsData["Relationships"] = relRoot;
    this.zip.file(relsPath, this.builder.build(relsData));
  }

  public async setPresentationTheme(
    themePath: string,
    applyToAllMasters = true,
  ): Promise<void> {
    const normalizedThemePath = themePath.trim().replace(/\\/g, "/");
    if (!normalizedThemePath.startsWith("ppt/theme/")) return;
    const masterFiles = this.zip.file(
      /^ppt\/slideMasters\/slideMaster\d+\.xml$/,
    );
    if (!masterFiles || masterFiles.length === 0) return;

    const targetMasters = applyToAllMasters ? masterFiles : [masterFiles[0]];
    await Promise.all(
      targetMasters.map(async (masterFile) => {
        await this.setMasterThemeRelationship(
          masterFile.name,
          normalizedThemePath,
        );
      }),
    );
  }

  /**
   * Parse extended (application) properties from `docProps/app.xml`.
   */
  protected async parseAppProperties(): Promise<PptxAppProperties | undefined> {
    try {
      const appFile = this.zip.file("docProps/app.xml");
      if (!appFile) return undefined;

      const xml = await appFile.async("string");
      const data = this.parser.parse(xml) as XmlObject;
      const props = data?.["Properties"] as XmlObject | undefined;
      if (!props) return undefined;

      const str = (key: string): string | undefined => {
        const v = props[key];
        if (v === undefined || v === null) return undefined;
        const raw = String(v).trim();
        return raw || undefined;
      };

      const num = (key: string): number | undefined => {
        const v = props[key];
        if (v === undefined || v === null) return undefined;
        const n = Number(v);
        return Number.isFinite(n) ? n : undefined;
      };

      const result: PptxAppProperties = {
        application: str("Application"),
        appVersion: str("AppVersion"),
        presentationFormat: str("PresentationFormat"),
        slides: num("Slides"),
        hiddenSlides: num("HiddenSlides"),
        notes: num("Notes"),
        totalTime: num("TotalTime"),
        words: num("Words"),
        paragraphs: num("Paragraphs"),
        company: str("Company"),
        manager: str("Manager"),
        template: str("Template"),
      };

      const hasAny = Object.values(result).some((v) => v !== undefined);
      return hasAny ? result : undefined;
    } catch (e) {
      console.warn("Failed to parse app properties:", e);
      return undefined;
    }
  }

  /**
   * Parse core document properties from `docProps/core.xml`.
   */
  protected async parseCoreProperties(): Promise<
    PptxCoreProperties | undefined
  > {
    try {
      const coreFile = this.zip.file("docProps/core.xml");
      if (!coreFile) return undefined;

      const xml = await coreFile.async("string");
      const data = this.parser.parse(xml) as XmlObject;
      const coreProps = data?.["cp:coreProperties"] as XmlObject | undefined;
      if (!coreProps) return undefined;

      const str = (key: string): string | undefined => {
        const v = coreProps[key];
        if (v === undefined || v === null) return undefined;
        // Some elements carry attributes, so text content may be under #text
        const raw =
          typeof v === "object" && v !== null
            ? String((v as XmlObject)["#text"] ?? "")
            : String(v);
        return raw.trim() || undefined;
      };

      const result: PptxCoreProperties = {
        title: str("dc:title"),
        subject: str("dc:subject"),
        creator: str("dc:creator"),
        keywords: str("cp:keywords"),
        description: str("dc:description"),
        lastModifiedBy: str("cp:lastModifiedBy"),
        revision: str("cp:revision"),
        created: str("dcterms:created"),
        modified: str("dcterms:modified"),
        category: str("cp:category"),
        contentStatus: str("cp:contentStatus"),
      };

      const hasAny = Object.values(result).some((v) => v !== undefined);
      return hasAny ? result : undefined;
    } catch (e) {
      console.warn("Failed to parse core properties:", e);
      return undefined;
    }
  }

  /**
   * Parse custom document properties from `docProps/custom.xml`.
   */
  protected async parseCustomProperties(): Promise<PptxCustomProperty[]> {
    const results: PptxCustomProperty[] = [];
    try {
      const customFile = this.zip.file("docProps/custom.xml");
      if (!customFile) return results;

      const xml = await customFile.async("string");
      const data = this.parser.parse(xml) as XmlObject;
      const properties = data?.["Properties"] as XmlObject | undefined;
      if (!properties) return results;

      const propEntries = this.ensureArray(
        properties["property"],
      ) as XmlObject[];
      for (const prop of propEntries) {
        const name = String(prop["@_name"] || "").trim();
        if (!name) continue;

        // VT types: vt:lpwstr, vt:i4, vt:bool, vt:filetime, vt:r8, etc.
        let value = "";
        let type = "unknown";
        const vtTypes = [
          "vt:lpwstr",
          "vt:i4",
          "vt:bool",
          "vt:filetime",
          "vt:r8",
          "vt:i2",
          "vt:ui4",
          "vt:lpstr",
        ];
        for (const vt of vtTypes) {
          if (prop[vt] !== undefined) {
            value = String(prop[vt]);
            type = vt.replace("vt:", "");
            break;
          }
        }

        results.push({ name, value, type });
      }
    } catch (e) {
      console.warn("Failed to parse custom properties:", e);
    }
    return results;
  }

  /**
   * Resolve a relative target path against the directory of a source part.
   */
  private resolvePartPath(sourcePart: string, relativeTarget: string): string {
    if (relativeTarget.startsWith("/")) return relativeTarget.substring(1);
    const dir = sourcePart.substring(0, sourcePart.lastIndexOf("/") + 1);
    return dir + relativeTarget;
  }

  /**
   * Parse `p:custDataLst` entries from a given XML container node and resolve
   * their relationship targets + data content from the ZIP.
   *
   * @param containerNode - The XML node that may contain `p:custDataLst`.
   * @param relsPath - Path to the `.rels` file for resolving relationship IDs.
   * @param partPath - The owning part path (used to resolve relative targets).
   */
  protected async parseCustDataLst(
    containerNode: XmlObject | undefined,
    relsPath: string,
    partPath: string,
  ): Promise<PptxCustomerData[]> {
    if (!containerNode) return [];
    const custDataLst = containerNode["p:custDataLst"] as
      | XmlObject
      | undefined;
    if (!custDataLst) return [];

    const custDataEntries = this.ensureArray(
      custDataLst["p:custData"],
    ) as XmlObject[];
    if (custDataEntries.length === 0) return [];

    // Load the relationships file to resolve r:id targets
    const relsFile = this.zip.file(relsPath);
    if (!relsFile) return [];

    const relsXml = await relsFile.async("string");
    const relsData = this.parser.parse(relsXml) as XmlObject;
    const relRoot = (relsData["Relationships"] || {}) as XmlObject;
    const relationships = this.ensureArray(
      relRoot["Relationship"],
    ) as XmlObject[];

    const relMap = new Map<string, string>();
    for (const rel of relationships) {
      const id = String(rel["@_Id"] || "").trim();
      const target = String(rel["@_Target"] || "").trim();
      if (id && target) relMap.set(id, target);
    }

    const results: PptxCustomerData[] = [];
    for (const entry of custDataEntries) {
      const relId = String(entry["@_r:id"] || "").trim();
      if (!relId) continue;

      const target = relMap.get(relId);
      if (!target) continue;

      const resolvedPath = this.resolvePartPath(partPath, target);

      let data: string | undefined;
      try {
        const file = this.zip.file(resolvedPath);
        if (file) {
          data = await file.async("string");
        }
      } catch {
        // Non-critical — data may not be resolvable
      }

      results.push({ id: resolvedPath, relId, data });
    }

    return results;
  }

  /**
   * Parse presentation-level customer data from `p:custDataLst` in
   * `presentation.xml`.
   */
  protected async parsePresentationCustomerData(): Promise<
    PptxCustomerData[]
  > {
    try {
      const presentation = this.presentationData?.["p:presentation"] as
        | XmlObject
        | undefined;
      return await this.parseCustDataLst(
        presentation,
        "ppt/_rels/presentation.xml.rels",
        "ppt/presentation.xml",
      );
    } catch (e) {
      console.warn("Failed to parse presentation customer data:", e);
      return [];
    }
  }

  /**
   * Parse slide-level customer data from `p:custDataLst` within `p:cSld`.
   */
  protected async parseSlideCustomerData(
    slideXml: XmlObject,
    slidePath: string,
  ): Promise<PptxCustomerData[]> {
    try {
      const sld = slideXml["p:sld"] as XmlObject | undefined;
      const cSld = sld?.["p:cSld"] as XmlObject | undefined;
      const relsPath =
        slidePath.replace("slides/", "slides/_rels/") + ".rels";
      return await this.parseCustDataLst(cSld, relsPath, slidePath);
    } catch (e) {
      console.warn(`Failed to parse slide customer data for ${slidePath}:`, e);
      return [];
    }
  }

  /**
   * Parse `p:controls > p:control` entries from a slide's `p:cSld`.
   */
  protected parseSlideActiveXControls(
    slideXml: XmlObject,
  ): PptxActiveXControl[] {
    try {
      const sld = slideXml["p:sld"] as XmlObject | undefined;
      const cSld = sld?.["p:cSld"] as XmlObject | undefined;
      if (!cSld) return [];

      const controls = cSld["p:controls"] as XmlObject | undefined;
      if (!controls) return [];

      const controlEntries = this.ensureArray(
        controls["p:control"],
      ) as XmlObject[];
      if (controlEntries.length === 0) return [];

      const results: PptxActiveXControl[] = [];
      for (const entry of controlEntries) {
        const relId = String(entry["@_r:id"] || "").trim();
        if (!relId) continue;

        const name = entry["@_name"]
          ? String(entry["@_name"]).trim()
          : undefined;
        const shapeId = entry["@_spid"]
          ? String(entry["@_spid"]).trim()
          : undefined;

        results.push({ relId, name, shapeId, rawXml: entry });
      }
      return results;
    } catch (e) {
      console.warn("Failed to parse slide ActiveX controls:", e);
      return [];
    }
  }

  /**
   * Parse all tag collections from `ppt/tags/tag*.xml`.
   */
  protected async parseTags(): Promise<PptxTagCollection[]> {
    const results: PptxTagCollection[] = [];
    try {
      const tagFiles = this.zip.file(/^ppt\/tags\/tag\d+\.xml$/);
      if (!tagFiles || tagFiles.length === 0) return results;

      for (const file of tagFiles) {
        const path = file.name;
        const xml = await file.async("string");
        const data = this.parser.parse(xml) as XmlObject;
        const tagLst = data?.["p:tagLst"] as XmlObject | undefined;
        if (!tagLst) continue;

        const tagEntries = this.ensureArray(tagLst["p:tag"]) as XmlObject[];
        const tags: PptxTag[] = tagEntries
          .map((tag) => ({
            name: String(tag["@_name"] || "").trim(),
            value: String(tag["@_val"] || "").trim(),
          }))
          .filter((t) => t.name.length > 0);

        if (tags.length > 0) {
          results.push({ path, tags });
        }
      }
    } catch (e) {
      console.warn("Failed to parse tags:", e);
    }
    return results;
  }
}
