import {
  XmlObject,
  PptxElement,
  type SmartArtPptxElement,
  type PptxNotesMaster,
  type PptxHandoutMaster,
  type PptxTagCollection,
} from "../../types";
import { type PptxSaveFormat } from "../types";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeSaveDataSerialization";
import {
  buildSmartArtPointXml,
  buildSmartArtConnectionXml,
} from "./smartart-xml-builders";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  /** Pending SmartArt data updates to process during save. */
  protected pendingSmartArtUpdates?: Array<{
    element: SmartArtPptxElement;
    slidePath: string;
  }>;

  /**
   * Collect SmartArt data for deferred async processing during save.
   */
  protected serializeSmartArtDataToXml(
    element: SmartArtPptxElement,
    slidePath: string,
  ): void {
    if (!element.smartArtData?.dataRelId) return;
    if (!this.pendingSmartArtUpdates) {
      this.pendingSmartArtUpdates = [];
    }
    this.pendingSmartArtUpdates.push({ element, slidePath });
  }

  /**
   * Process all pending SmartArt data updates by writing modified
   * `dgm:dataModel` back to the diagram data XML parts.
   */
  protected async processPendingSmartArtUpdates(): Promise<void> {
    if (
      !this.pendingSmartArtUpdates ||
      this.pendingSmartArtUpdates.length === 0
    ) {
      return;
    }

    for (const { element } of this.pendingSmartArtUpdates) {
      const smartArtData = element.smartArtData;
      if (!smartArtData?.dataRelId) continue;

      // Resolve the diagram data part path from the slide relationships
      const slidePath = element.rawXml
        ? this.findSlidePathForElement(element)
        : undefined;
      if (!slidePath) continue;

      const relationships = this.slideRelsMap.get(slidePath);
      const dataTarget = relationships?.get(smartArtData.dataRelId);
      if (!dataTarget) continue;

      const dataPartPath = this.resolveImagePath(slidePath, dataTarget);
      const existingXml = await this.zip.file(dataPartPath)?.async("string");
      if (!existingXml) continue;

      try {
        const parsed = this.parser.parse(existingXml) as XmlObject;
        const dataModel = this.xmlLookupService.getChildByLocalName(
          parsed,
          "dataModel",
        );
        if (!dataModel) continue;

        // Rebuild dgm:ptLst from the node data
        const ptListKey = Object.keys(dataModel).find(
          (k) => this.compatibilityService.getXmlLocalName(k) === "ptLst",
        );
        if (ptListKey) {
          const ptList = dataModel[ptListKey] as XmlObject;
          const ptKey = Object.keys(ptList || {}).find(
            (k) => this.compatibilityService.getXmlLocalName(k) === "pt",
          );
          if (ptKey) {
            ptList[ptKey] = buildSmartArtPointXml(smartArtData.nodes);
          }
        }

        // Rebuild dgm:cxnLst from the connection data
        if (smartArtData.connections && smartArtData.connections.length > 0) {
          const cxnListKey = Object.keys(dataModel).find(
            (k) => this.compatibilityService.getXmlLocalName(k) === "cxnLst",
          );
          if (cxnListKey) {
            const cxnList = dataModel[cxnListKey] as XmlObject;
            const cxnKey = Object.keys(cxnList || {}).find(
              (k) => this.compatibilityService.getXmlLocalName(k) === "cxn",
            );
            if (cxnKey) {
              cxnList[cxnKey] = buildSmartArtConnectionXml(
                smartArtData.connections,
              );
            }
          }
        }

        this.zip.file(dataPartPath, this.builder.build(parsed));
      } catch (e) {
        console.warn(`Failed to save SmartArt data at ${dataPartPath}:`, e);
      }
    }

    this.pendingSmartArtUpdates = undefined;
  }

  /**
   * Find the slide path for an element by scanning the slideMap.
   */
  protected findSlidePathForElement(_element: PptxElement): string | undefined {
    // The element's slide path can be found by looking at the slideRelsMap entries
    for (const [slidePath] of this.slideRelsMap) {
      if (this.slideMap.has(slidePath)) {
        return slidePath;
      }
    }
    return this.orderedSlidePaths[0];
  }

  /**
   * Apply notes master background colour changes to `notesMaster1.xml`.
   */
  protected async applyNotesMasterChanges(
    notesMaster: PptxNotesMaster | undefined,
  ): Promise<void> {
    if (!notesMaster) return;
    const file = this.zip.file(notesMaster.path);
    if (!file) return;

    try {
      const xml = await file.async("string");
      const data = this.parser.parse(xml) as XmlObject;
      const root = data?.["p:notesMaster"] as XmlObject | undefined;
      if (!root) return;

      const cSld = (root["p:cSld"] || {}) as XmlObject;

      // Update background colour
      if (notesMaster.backgroundColor) {
        const hex = notesMaster.backgroundColor.replace("#", "");
        cSld["p:bg"] = {
          "p:bgPr": {
            "a:solidFill": { "a:srgbClr": { "@_val": hex } },
            "a:effectLst": {},
          },
        };
      }

      root["p:cSld"] = cSld;
      data["p:notesMaster"] = root;
      this.zip.file(notesMaster.path, this.builder.build(data));
    } catch (e) {
      console.warn("Failed to save notes master changes:", e);
    }
  }

  /**
   * Apply handout master background colour and slides-per-page changes
   * to `handoutMaster1.xml`.
   */
  protected async applyHandoutMasterChanges(
    handoutMaster: PptxHandoutMaster | undefined,
  ): Promise<void> {
    if (!handoutMaster) return;
    const file = this.zip.file(handoutMaster.path);
    if (!file) return;

    try {
      const xml = await file.async("string");
      const data = this.parser.parse(xml) as XmlObject;
      const root = data?.["p:handoutMaster"] as XmlObject | undefined;
      if (!root) return;

      const cSld = (root["p:cSld"] || {}) as XmlObject;

      // Update background colour
      if (handoutMaster.backgroundColor) {
        const hex = handoutMaster.backgroundColor.replace("#", "");
        cSld["p:bg"] = {
          "p:bgPr": {
            "a:solidFill": { "a:srgbClr": { "@_val": hex } },
            "a:effectLst": {},
          },
        };
      }

      root["p:cSld"] = cSld;
      data["p:handoutMaster"] = root;
      this.zip.file(handoutMaster.path, this.builder.build(data));
    } catch (e) {
      console.warn("Failed to save handout master changes:", e);
    }
  }

  /**
   * Persist tag collection changes back to `ppt/tags/tag*.xml`.
   */
  protected async applyTagCollectionChanges(
    tags: PptxTagCollection[] | undefined,
  ): Promise<void> {
    if (!tags || tags.length === 0) return;

    for (const collection of tags) {
      if (!collection.path || collection.tags.length === 0) continue;
      try {
        const tagElements = collection.tags.map((tag) => ({
          "@_name": tag.name,
          "@_val": tag.value,
        }));
        const xml: XmlObject = {
          "p:tagLst": {
            "@_xmlns:a":
              "http://schemas.openxmlformats.org/drawingml/2006/main",
            "@_xmlns:p":
              "http://schemas.openxmlformats.org/presentationml/2006/main",
            "@_xmlns:r":
              "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
            "p:tag": tagElements,
          },
        };
        this.zip.file(collection.path, this.builder.build(xml));
      } catch (e) {
        console.warn(`Failed to save tag collection at ${collection.path}:`, e);
      }
    }
  }

  /**
   * Preserve VBA macro project binary for .pptm round-trip.
   */
  protected async applyVbaProjectPreservation(): Promise<void> {
    if (!this.vbaProjectBin) return;

    // Write the raw VBA project binary back
    this.zip.file("ppt/vbaProject.bin", this.vbaProjectBin);

    // Write any additional VBA-related parts (vbaData.xml, etc.)
    for (const [partPath, partData] of this.vbaRelatedParts) {
      this.zip.file(partPath, partData);
    }
  }

  /**
   * Rewrite `[Content_Types].xml` and presentation relationships
   * to match the chosen output format (PPSX / PPTM).
   */
  protected async applyOutputFormatOverrides(
    format: PptxSaveFormat,
  ): Promise<void> {
    if (format === "pptx") return;

    const hasVba = this.vbaProjectBin !== null;

    // Update [Content_Types].xml with format-specific overrides
    const ctXml = await this.zip.file("[Content_Types].xml")?.async("string");
    if (ctXml) {
      const ctData = this.parser.parse(ctXml) as XmlObject;
      this.contentTypesBuilder.applyOutputFormatOverride(
        ctData,
        format,
        hasVba,
      );
      this.zip.file("[Content_Types].xml", this.builder.build(ctData));
    }

    // For PPTM, ensure the VBA relationship exists in presentation.xml.rels
    if (format === "pptm" && hasVba) {
      await this.ensureVbaRelationship();
    }
  }

  /**
   * Ensure `ppt/_rels/presentation.xml.rels` contains a relationship
   * entry for `vbaProject.bin` (required for macro-enabled output).
   */
  protected async ensureVbaRelationship(): Promise<void> {
    const relsPath = "ppt/_rels/presentation.xml.rels";
    const relsXml = await this.zip.file(relsPath)?.async("string");
    if (!relsXml) return;

    const relsData = this.parser.parse(relsXml) as XmlObject;
    const relsRoot = (relsData?.Relationships ?? {}) as XmlObject;
    const relationships = this.ensureArray(
      relsRoot.Relationship,
    ) as XmlObject[];

    const vbaRelType =
      "http://schemas.microsoft.com/office/2006/relationships/vbaProject";
    const hasVbaRel = relationships.some(
      (rel) => String(rel?.["@_Type"] || "") === vbaRelType,
    );
    if (hasVbaRel) return;

    // Compute a unique rId
    let maxId = 0;
    for (const rel of relationships) {
      const id = String(rel?.["@_Id"] || "");
      const num = parseInt(id.replace(/^rId/, ""), 10);
      if (Number.isFinite(num) && num > maxId) maxId = num;
    }

    relationships.push({
      "@_Id": `rId${maxId + 1}`,
      "@_Type": vbaRelType,
      "@_Target": "vbaProject.bin",
    });

    relsRoot.Relationship = relationships;
    relsData.Relationships = relsRoot;
    this.zip.file(relsPath, this.builder.build(relsData));
  }
}
