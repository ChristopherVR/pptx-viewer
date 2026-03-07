import type { XMLBuilder, XMLParser } from "fast-xml-parser";
import type JSZip from "jszip";

import type { CompatibilityWarningInput } from "../../services";
import type { PptxSlide, XmlObject } from "../../types";
import type { IPptxSlideRelationshipRegistry } from "./PptxSlideRelationshipRegistry";

export interface PptxSlideNotesPartUpdaterInput {
  slide: PptxSlide;
  relationshipRegistry: IPptxSlideRelationshipRegistry;
  slideNotesRelationshipType: string;
  zip: JSZip;
  parser: XMLParser;
  xmlBuilder: XMLBuilder;
  resolvePartPath: (slidePath: string, relationshipTarget: string) => string;
  updateNotesXmlText: (
    notesXmlObject: XmlObject,
    notesText: string,
    notesSegments?: PptxSlide["notesSegments"],
  ) => boolean;
  compatibilityReporter: {
    reportWarning: (warning: CompatibilityWarningInput) => void;
  };
}

export interface IPptxSlideNotesPartUpdater {
  updateNotesPart(init: PptxSlideNotesPartUpdaterInput): Promise<void>;
}

export class PptxSlideNotesPartUpdater implements IPptxSlideNotesPartUpdater {
  public async updateNotesPart(
    init: PptxSlideNotesPartUpdaterInput,
  ): Promise<void> {
    if (
      init.slide.notes === undefined &&
      (!init.slide.notesSegments || init.slide.notesSegments.length === 0)
    ) {
      return;
    }

    const notesRelationship =
      init.relationshipRegistry.findFirstByTypeOrTargetIncludes(
        init.slideNotesRelationshipType,
        "notesslide",
      );
    if (!notesRelationship) {
      this.reportMissingNotesRelationship(init);
      return;
    }

    const notesTarget = String(notesRelationship["@_Target"] || "").trim();
    if (notesTarget.length === 0) return;

    const notesPath = init.resolvePartPath(init.slide.id, notesTarget);
    const notesXml = await init.zip.file(notesPath)?.async("string");
    if (!notesXml) {
      this.reportMissingNotesPart(init, notesPath);
      return;
    }

    const notesXmlObject = init.parser.parse(notesXml) as XmlObject;
    const didUpdate = init.updateNotesXmlText(
      notesXmlObject,
      init.slide.notes ?? "",
      init.slide.notesSegments,
    );
    if (!didUpdate) {
      this.reportSkippedNotesUpdate(init);
      return;
    }

    init.zip.file(notesPath, init.xmlBuilder.build(notesXmlObject));
  }

  private reportMissingNotesRelationship(
    init: PptxSlideNotesPartUpdaterInput,
  ): void {
    init.compatibilityReporter.reportWarning({
      code: "SAVE_NOTES_RELATIONSHIP_MISSING",
      message:
        "Slide notes were edited, but the slide has no notes relationship. Notes update was skipped.",
      scope: "save",
      slideId: init.slide.id,
    });
  }

  private reportMissingNotesPart(
    init: PptxSlideNotesPartUpdaterInput,
    notesPath: string,
  ): void {
    init.compatibilityReporter.reportWarning({
      code: "SAVE_NOTES_PART_MISSING",
      message:
        "Speaker notes relationship exists but the notes part is missing. Notes update was skipped.",
      scope: "save",
      slideId: init.slide.id,
      xmlPath: notesPath,
    });
  }

  private reportSkippedNotesUpdate(init: PptxSlideNotesPartUpdaterInput): void {
    init.compatibilityReporter.reportWarning({
      code: "SAVE_NOTES_UPDATE_SKIPPED",
      message:
        "Speaker notes were present but no editable notes body was found. Notes were left unchanged.",
      scope: "save",
      slideId: init.slide.id,
    });
  }
}
