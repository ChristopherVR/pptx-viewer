import {
  XmlObject,
  type PptxElementAnimation,
  type PptxSlideTransition,
  type PptxSection,
  PptxHeaderFooter,
} from "../../types";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeChartParsing";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  protected parseEditorAnimations(
    slideXml: XmlObject | undefined,
  ): PptxElementAnimation[] | undefined {
    return this.editorAnimationService.parseEditorAnimations(slideXml);
  }

  protected parseSlideTransition(
    slideXml: XmlObject | undefined,
    slidePath?: string,
  ): PptxSlideTransition | undefined {
    const parsedTransition =
      this.slideTransitionService.parseSlideTransition(slideXml);
    if (!parsedTransition || !slidePath) return parsedTransition;

    const soundAction = parsedTransition.rawSoundAction;
    const startSound = soundAction?.["p:stSnd"] as XmlObject | undefined;
    const soundRId = String(
      startSound?.["@_r:embed"] || startSound?.["@_r:link"] || "",
    ).trim();
    if (soundRId.length === 0) {
      return parsedTransition;
    }

    parsedTransition.soundRId = soundRId;
    const slideRelationships = this.slideRelsMap.get(slidePath);
    const soundTarget = slideRelationships?.get(soundRId);
    if (soundTarget) {
      const soundPath = this.resolveImagePath(slidePath, soundTarget);
      parsedTransition.soundPath = soundPath;
      parsedTransition.soundFileName = soundPath.split("/").pop() || soundPath;
    }

    return parsedTransition;
  }

  protected extractSectionMap(): {
    sectionBySlideId: Map<string, { sectionId: string; sectionName: string }>;
    orderedSections: PptxSection[];
  } {
    const sectionBySlideId = new Map<
      string,
      { sectionId: string; sectionName: string }
    >();
    const orderedSections: PptxSection[] = [];
    const presentation = this.presentationData?.["p:presentation"] as
      | XmlObject
      | undefined;
    // Look for p:sectionLst as direct child first, then inside p:extLst (p14 namespace)
    let sectionList = this.xmlLookupService.getChildByLocalName(
      presentation,
      "sectionLst",
    ) as XmlObject | undefined;

    if (!sectionList) {
      // In standard OOXML, sections may be inside p:extLst as a p14:sectionLst extension
      const presExtLst = this.xmlLookupService.getChildByLocalName(
        presentation,
        "extLst",
      );
      if (presExtLst) {
        const extEntries = this.xmlLookupService.getChildrenArrayByLocalName(
          presExtLst,
          "ext",
        );
        for (const ext of extEntries) {
          if (!ext) continue;
          const candidate = this.xmlLookupService.getChildByLocalName(
            ext,
            "sectionLst",
          );
          if (candidate) {
            sectionList = candidate;
            break;
          }
        }
      }
    }

    const sections = this.ensureArray(
      sectionList
        ? this.xmlLookupService.getChildrenArrayByLocalName(
            sectionList,
            "section",
          )
        : [],
    ) as XmlObject[];

    sections.forEach((section, index) => {
      const sectionId = String(section?.["@_id"] || `section-${index + 1}`);
      const sectionNameRaw = String(section?.["@_name"] || "").trim();
      const sectionName =
        sectionNameRaw.length > 0 ? sectionNameRaw : `Section ${index + 1}`;
      const sldIdLst = this.xmlLookupService.getChildByLocalName(
        section,
        "sldIdLst",
      );
      const sectionSlideEntries = sldIdLst
        ? this.xmlLookupService.getChildrenArrayByLocalName(sldIdLst, "sldId")
        : [];

      const slideIds: string[] = [];
      sectionSlideEntries.forEach((slideEntry: XmlObject | undefined) => {
        const slideId = String(slideEntry?.["@_id"] || "").trim();
        if (slideId.length === 0) return;
        slideIds.push(slideId);
        sectionBySlideId.set(slideId, {
          sectionId,
          sectionName,
        });
      });

      // Parse p15:sectionPr — per-section properties (collapsed, color)
      const sectionPr = this.xmlLookupService.getChildByLocalName(
        section,
        "sectionPr",
      );
      let sectionCollapsed: boolean | undefined;
      let sectionColor: string | undefined;
      if (sectionPr) {
        const collapsedRaw = String(sectionPr["@_collapsed"] ?? "")
          .trim()
          .toLowerCase();
        if (collapsedRaw === "1" || collapsedRaw === "true") {
          sectionCollapsed = true;
        }
        const clrRaw = String(sectionPr["@_clr"] ?? "").trim();
        if (clrRaw.length > 0) {
          sectionColor = clrRaw.startsWith("#") ? clrRaw : `#${clrRaw}`;
        }
      }

      orderedSections.push({
        id: sectionId,
        name: sectionName,
        slideIds,
        collapsed: sectionCollapsed,
        color: sectionColor,
      });
    });

    return { sectionBySlideId, orderedSections };
  }

  /**
   * Extract header/footer settings from the presentation XML.
   * OOXML stores these as p:hf on the slide master or as properties on
   * p:presentation > p:defaultTextStyle's parent, or on each slide.
   * We look for the `p:hf` element in the presentation XML.
   */
  protected extractHeaderFooter(): PptxHeaderFooter | undefined {
    const pres = this.presentationData?.["p:presentation"] as
      | XmlObject
      | undefined;
    if (!pres) return undefined;

    // Check for p:hf (header-footer) in the presentation or slides
    const hf = pres["p:hf"] as XmlObject | undefined;
    if (!hf) return undefined;

    const result: PptxHeaderFooter = {};

    // @_hdr: show header (boolean as "0"/"1")
    if (hf["@_hdr"] !== undefined) {
      result.hasHeader = String(hf["@_hdr"]) !== "0";
    }
    // @_ftr: show footer
    if (hf["@_ftr"] !== undefined) {
      result.hasFooter = String(hf["@_ftr"]) !== "0";
    }
    // @_dt: show date/time
    if (hf["@_dt"] !== undefined) {
      result.hasDateTime = String(hf["@_dt"]) !== "0";
    }
    // @_sldNum: show slide number
    if (hf["@_sldNum"] !== undefined) {
      result.hasSlideNumber = String(hf["@_sldNum"]) !== "0";
    }

    // Attempt to read footer text from presProps or viewPr
    const footerText = hf["@_ftrText"] as string | undefined;
    if (footerText) {
      result.footerText = String(footerText);
    }

    const dtText = hf["@_dtText"] as string | undefined;
    if (dtText) {
      result.dateTimeText = String(dtText);
    }

    // Date format pattern (e.g. "M/d/yyyy")
    const dtFmt = hf["@_dtFmt"] as string | undefined;
    if (dtFmt) {
      result.dateFormat = String(dtFmt);
      result.dateTimeAuto = true;
    }

    return result;
  }
}
