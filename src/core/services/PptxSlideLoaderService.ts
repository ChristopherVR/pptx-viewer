import type { PptxSlide, XmlObject } from "../types";
import { parseSlideDrawingGuides } from "../utils/guide-utils";
export type {
  PptxMediaTimingEntry,
  PptxMediaTimingMap,
  PptxSlideNotesResult,
  PptxSlideLoaderThemeOverride,
  PptxSlideLoaderParams,
  IPptxSlideLoaderService,
} from "./slide-loader-types";
import type {
  IPptxSlideLoaderService,
  PptxSlideLoaderParams,
} from "./slide-loader-types";

export class PptxSlideLoaderService implements IPptxSlideLoaderService {
  public async loadSlides(params: PptxSlideLoaderParams): Promise<PptxSlide[]> {
    const presentation = params.presentationData["p:presentation"] as
      | XmlObject
      | undefined;
    const sldIdLst = presentation?.["p:sldIdLst"] as XmlObject | undefined;
    const sldIds = this.toXmlObjectArray(sldIdLst?.["p:sldId"]);

    if (sldIds.length === 0) {
      params.setOrderedSlidePaths([]);
      return [];
    }

    const relsMap = await this.loadPresentationSlideRels(params);
    const orderedSlidePaths: string[] = [];
    for (const sldId of sldIds) {
      const sRId = String(sldId["@_r:id"] || "").trim();
      const sTarget = relsMap.get(sRId);
      if (!sTarget) continue;
      const sPath = sTarget.startsWith("/")
        ? sTarget.substring(1)
        : `ppt/${sTarget}`;
      orderedSlidePaths.push(sPath);
    }
    params.setOrderedSlidePaths(orderedSlidePaths);

    const slides: PptxSlide[] = [];
    for (let index = 0; index < sldIds.length; index++) {
      const slide = await this.loadSingleSlide(
        params,
        sldIds[index],
        index,
        relsMap,
      );
      if (slide) slides.push(slide);
    }

    await this.enrichSmartArtData(slides, params);
    return slides;
  }

  private async loadPresentationSlideRels(
    params: PptxSlideLoaderParams,
  ): Promise<Map<string, string>> {
    const relsXml = await params.zip
      .file("ppt/_rels/presentation.xml.rels")
      ?.async("string");
    if (!relsXml) return new Map<string, string>();

    const relsData = params.parser.parse(relsXml) as XmlObject;
    const relationships = (
      relsData["Relationships"] as XmlObject | undefined
    )?.["Relationship"];
    const relNodes = this.toXmlObjectArray(relationships);

    const relsMap = new Map<string, string>();
    for (const relNode of relNodes) {
      const id = String(relNode["@_Id"] || "").trim();
      const target = String(relNode["@_Target"] || "").trim();
      if (id.length === 0 || target.length === 0) continue;
      relsMap.set(id, target);
    }

    return relsMap;
  }

