import type { XMLBuilder, XMLParser } from "fast-xml-parser";
import type JSZip from "jszip";

import type { PptxSlide, XmlObject } from "../../types";
import type { PptxSaveState } from "./PptxSaveSessionBuilder";

export interface PptxPresentationSlidesReconcilerInput {
  slides: PptxSlide[];
  saveSession: PptxSaveState;
  slideRelationshipType: string;
  slideLayoutRelationshipType: string;
  relationshipsNamespace: string;
  zip: JSZip;
  parser: XMLParser;
  xmlBuilder: XMLBuilder;
  presentationData: XmlObject | null;
  slideMap: Map<string, XmlObject>;
  slideRelsMap: Map<string, Map<string, string>>;
  toPresentationTarget: (slidePath: string) => string;
  toSlidePathFromTarget: (target: string) => string;
  toSlideRelsPath: (slidePath: string) => string;
  createEmptySlideXml: () => XmlObject;
  deepCloneXml: (value: XmlObject | undefined) => XmlObject | undefined;
  findSourceSlidePath: (
    sourceSlideId: string | undefined,
  ) => string | undefined;
  loadSlideRelationships: (
    slidePath: string,
    slideRelsPath: string,
  ) => Promise<void>;
}

export interface IPptxPresentationSlidesReconciler {
  reconcile(input: PptxPresentationSlidesReconcilerInput): Promise<void>;
}

export class PptxPresentationSlidesReconciler implements IPptxPresentationSlidesReconciler {
  public async reconcile(
    input: PptxPresentationSlidesReconcilerInput,
  ): Promise<void> {
    const presentationRelsXml = await input.zip
      .file("ppt/_rels/presentation.xml.rels")
      ?.async("string");
    const presentationRelsData: XmlObject = presentationRelsXml
      ? input.parser.parse(presentationRelsXml)
      : {
          Relationships: {
            "@_xmlns": input.relationshipsNamespace,
            Relationship: [],
          },
        };
    const relRoot = (presentationRelsData["Relationships"] || {}) as XmlObject;
    if (!relRoot["@_xmlns"]) {
      relRoot["@_xmlns"] = input.relationshipsNamespace;
    }

    const existingRelationships = this.ensureArray(
      relRoot["Relationship"],
    ) as XmlObject[];
    const usedRIds = new Set<string>();
    const staticRelationships: XmlObject[] = [];
    const slideTargetByRid = new Map<string, string>();

    for (const relationship of existingRelationships) {
      const relationshipId = relationship?.["@_Id"];
      const relationshipTarget = relationship?.["@_Target"];
      const relationshipType = relationship?.["@_Type"];

      if (typeof relationshipId === "string" && relationshipId.length > 0) {
        usedRIds.add(relationshipId);
      }

      if (
        relationshipType === input.slideRelationshipType &&
        typeof relationshipId === "string" &&
        typeof relationshipTarget === "string"
      ) {
        slideTargetByRid.set(relationshipId, relationshipTarget);
        continue;
      }

      staticRelationships.push(relationship);
    }

    const nextRelationshipId = (): string => {
      let index = 1;
      while (usedRIds.has(`rId${index}`)) index += 1;
      const relationshipId = `rId${index}`;
      usedRIds.add(relationshipId);
      return relationshipId;
    };

    const presentation = input.presentationData?.["p:presentation"]
      ? (input.presentationData["p:presentation"] as XmlObject)
      : null;
    const slideIdList = presentation
      ? (presentation["p:sldIdLst"] as XmlObject) || {}
      : null;
    const existingSlideIds = slideIdList
      ? (this.ensureArray(slideIdList["p:sldId"]) as XmlObject[])
      : [];
    const slideIdByRid = new Map<string, XmlObject>();
    let maxNumericSlideId = 255;

    for (const slideIdEntry of existingSlideIds) {
      const relationshipId = slideIdEntry?.["@_r:id"];
      if (typeof relationshipId === "string" && relationshipId.length > 0) {
        slideIdByRid.set(relationshipId, slideIdEntry);
      }

      const numericSlideId = Number.parseInt(
        String(slideIdEntry?.["@_id"] ?? ""),
        10,
      );
      if (Number.isFinite(numericSlideId)) {
        maxNumericSlideId = Math.max(maxNumericSlideId, numericSlideId);
      }
    }

    for (let index = 0; index < input.slides.length; index++) {
      const slide = input.slides[index];
      slide.slideNumber = index + 1;

      const existingSlideXml = input.slideMap.get(slide.id);
      if (existingSlideXml) {
        if (
          !slide.rId ||
          slide.rId.length === 0 ||
          !slideTargetByRid.has(slide.rId)
        ) {
          slide.rId = nextRelationshipId();
        } else {
          usedRIds.add(slide.rId);
        }
        slideTargetByRid.set(slide.rId, input.toPresentationTarget(slide.id));
        continue;
      }

      await this.attachNewSlide({
        input,
        slide,
        usedRIds,
        slideTargetByRid,
        nextRelationshipId,
      });
    }

    this.removeInactiveSlides({
      input,
      activeSlidePaths: new Set(input.slides.map((slide) => slide.id)),
      slideTargetByRid,
    });

    relRoot["Relationship"] = [
      ...staticRelationships,
      ...input.slides.map((slide) => ({
        "@_Id": slide.rId,
        "@_Type": input.slideRelationshipType,
        "@_Target": input.toPresentationTarget(slide.id),
      })),
    ];
    presentationRelsData["Relationships"] = relRoot;
    input.zip.file(
      "ppt/_rels/presentation.xml.rels",
      input.xmlBuilder.build(presentationRelsData),
    );

    if (presentation && slideIdList && input.presentationData) {
      slideIdList["p:sldId"] = input.slides.map((slide) => {
        const existing = slideIdByRid.get(slide.rId);
        if (existing) return existing;

        maxNumericSlideId += 1;
        return {
          "@_id": String(maxNumericSlideId),
          "@_r:id": slide.rId,
        };
      });
      presentation["p:sldIdLst"] = slideIdList;
      input.presentationData["p:presentation"] = presentation;
    }
  }

