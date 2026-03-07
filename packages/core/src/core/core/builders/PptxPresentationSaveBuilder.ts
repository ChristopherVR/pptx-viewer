import type { IPptxXmlLookupService } from "../../services";
import type {
  PptxCustomShow,
  PptxHeaderFooter,
  PptxPresentationProperties,
  PptxSection,
  XmlObject,
} from "../../types";

export interface PptxPresentationSaveBuilderOptions {
  headerFooter?: PptxHeaderFooter;
  presentationProperties?: PptxPresentationProperties;
  customShows?: PptxCustomShow[];
  sections?: PptxSection[];
}

export interface PptxPresentationSaveBuildInput {
  presentationData: XmlObject;
  options?: PptxPresentationSaveBuilderOptions;
  rawSlideWidthEmu: number;
  rawSlideHeightEmu: number;
  xmlLookupService: IPptxXmlLookupService;
}

export interface IPptxPresentationSaveBuilder {
  applySaveOptions(init: PptxPresentationSaveBuildInput): XmlObject;
}

export class PptxPresentationSaveBuilder implements IPptxPresentationSaveBuilder {
  public applySaveOptions(init: PptxPresentationSaveBuildInput): XmlObject {
    const presentation = init.presentationData["p:presentation"] as
      | XmlObject
      | undefined;
    if (!presentation) return init.presentationData;

    this.applyHeaderFooter(presentation, init.options?.headerFooter);
    this.applySlideDimensions(
      presentation,
      init.rawSlideWidthEmu,
      init.rawSlideHeightEmu,
    );
    this.applyCustomShows(presentation, init.options?.customShows);
    this.applySections(
      presentation,
      init.options?.sections,
      init.xmlLookupService,
    );

    init.presentationData["p:presentation"] = presentation;
    return init.presentationData;
  }

  private applyHeaderFooter(
    presentation: XmlObject,
    headerFooter: PptxHeaderFooter | undefined,
  ): void {
    if (!headerFooter) return;
    const hf: XmlObject = (presentation["p:hf"] as XmlObject) || {};
    if (headerFooter.hasHeader !== undefined) {
      hf["@_hdr"] = headerFooter.hasHeader ? "1" : "0";
    }
    if (headerFooter.hasFooter !== undefined) {
      hf["@_ftr"] = headerFooter.hasFooter ? "1" : "0";
    }
    if (headerFooter.hasDateTime !== undefined) {
      hf["@_dt"] = headerFooter.hasDateTime ? "1" : "0";
    }
    if (headerFooter.hasSlideNumber !== undefined) {
      hf["@_sldNum"] = headerFooter.hasSlideNumber ? "1" : "0";
    }
    if (headerFooter.footerText !== undefined) {
      hf["@_ftrText"] = headerFooter.footerText;
    }
    if (headerFooter.dateTimeText !== undefined) {
      hf["@_dtText"] = headerFooter.dateTimeText;
    }
    if (headerFooter.dateFormat !== undefined) {
      hf["@_dtFmt"] = headerFooter.dateFormat;
    }
    presentation["p:hf"] = hf;
  }

  private applySlideDimensions(
    presentation: XmlObject,
    rawSlideWidthEmu: number,
    rawSlideHeightEmu: number,
  ): void {
    const slideSize = presentation["p:sldSz"] as XmlObject | undefined;
    if (!slideSize) return;
    if (rawSlideWidthEmu <= 0 && rawSlideHeightEmu <= 0) return;

    if (rawSlideWidthEmu > 0) {
      slideSize["@_cx"] = String(rawSlideWidthEmu);
    }
    if (rawSlideHeightEmu > 0) {
      slideSize["@_cy"] = String(rawSlideHeightEmu);
    }

    // Preserve p:notesSz (already present in presentation XML from load)
    // No modification needed — we just ensure it stays in the tree.
  }

  private applyCustomShows(
    presentation: XmlObject,
    customShows: PptxCustomShow[] | undefined,
  ): void {
    if (!customShows || customShows.length === 0) return;
    presentation["p:custShowLst"] = {
      "p:custShow": customShows.map((customShow) => ({
        "@_name": customShow.name,
        "@_id": String(customShow.id),
        "p:sldLst": {
          "p:sld": customShow.slideRIds.map((rId) => ({
            "@_r:id": rId,
          })),
        },
      })),
    };
  }

  private applySections(
    presentation: XmlObject,
    sections: PptxSection[] | undefined,
    xmlLookupService: IPptxXmlLookupService,
  ): void {
    if (!sections || sections.length === 0) return;
    const sectionListXml = {
      "p14:section": sections.map((section) => {
        const sectionEntry: XmlObject = {
          "@_name": section.name,
          "@_id": section.id,
          "p14:sldIdLst": {
            "p14:sldId": section.slideIds.map((slideId) => ({
              "@_id": slideId,
            })),
          },
        };
        // Write back p15:sectionPr when collapsed or color is set
        if (section.collapsed || section.color) {
          const sectionPrAttrs: XmlObject = {};
          if (section.collapsed) {
            sectionPrAttrs["@_collapsed"] = "1";
          }
          if (section.color) {
            sectionPrAttrs["@_clr"] = section.color.replace("#", "");
          }
          sectionEntry["p15:sectionPr"] = sectionPrAttrs;
        }
        return sectionEntry;
      }),
    };

    let isSectionListPlaced = false;
    const extList = xmlLookupService.getChildByLocalName(
      presentation,
      "extLst",
    );
    if (extList) {
      const extEntries = xmlLookupService.getChildrenArrayByLocalName(
        extList,
        "ext",
      );
      for (const extEntry of extEntries) {
        if (!xmlLookupService.getChildByLocalName(extEntry, "sectionLst")) {
          continue;
        }
        for (const xmlKey of Object.keys(extEntry)) {
          if (xmlKey.split(":").pop() !== "sectionLst") continue;
          (extEntry as Record<string, unknown>)[xmlKey] = sectionListXml;
          isSectionListPlaced = true;
          break;
        }
        if (isSectionListPlaced) break;
      }
    }

    if (isSectionListPlaced) return;

    const directSectionKey = Object.keys(presentation).find(
      (xmlKey) => xmlKey.split(":").pop() === "sectionLst",
    );
    if (!directSectionKey) return;

    (presentation as Record<string, unknown>)[directSectionKey] =
      sectionListXml;
  }
}
