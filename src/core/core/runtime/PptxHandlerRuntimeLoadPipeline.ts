import {
  PptxData,
  PptxSlide,
  type PptxSection,
  PptxCompatibilityWarning,
} from "../../types";
import { PptxLoadDataBuilder } from "../builders";
import { type PptxHandlerLoadOptions } from "../types";
import { PptxXmlBuilder } from "../../builders/fluent";
import { parsePresentationDrawingGuides } from "../../utils/guide-utils";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeLoadSession";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  protected async buildLoadData(
    presentationState: {
      width: number;
      height: number;
      notesWidthEmu: number;
      notesHeightEmu: number;
      orderedSections: PptxSection[];
    },
    slidesWithWarnings: PptxSlide[],
  ): Promise<PptxData> {
    const headerFooter = this.extractHeaderFooter();
    const presentationProperties = await this.parsePresentationProperties();
    const customShows = this.parseCustomShows();
    const tableStyleMap = await this.parseTableStyles();
    const embeddedFonts = await this.getEmbeddedFonts();
    const themeOptions = await this.parseThemeOptions();
    const notesMaster = await this.parseNotesMaster();
    const handoutMaster = await this.parseHandoutMaster();
    const slideMasters = await this.parseSlideMasters();
    const tags = await this.parseTags();
    const customProperties = await this.parseCustomProperties();
    const coreProperties = await this.parseCoreProperties();
    const appProperties = await this.parseAppProperties();
    const presentationGuides = this.presentationData
      ? parsePresentationDrawingGuides(this.presentationData)
      : [];

    return new PptxLoadDataBuilder()
      .withDimensions(
        presentationState.width,
        presentationState.height,
        this.rawSlideWidthEmu,
        this.rawSlideHeightEmu,
      )
      .withNotesDimensions(
        presentationState.notesWidthEmu,
        presentationState.notesHeightEmu,
      )
      .withSlides(slidesWithWarnings)
      .withLayoutOptions(this.getLayoutOptions())
      .withHeaderFooter(headerFooter)
      .withPresentationProperties(presentationProperties)
      .withCustomShows(customShows)
      .withSections(
        presentationState.orderedSections.length > 0
          ? presentationState.orderedSections
          : undefined,
      )
      .withWarnings(this.compatibilityService.getWarnings())
      .withThemeColorMap({ ...this.themeColorMap })
      .withTheme(this.buildThemeObject())
      .withThemeOptions(themeOptions.length > 0 ? themeOptions : undefined)
      .withTableStyleMap(tableStyleMap)
      .withEmbeddedFonts(embeddedFonts.length > 0 ? embeddedFonts : undefined)
      .withMruColors(presentationProperties?.mruColors)
      .withNotesMaster(notesMaster)
      .withHandoutMaster(handoutMaster)
      .withSlideMasters(slideMasters.length > 0 ? slideMasters : undefined)
      .withTags(tags.length > 0 ? tags : undefined)
      .withCustomProperties(
        customProperties.length > 0 ? customProperties : undefined,
      )
      .withCoreProperties(coreProperties)
      .withAppProperties(appProperties)
      .withHasMacros(this.vbaProjectBin !== null ? true : undefined)
      .withHasDigitalSignatures(
        this.signatureDetection?.hasSignatures || undefined,
      )
      .withDigitalSignatureCount(
        this.signatureDetection?.signatureCount &&
          this.signatureDetection.signatureCount > 0
          ? this.signatureDetection.signatureCount
          : undefined,
      )
      .withPresentationGuides(
        presentationGuides.length > 0 ? presentationGuides : undefined,
      )
      .build();
  }

  /**
   * Walk the raw XML of every slide to find the highest numeric `@_id`
   * attribute on `p:cNvPr` / `p:cNvCxnSpPr` / `p:cNvPicPr` nodes.
   * This is used to seed the element builder's ID counter so that
   * new elements never collide with existing ones.
   */
  protected findMaxElementId(slides: PptxSlide[]): number {
    let max = 0;
    const visit = (node: unknown): void => {
      if (node === null || node === undefined || typeof node !== "object")
        return;
      const obj = node as Record<string, unknown>;
      if ("@_id" in obj) {
        const id = parseInt(String(obj["@_id"]), 10);
        if (Number.isFinite(id) && id > max) {
          max = id;
        }
      }
      for (const value of Object.values(obj)) {
        if (Array.isArray(value)) {
          for (const item of value) {
            visit(item);
          }
        } else if (typeof value === "object" && value !== null) {
          visit(value);
        }
      }
    };
    for (const slide of slides) {
      visit(slide.rawXml);
    }
    return max;
  }

  protected resetElementIdCounter(slides: PptxSlide[]): void {
    const maxExistingId = this.findMaxElementId(slides);
    this.elementXmlBuilder.resetIdCounter(maxExistingId + 1);
  }

  protected attachSlideWarnings(slides: PptxSlide[]): PptxSlide[] {
    const warnings = this.compatibilityService.getWarnings();
    return slides.map((slide) => ({
      ...slide,
      warnings: warnings.filter((warning) => warning.slideId === slide.id),
    }));
  }

  async load(
    data: ArrayBuffer,
    options: PptxHandlerLoadOptions = {},
  ): Promise<PptxData> {
    await this.initializeLoadSession(data, options);
    await this.detectAndPreserveVbaProject();
    this.detectDigitalSignatureParts();
    const presentationState = await this.loadPresentationState();
    const slides = await this.loadSlidesForPresentation(
      presentationState.sectionBySlideId,
    );
    const slidesWithWarnings = this.attachSlideWarnings(slides);
    this.resetElementIdCounter(slides);
    return this.buildLoadData(presentationState, slidesWithWarnings);
  }

  /**
   * Retrieve the current background colour for a layout or master.
   */
  getTemplateBackgroundColor(path: string): string | undefined {
    return this.templateBackgroundService.getBackgroundColor(
      {
        layoutXmlMap: this.layoutXmlMap,
        masterXmlMap: this.masterXmlMap,
      },
      path,
      (xmlObj, rootTag) => this.extractBackgroundColor(xmlObj, rootTag),
    );
  }

  /**
   * Update the background colour of a slide layout or slide master XML node.
   *
   * @param path - The archive path of the layout or master
   *               (e.g. `ppt/slideLayouts/slideLayout1.xml`)
   * @param backgroundColor - Hex colour string (e.g. `#FF0000`) or
   *                          `undefined` / empty to remove background.
   */
  setTemplateBackground(
    path: string,
    backgroundColor: string | undefined,
  ): void {
    this.templateBackgroundService.setBackground(
      {
        layoutXmlMap: this.layoutXmlMap,
        masterXmlMap: this.masterXmlMap,
      },
      path,
      backgroundColor,
    );
  }

  public createXmlBuilder(data: PptxData): PptxXmlBuilder {
    return new PptxXmlBuilder(data);
  }

  public Builder(data: PptxData): PptxXmlBuilder {
    return this.createXmlBuilder(data);
  }

  getCompatibilityWarnings(): PptxCompatibilityWarning[] {
    return this.compatibilityService.getWarnings();
  }
}