  private async attachNewSlide(init: {
    input: PptxPresentationSlidesReconcilerInput;
    slide: PptxSlide;
    usedRIds: Set<string>;
    slideTargetByRid: Map<string, string>;
    nextRelationshipId: () => string;
  }): Promise<void> {
    const sourceSlidePath = init.input.findSourceSlidePath(
      init.slide.sourceSlideId,
    );
    const sourceSlideXml = sourceSlidePath
      ? init.input.deepCloneXml(init.input.slideMap.get(sourceSlidePath))
      : undefined;

    const newSlidePath = `ppt/slides/slide${init.input.saveSession.nextSlideNumber()}.xml`;
    const newSlideRid =
      !init.slide.rId ||
      init.slide.rId.length === 0 ||
      init.usedRIds.has(init.slide.rId)
        ? init.nextRelationshipId()
        : init.slide.rId;
    init.usedRIds.add(newSlideRid);

    const newSlideXml =
      init.input.deepCloneXml(init.slide.rawXml) ||
      sourceSlideXml ||
      init.input.createEmptySlideXml();
    init.input.slideMap.set(newSlidePath, newSlideXml);

    init.slide.id = newSlidePath;
    init.slide.rId = newSlideRid;
    init.slide.rawXml = newSlideXml;

    const newSlideRelsPath = init.input.toSlideRelsPath(newSlidePath);
    const relationshipsCopied = await this.tryCopySourceRelationships({
      input: init.input,
      sourceSlidePath,
      newSlidePath,
      newSlideRelsPath,
    });
    if (!relationshipsCopied) {
      const fallbackRels = {
        Relationships: {
          "@_xmlns": init.input.relationshipsNamespace,
          Relationship: [
            {
              "@_Id": "rId1",
              "@_Type": init.input.slideLayoutRelationshipType,
              "@_Target": "../slideLayouts/slideLayout1.xml",
            },
          ],
        },
      } as XmlObject;
      init.input.zip.file(
        newSlideRelsPath,
        init.input.xmlBuilder.build(fallbackRels),
      );
      init.input.slideRelsMap.set(
        newSlidePath,
        new Map<string, string>([["rId1", "../slideLayouts/slideLayout1.xml"]]),
      );
    }

    init.slideTargetByRid.set(
      newSlideRid,
      init.input.toPresentationTarget(newSlidePath),
    );
  }

  private async tryCopySourceRelationships(init: {
    input: PptxPresentationSlidesReconcilerInput;
    sourceSlidePath: string | undefined;
    newSlidePath: string;
    newSlideRelsPath: string;
  }): Promise<boolean> {
    if (!init.sourceSlidePath) return false;

    const sourceSlideRelsPath = init.input.toSlideRelsPath(
      init.sourceSlidePath,
    );
    const sourceSlideRelsXml = await init.input.zip
      .file(sourceSlideRelsPath)
      ?.async("string");
    if (!sourceSlideRelsXml) return false;

    init.input.zip.file(init.newSlideRelsPath, sourceSlideRelsXml);
    await init.input.loadSlideRelationships(
      init.newSlidePath,
      init.newSlideRelsPath,
    );
    return true;
  }

  private removeInactiveSlides(init: {
    input: PptxPresentationSlidesReconcilerInput;
    activeSlidePaths: Set<string>;
    slideTargetByRid: Map<string, string>;
  }): void {
    const knownSlidePaths = new Set<string>();
    for (const [, target] of init.slideTargetByRid.entries()) {
      knownSlidePaths.add(init.input.toSlidePathFromTarget(target));
    }
    for (const slidePath of init.input.slideMap.keys()) {
      if (slidePath.startsWith("ppt/slides/slide")) {
        knownSlidePaths.add(slidePath);
      }
    }

    for (const slidePath of knownSlidePaths) {
      if (init.activeSlidePaths.has(slidePath)) continue;

      init.input.slideMap.delete(slidePath);
      init.input.slideRelsMap.delete(slidePath);
      init.input.zip.remove(slidePath);
      init.input.zip.remove(init.input.toSlideRelsPath(slidePath));
    }
  }

  private ensureArray(value: unknown): unknown[] {
    if (Array.isArray(value)) return value;
    if (value === undefined || value === null) return [];
    return [value];
  }
}