  private async loadSingleSlide(
    params: PptxSlideLoaderParams,
    slideIdNode: XmlObject,
    slideIndex: number,
    relsMap: Map<string, string>,
  ): Promise<PptxSlide | undefined> {
    const rId = String(slideIdNode["@_r:id"] || "").trim();
    if (!rId) return undefined;

    const target = relsMap.get(rId);
    if (!target) return undefined;

    let path = target.startsWith("/") ? target.substring(1) : `ppt/${target}`;
    if (!params.zip.file(path)) {
      path = `ppt/${target}`;
    }

    const slideXmlStr = await params.zip.file(path)?.async("string");
    if (!slideXmlStr) return undefined;

    const slideXmlObj = params.parser.parse(slideXmlStr) as XmlObject;
    params.compatibilityService.inspectSlideCompatibility(slideXmlObj, path);
    params.slideMap.set(path, slideXmlObj);

    const slideId = String(slideIdNode["@_id"] || "").trim();
    const sectionMeta = slideId
      ? params.sectionBySlideId.get(slideId)
      : undefined;

    const slideRelsPath = path.replace("slides/", "slides/_rels/") + ".rels";
    await params.loadSlideRelationships(path, slideRelsPath);

    const clrMapOverride = params.parseSlideClrMapOverride(slideXmlObj);
    params.setCurrentSlideClrMapOverride(clrMapOverride);

    let restoreThemeOverride: (() => void) | undefined;
    try {
      const layoutPathForOverride = params.findLayoutPathForSlide(path);
      if (layoutPathForOverride) {
        const themeOverride = await params.loadThemeOverride(
          layoutPathForOverride,
        );
        if (themeOverride) {
          restoreThemeOverride = params.applyThemeOverrideState(themeOverride);
        }
      }

      const layoutElements = await params.getLayoutElements(path);
      const slideElements = await params.parseSlide(slideXmlObj, path);

      const mediaTimingMap = params.extractMediaTimingMap(slideXmlObj, path);
      if (mediaTimingMap.size > 0) {
        await params.enrichMediaElementsWithTiming(
          slideElements,
          mediaTimingMap,
        );
      }

      const elements = [...layoutElements, ...slideElements];
      const backgroundColor =
        params.extractBackgroundColor(slideXmlObj) ||
        (await params.getLayoutBackgroundColor(path));

      const backgroundGradient =
        params.extractBackgroundGradient(slideXmlObj) ||
        (await params.getLayoutBackgroundGradient(path));

      let backgroundImage = await params.extractBackgroundImage(
        slideXmlObj,
        path,
      );
      if (!backgroundImage) {
        backgroundImage = await params.getLayoutBackgroundImage(path);
      }

      const notesResult = await params.extractSlideNotes(path);
      const legacyComments = await params.extractSlideComments(path);
      const modernComments = await params.extractModernSlideComments(path);
      const comments =
        modernComments.length > 0
          ? [...legacyComments, ...modernComments]
          : legacyComments;

      const hidden = params.isSlideHidden(slideXmlObj, slideIdNode);
      const backgroundShowAnimation =
        params.extractBackgroundShowAnimation(slideXmlObj);
      const showMasterShapes = params.extractShowMasterShapes(slideXmlObj);
      const transition = params.parseSlideTransition(slideXmlObj, path);
      const animations = params.parseEditorAnimations(slideXmlObj);
      const nativeAnimations = params.parseNativeAnimations(slideXmlObj);
      const rawTiming = (slideXmlObj["p:sld"] as XmlObject | undefined)?.[
        "p:timing"
      ] as XmlObject | undefined;

      const drawingGuides = parseSlideDrawingGuides(slideXmlObj);

      return {
        id: path,
        rId,
        slideNumber: slideIndex + 1,
        hidden,
        sectionId: sectionMeta?.sectionId,
        sectionName: sectionMeta?.sectionName,
        elements,
        backgroundColor,
        backgroundGradient: backgroundGradient || undefined,
        backgroundImage,
        transition,
        animations,
        nativeAnimations,
        rawTiming: rawTiming || undefined,
        notes: notesResult.notes,
        notesSegments: notesResult.notesSegments,
        comments,
        rawXml: slideXmlObj,
        clrMapOverride: clrMapOverride ?? undefined,
        backgroundShowAnimation: backgroundShowAnimation ?? undefined,
        showMasterShapes: showMasterShapes ?? undefined,
        guides: drawingGuides.length > 0 ? drawingGuides : undefined,
      };
    } finally {
      if (restoreThemeOverride) {
        restoreThemeOverride();
      }
      params.setCurrentSlideClrMapOverride(null);
    }
  }

  private async enrichSmartArtData(
    slides: PptxSlide[],
    params: PptxSlideLoaderParams,
  ): Promise<void> {
    for (const slide of slides) {
      for (const element of slide.elements) {
        if (element.type !== "smartArt" || element.smartArtData) continue;
        try {
          const smartArtData = await params.getSmartArtDataForGraphicFrame(
            slide.id,
            element.rawXml as XmlObject,
          );
          if (smartArtData) {
            element.smartArtData = smartArtData;
          }
        } catch {
          // Non-critical — SmartArt will render as placeholder if enrichment fails
        }
      }
    }
  }

  private toXmlObjectArray(value: unknown): XmlObject[] {
    if (Array.isArray(value)) {
      return value.filter((entry): entry is XmlObject =>
        this.isXmlObject(entry),
      );
    }
    if (this.isXmlObject(value)) {
      return [value];
    }
    return [];
  }

  private isXmlObject(value: unknown): value is XmlObject {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
}
