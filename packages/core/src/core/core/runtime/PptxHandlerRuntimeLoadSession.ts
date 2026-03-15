import { type PptxSection, type PptxCustomXmlPart, XmlObject } from "../../types";
import JSZip from "jszip";
import { type PptxHandlerLoadOptions } from "../types";
import { detectDigitalSignatures } from "../../utils/signature-detection";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeEmbeddedFonts";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  protected isZipContainer(data: ArrayBuffer): boolean {
    const bytes = new Uint8Array(data);
    if (bytes.byteLength < 4) return false;

    return (
      bytes[0] === 0x50 &&
      bytes[1] === 0x4b &&
      ((bytes[2] === 0x03 && bytes[3] === 0x04) ||
        (bytes[2] === 0x05 && bytes[3] === 0x06) ||
        (bytes[2] === 0x07 && bytes[3] === 0x08))
    );
  }

  protected async initializeLoadSession(
    data: ArrayBuffer,
    options: PptxHandlerLoadOptions,
  ): Promise<void> {
    this.eagerDecodeImages = options.eagerDecodeImages ?? true;
    if (data.byteLength < 4) {
      throw new Error("Invalid PPTX binary: file is empty or truncated.");
    }
    if (!this.isZipContainer(data)) {
      throw new Error(
        "Invalid PPTX binary: not a ZIP/OpenXML file. Legacy .ppt is not supported.",
      );
    }

    try {
      this.zip = await JSZip.loadAsync(data);
      this.documentPropertiesUpdater =
        this.dependencyFactory.createDocumentPropertiesUpdater(
          this.zip,
          this.parser,
          this.builder,
        );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to read zip container.";
      throw new Error(`Invalid PPTX package: ${message}`);
    }

    this.slideRelsMap.clear();
    this.externalRelsMap.clear();
    this.slideMap.clear();
    this.layoutCache.clear();
    this.masterCache.clear();
    this.layoutXmlMap.clear();
    this.masterXmlMap.clear();
    this.imageDataCache.clear();
    this.themeColorMap = {};
    this.themeFontMap = {};
    this.presentationDefaultTextStyle = undefined;
    this.commentAuthorMap.clear();
    this.commentAuthorDetails.clear();
    this.thumbnailData = null;
    this.vbaProjectBin = null;
    this.vbaRelatedParts.clear();
    this.signatureDetection = null;
    this.customXmlParts = [];
    this.isStrictOoxml = false;
    this.restoreOriginalParser();
    this.compatibilityService.resetWarnings();
  }

  /**
   * Detect and preserve VBA macro project data for .pptm round-trip.
   *
   * Scans the ZIP for `ppt/vbaProject.bin` and any related VBA parts
   * (e.g. `ppt/vbaData.xml`). The raw binary data is stored in runtime
   * state so it can be written back during save.
   */
  protected async detectAndPreserveVbaProject(): Promise<void> {
    const vbaProjectFile = this.zip.file("ppt/vbaProject.bin");
    if (!vbaProjectFile) return;

    this.vbaProjectBin = await vbaProjectFile.async("uint8array");

    // Preserve additional VBA-related parts that may exist alongside the project
    const vbaRelatedPaths = [
      "ppt/vbaData.xml",
      "ppt/_rels/vbaProject.bin.rels",
    ];
    for (const partPath of vbaRelatedPaths) {
      const file = this.zip.file(partPath);
      if (file) {
        const bytes = await file.async("uint8array");
        this.vbaRelatedParts.set(partPath, bytes);
      }
    }
  }

  /**
   * Scan ZIP entry paths for `_xmlsignatures/` parts to detect digital
   * signatures. Stores the result in runtime state so it can be checked
   * during build and stripped during save.
   */
  protected detectDigitalSignatureParts(): void {
    const entryPaths: string[] = [];
    this.zip.forEach((relativePath) => {
      entryPaths.push(relativePath);
    });
    this.signatureDetection = detectDigitalSignatures(entryPaths);
  }

  /**
   * Scan ZIP entries for `customXml/item*.xml` parts and their associated
   * `itemProps*.xml` property files. Parsed parts are stored in
   * `this.customXmlParts` for round-trip preservation.
   */
  protected async parseCustomXmlParts(): Promise<void> {
    const parts: PptxCustomXmlPart[] = [];
    const itemPattern = /^customXml\/item(\d+)\.xml$/i;

    const entries: string[] = [];
    this.zip.forEach((relativePath) => {
      entries.push(relativePath);
    });

    for (const entry of entries) {
      const match = entry.match(itemPattern);
      if (!match) continue;

      const itemId = match[1];
      const file = this.zip.file(entry);
      if (!file) continue;

      const data = await file.async("string");

      // Try to read associated itemProps file
      const propsPath = `customXml/itemProps${itemId}.xml`;
      const propsFile = this.zip.file(propsPath);
      let properties: string | undefined;
      let schemaUri: string | undefined;

      if (propsFile) {
        properties = await propsFile.async("string");
        // Extract schema URI from ds:schemaRef if present
        try {
          const propsData = this.parser.parse(properties) as XmlObject;
          const schemaRefs =
            propsData?.["ds:datastoreItem"]?.["ds:schemaRefs"]?.[
              "ds:schemaRef"
            ];
          if (schemaRefs) {
            const refs = Array.isArray(schemaRefs) ? schemaRefs : [schemaRefs];
            const ref = refs[0] as XmlObject | undefined;
            if (ref?.["@_ds:uri"]) {
              schemaUri = String(ref["@_ds:uri"]);
            } else if (ref?.["@_uri"]) {
              schemaUri = String(ref["@_uri"]);
            }
          }
        } catch {
          // Ignore schema parse errors — properties string is still preserved
        }
      }

      // Try to read associated relationship file
      const relsPath = `customXml/_rels/item${itemId}.xml.rels`;
      const relsFile = this.zip.file(relsPath);
      let rels: string | undefined;
      if (relsFile) {
        rels = await relsFile.async("string");
      }

      parts.push({ id: itemId, data, schemaUri, properties, rels });
    }

    this.customXmlParts = parts;
  }

  protected async loadPresentationState(): Promise<{
    width: number;
    height: number;
    notesWidthEmu: number;
    notesHeightEmu: number;
    sectionBySlideId: Map<string, { sectionId: string; sectionName: string }>;
    orderedSections: PptxSection[];
  }> {
    const presentationXml = await this.zip
      .file("ppt/presentation.xml")
      ?.async("string");
    if (!presentationXml) {
      throw new Error("Invalid PPTX: presentation.xml not found");
    }

    this.presentationData = this.parser.parse(presentationXml);

    // Detect Strict Open XML conformance from the presentation root element.
    // If detected, this normalizes the already-parsed presentation data in
    // place and wraps this.parser with a Proxy so that all subsequent
    // this.parser.parse() calls auto-normalize Strict namespace URIs to
    // their Transitional equivalents (covering all 50+ call sites).
    this.detectAndSetStrictConformance(this.presentationData!);

    await this.loadThemeData();
    this.parsePresentationDefaultTextStyle();
    await this.loadCommentAuthors();

    const { sectionBySlideId, orderedSections } = this.extractSectionMap();
    this.compatibilityService.inspectPresentationCompatibility();

    const presentationNode = this.presentationData?.["p:presentation"] as
      | XmlObject
      | undefined;
    const sldSz = (presentationNode?.["p:sldSz"] || {}) as XmlObject;
    this.rawSlideWidthEmu = parseInt(String(sldSz["@_cx"])) || 0;
    this.rawSlideHeightEmu = parseInt(String(sldSz["@_cy"])) || 0;
    const sldSzType = sldSz["@_type"] as string | undefined;
    if (sldSzType) {
      this.rawSlideSizeType = sldSzType;
    }
    const notesSz = (presentationNode?.["p:notesSz"] || {}) as XmlObject;
    const notesWidthEmu = parseInt(String(notesSz["@_cx"])) || 0;
    const notesHeightEmu = parseInt(String(notesSz["@_cy"])) || 0;
    const width = Math.round(
      this.rawSlideWidthEmu / PptxHandlerRuntime.EMU_PER_PX,
    );
    const height = Math.round(
      this.rawSlideHeightEmu / PptxHandlerRuntime.EMU_PER_PX,
    );

    return {
      width,
      height,
      notesWidthEmu,
      notesHeightEmu,
      sectionBySlideId,
      orderedSections,
    };
  }

  protected async loadSlidesForPresentation(
    sectionBySlideId: Map<string, { sectionId: string; sectionName: string }>,
  ): Promise<import("../../types").PptxSlide[]> {
    if (!this.presentationData) return [];

    return this.slideLoaderService.loadSlides({
      presentationData: this.presentationData,
      parser: this.parser,
      zip: this.zip,
      compatibilityService: this.compatibilityService,
      slideMap: this.slideMap,
      sectionBySlideId,
      setOrderedSlidePaths: (paths) => {
        this.orderedSlidePaths = paths;
      },
      loadSlideRelationships: (slidePath, slideRelsPath) =>
        this.loadSlideRelationships(slidePath, slideRelsPath),
      parseSlideClrMapOverride: (slideXml) =>
        this.parseSlideClrMapOverride(slideXml),
      setCurrentSlideClrMapOverride: (override) => {
        this.currentSlideClrMapOverride = override;
      },
      findLayoutPathForSlide: (slidePath) =>
        this.findLayoutPathForSlide(slidePath),
      loadThemeOverride: (partBasePath) => this.loadThemeOverride(partBasePath),
      applyThemeOverrideState: (override) =>
        this.applyThemeOverrideState(override),
      getLayoutElements: (slidePath) => this.getLayoutElements(slidePath),
      parseSlide: (slideXml, slidePath) => this.parseSlide(slideXml, slidePath),
      extractMediaTimingMap: (slideXml, slidePath) =>
        this.extractMediaTimingMap(slideXml, slidePath),
      enrichMediaElementsWithTiming: (elements, timingMap) =>
        this.enrichMediaElementsWithTiming(elements, timingMap),
      extractBackgroundColor: (slideXml) =>
        this.extractBackgroundColor(slideXml),
      getLayoutBackgroundColor: (slidePath) =>
        this.getLayoutBackgroundColor(slidePath),
      extractBackgroundGradient: (slideXml) =>
        this.extractBackgroundGradient(slideXml),
      getLayoutBackgroundGradient: (slidePath) =>
        this.getLayoutBackgroundGradient(slidePath),
      extractBackgroundImage: (slideXml, slidePath) =>
        this.extractBackgroundImage(slideXml, slidePath),
      getLayoutBackgroundImage: (slidePath) =>
        this.getLayoutBackgroundImage(slidePath),
      extractSlideNotes: (slidePath) => this.extractSlideNotes(slidePath),
      extractSlideComments: (slidePath) => this.extractSlideComments(slidePath),
      extractModernSlideComments: (slidePath) =>
        this.extractModernSlideComments(slidePath),
      extractBackgroundShowAnimation: (slideXml) =>
        this.extractBackgroundShowAnimation(slideXml),
      extractShowMasterShapes: (slideXml) =>
        this.extractShowMasterShapes(slideXml),
      isSlideHidden: (slideXml, slideIdEntry) =>
        this.isSlideHidden(slideXml, slideIdEntry),
      parseSlideTransition: (slideXml, slidePath) =>
        this.parseSlideTransition(slideXml, slidePath),
      parseEditorAnimations: (slideXml) => this.parseEditorAnimations(slideXml),
      parseNativeAnimations: (slideXml) => this.parseNativeAnimations(slideXml),
      getSmartArtDataForGraphicFrame: (slidePath, graphicFrame) =>
        this.getSmartArtDataForGraphicFrame(slidePath, graphicFrame),
      parseSlideCustomerData: (slideXml, slidePath) =>
        this.parseSlideCustomerData(slideXml, slidePath),
      parseSlideActiveXControls: (slideXml) =>
        this.parseSlideActiveXControls(slideXml),
    });
  }
}
