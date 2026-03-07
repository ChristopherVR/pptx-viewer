import { XmlObject, PptxSlide, type MediaPptxElement } from "../../types";
import {
  PptxSlideRelationshipRegistry,
  PptxShapeIdValidator,
  type PptxSaveState,
  type IPptxSlideRelationshipRegistry,
} from "../builders";
import { type PptxSaveConstants } from "../factories";
import { buildClrMapOverrideXml } from "../../utils/theme-override-utils";

const shapeIdValidator = new PptxShapeIdValidator();

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeSaveElementWriter";
import type {
  SlideShapeCollectors,
  SaveSlideContext,
} from "./PptxHandlerRuntimeSaveElementWriter";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  /**
   * Process a single slide during save: update slide XML, process elements,
   * rebuild shape tree, and persist relationships.
   */
  protected async processSlideForSave(
    slide: PptxSlide,
    saveSession: PptxSaveState,
    constants: PptxSaveConstants,
  ): Promise<void> {
    // Skip re-serialization of unmodified slides to prevent spurious diffs
    if (slide.isDirty === false) return;

    const xmlObj = this.slideMap.get(slide.id);
    if (!xmlObj) return;

    const slideNode = (xmlObj["p:sld"] || {}) as XmlObject;
    if (slide.hidden) {
      slideNode["@_show"] = "0";
    } else {
      delete slideNode["@_show"];
    }
    slideNode["p:clrMapOvr"] = buildClrMapOverrideXml(slide.clrMapOverride);

    if (slide.transition !== undefined) {
      const transitionNode = this.buildSlideTransitionXml(slide.transition);
      if (transitionNode) {
        slideNode["p:transition"] = transitionNode;
      } else {
        delete slideNode["p:transition"];
      }
    }
    if (slide.animations !== undefined) {
      this.applyEditorAnimations(slideNode, slide.animations);
    }
    if (slide.animations && slide.animations.length > 0) {
      // When rawTiming exists, surgical update preserves complex structures
      const generatedTiming = this.animationWriteService.buildTimingXml(
        slide.animations,
        slide.rawTiming,
      );
      if (generatedTiming) {
        this.applyMediaTimingToRawTiming(generatedTiming, slide.elements);
        slideNode["p:timing"] = generatedTiming;
      } else if (slide.rawTiming) {
        this.applyMediaTimingToRawTiming(slide.rawTiming, slide.elements);
        slideNode["p:timing"] = slide.rawTiming;
      }
    } else if (slide.rawTiming) {
      this.applyMediaTimingToRawTiming(slide.rawTiming, slide.elements);
      slideNode["p:timing"] = slide.rawTiming;
    }
    xmlObj["p:sld"] = slideNode;

    const spTree = this.ensureSlideTree(xmlObj);
    const slideRelsPath = this.toSlideRelsPath(slide.id);
    const slideRelsXml = await this.zip.file(slideRelsPath)?.async("string");
    const slideRelsData: XmlObject = slideRelsXml
      ? this.parser.parse(slideRelsXml)
      : {
          Relationships: {
            "@_xmlns": constants.relationshipsNamespace,
            Relationship: [],
          },
        };
    const slideRelsRoot = (slideRelsData["Relationships"] || {}) as XmlObject;
    if (!slideRelsRoot["@_xmlns"]) {
      slideRelsRoot["@_xmlns"] = constants.relationshipsNamespace;
    }
    const slideRelationships = this.ensureArray(
      slideRelsRoot["Relationship"],
    ) as XmlObject[];
    const slideRelationshipRegistry: IPptxSlideRelationshipRegistry =
      new PptxSlideRelationshipRegistry({
        relationships: slideRelationships,
      });
    const existingCommentRelationship =
      slideRelationshipRegistry.removeCommentRelationships(
        constants.slideCommentRelationshipType,
      );

    this.slideBackgroundBuilder.applyBackground({
      slideNode,
      slide,
      zip: this.zip,
      saveState: saveSession,
      relationshipRegistry: slideRelationshipRegistry,
      slideImageRelationshipType: constants.slideImageRelationshipType,
      parseDataUrlToBytes: (dataUrl) => this.parseDataUrlToBytes(dataUrl),
    });

    this.slideCommentPartWriter.writeComments({
      slide,
      saveState: saveSession,
      existingCommentRelationship: existingCommentRelationship,
      relationshipRegistry: slideRelationshipRegistry,
      slideCommentRelationshipType: constants.slideCommentRelationshipType,
      zip: this.zip,
      xmlBuilder: this.builder,
      slideCommentsXmlFactory: this.slideCommentsXmlFactory,
      resolvePartPath: (slidePath, relationshipTarget) =>
        this.resolveImagePath(slidePath, relationshipTarget),
    });

    await this.slideNotesPartUpdater.updateNotesPart({
      slide,
      relationshipRegistry: slideRelationshipRegistry,
      slideNotesRelationshipType: constants.slideNotesRelationshipType,
      zip: this.zip,
      parser: this.parser,
      xmlBuilder: this.builder,
      resolvePartPath: (slidePath, relationshipTarget) =>
        this.resolveImagePath(slidePath, relationshipTarget),
      updateNotesXmlText: (notesXmlObject, notesText, notesSegments) =>
        this.updateNotesXmlText(notesXmlObject, notesText, notesSegments),
      compatibilityReporter: this.compatibilityService,
    });

    // Pre-resolve non-data-URL media sources
    const resolvedMediaBytes = new Map<
      string,
      { bytes: Uint8Array; extension: string }
    >();
    for (const el of slide.elements) {
      if (el.type !== "media") continue;
      const mediaElement = el as MediaPptxElement;
      if (
        typeof mediaElement.mediaData === "string" &&
        !mediaElement.mediaData.startsWith("data:")
      ) {
        try {
          const resolved = await this.resolveMediaToBytes(
            mediaElement.mediaData,
          );
          if (resolved) {
            resolvedMediaBytes.set(mediaElement.id, resolved);
          }
        } catch {
          console.warn(
            `[pptx-save] Failed to resolve media URL for element ${mediaElement.id}`,
          );
        }
      }
    }

    const collectors: SlideShapeCollectors = {
      shapes: [],
      pics: [],
      connectors: [],
      graphicFrames: [],
      groups: [],
    };

    const ctx: SaveSlideContext = {
      slide,
      slideRelationships,
      slideRelationshipRegistry,
      resolveHyperlinkRelationshipId: (target: string) =>
        slideRelationshipRegistry.resolveHyperlinkRelationshipId(target),
      getSlideRelationshipMap: () =>
        slideRelationshipRegistry.toRelationshipMap(),
      resolvedMediaBytes,
      saveSession,
      slideImageRelationshipType: constants.slideImageRelationshipType,
      slideMediaRelationshipType: constants.slideMediaRelationshipType,
      slideVideoRelationshipType: constants.slideVideoRelationshipType,
      slideAudioRelationshipType: constants.slideAudioRelationshipType,
    };

    slide.elements.forEach((el) => {
      this.processSlideElement(el, collectors, ctx);
    });

    // Assign lists back to spTree
    spTree["p:sp"] = collectors.shapes;
    spTree["p:pic"] = collectors.pics;
    spTree["p:cxnSp"] = collectors.connectors;
    spTree["p:graphicFrame"] = collectors.graphicFrames;
    if (collectors.groups.length > 0) {
      spTree["p:grpSp"] = collectors.groups;
    } else {
      delete spTree["p:grpSp"];
    }

    // Validate and deduplicate shape IDs to prevent MS Office corruption
    const reassigned = shapeIdValidator.validateAndDeduplicateIds(
      spTree,
      (v) => this.ensureArray(v),
    );
    if (reassigned > 0) {
      this.compatibilityService.reportWarning({
        code: "SHAPE_ID_DEDUPLICATED",
        message: `Reassigned ${reassigned} duplicate shape ID(s) on slide '${slide.id}'.`,
        scope: "save",
        slideId: slide.id,
      });
    }

    slideRelsRoot["Relationship"] = slideRelationships;
    slideRelsData["Relationships"] = slideRelsRoot;
    this.zip.file(slideRelsPath, this.builder.build(slideRelsData));

    this.applySlideDrawingGuides(slideNode, slide);
    this.deduplicateExtensionLists(xmlObj);
    this.zip.file(slide.id, this.builder.build(xmlObj));
  }
}
