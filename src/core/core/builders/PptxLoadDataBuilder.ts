import type {
  ParsedTableStyleMap,
  PptxAppProperties,
  PptxCoreProperties,
  PptxCustomProperty,
  PptxCustomShow,
  PptxData,
  PptxDrawingGuide,
  PptxEmbeddedFont,
  PptxHandoutMaster,
  PptxHeaderFooter,
  PptxLayoutOption,
  PptxNotesMaster,
  PptxPresentationProperties,
  PptxSection,
  PptxSlide,
  PptxSlideMaster,
  PptxTagCollection,
  PptxTheme,
  PptxThemeOption,
} from "../../types";

export class PptxLoadDataBuilder {
  private width = 0;

  private height = 0;

  private widthEmu = 0;

  private heightEmu = 0;

  private notesWidthEmu = 0;

  private notesHeightEmu = 0;

  private slides: PptxSlide[] = [];

  private layoutOptions: PptxLayoutOption[] = [];

  private headerFooter: PptxHeaderFooter | undefined;

  private presentationProperties: PptxPresentationProperties | undefined;

  private customShows: PptxCustomShow[] | undefined;

  private sections: PptxSection[] | undefined;

  private warnings: PptxData["warnings"] = [];

  private themeColorMap: Record<string, string> = {};

  private theme: PptxTheme | undefined;

  private tableStyleMap: ParsedTableStyleMap | undefined;

  private embeddedFonts: PptxEmbeddedFont[] | undefined;

  private mruColors: string[] | undefined;

  private notesMaster: PptxNotesMaster | undefined;

  private handoutMaster: PptxHandoutMaster | undefined;

  private slideMasters: PptxSlideMaster[] | undefined;

  private tags: PptxTagCollection[] | undefined;

  private customProperties: PptxCustomProperty[] | undefined;

  private coreProperties: PptxCoreProperties | undefined;

  private appProperties: PptxAppProperties | undefined;

  private themeOptions: PptxThemeOption[] | undefined;

  private hasMacros: boolean | undefined;

  private hasDigitalSignatures: boolean | undefined;

  private digitalSignatureCount: number | undefined;

  private presentationGuides: PptxDrawingGuide[] | undefined;

  public withDimensions(
    width: number,
    height: number,
    widthEmu: number,
    heightEmu: number,
  ): this {
    this.width = width;
    this.height = height;
    this.widthEmu = widthEmu;
    this.heightEmu = heightEmu;
    return this;
  }

  public withNotesDimensions(
    notesWidthEmu: number,
    notesHeightEmu: number,
  ): this {
    this.notesWidthEmu = notesWidthEmu;
    this.notesHeightEmu = notesHeightEmu;
    return this;
  }

  public withSlides(slides: PptxSlide[]): this {
    this.slides = slides;
    return this;
  }

  public withLayoutOptions(layoutOptions: PptxLayoutOption[]): this {
    this.layoutOptions = layoutOptions;
    return this;
  }

  public withHeaderFooter(headerFooter: PptxHeaderFooter | undefined): this {
    this.headerFooter = headerFooter;
    return this;
  }

  public withPresentationProperties(
    presentationProperties: PptxPresentationProperties | undefined,
  ): this {
    this.presentationProperties = presentationProperties;
    return this;
  }

  public withCustomShows(customShows: PptxCustomShow[] | undefined): this {
    this.customShows = customShows;
    return this;
  }

  public withSections(sections: PptxSection[] | undefined): this {
    this.sections = sections;
    return this;
  }

  public withWarnings(warnings: PptxData["warnings"]): this {
    this.warnings = warnings;
    return this;
  }

  public withThemeColorMap(themeColorMap: Record<string, string>): this {
    this.themeColorMap = themeColorMap;
    return this;
  }

  public withTheme(theme: PptxTheme | undefined): this {
    this.theme = theme;
    return this;
  }

  public withTableStyleMap(
    tableStyleMap: ParsedTableStyleMap | undefined,
  ): this {
    this.tableStyleMap = tableStyleMap;
    return this;
  }

  public withEmbeddedFonts(
    embeddedFonts: PptxEmbeddedFont[] | undefined,
  ): this {
    this.embeddedFonts = embeddedFonts;
    return this;
  }

  public withMruColors(mruColors: string[] | undefined): this {
    this.mruColors = mruColors;
    return this;
  }

  public withNotesMaster(notesMaster: PptxNotesMaster | undefined): this {
    this.notesMaster = notesMaster;
    return this;
  }

  public withHandoutMaster(handoutMaster: PptxHandoutMaster | undefined): this {
    this.handoutMaster = handoutMaster;
    return this;
  }

  public withSlideMasters(slideMasters: PptxSlideMaster[] | undefined): this {
    this.slideMasters = slideMasters;
    return this;
  }

  public withTags(tags: PptxTagCollection[] | undefined): this {
    this.tags = tags;
    return this;
  }

  public withCustomProperties(
    customProperties: PptxCustomProperty[] | undefined,
  ): this {
    this.customProperties = customProperties;
    return this;
  }

  public withCoreProperties(
    coreProperties: PptxCoreProperties | undefined,
  ): this {
    this.coreProperties = coreProperties;
    return this;
  }

  public withAppProperties(appProperties: PptxAppProperties | undefined): this {
    this.appProperties = appProperties;
    return this;
  }

  public withThemeOptions(themeOptions: PptxThemeOption[] | undefined): this {
    this.themeOptions = themeOptions;
    return this;
  }

  public withHasMacros(hasMacros: boolean | undefined): this {
    this.hasMacros = hasMacros;
    return this;
  }

  public withHasDigitalSignatures(
    hasDigitalSignatures: boolean | undefined,
  ): this {
    this.hasDigitalSignatures = hasDigitalSignatures;
    return this;
  }

  public withDigitalSignatureCount(
    digitalSignatureCount: number | undefined,
  ): this {
    this.digitalSignatureCount = digitalSignatureCount;
    return this;
  }

  public withPresentationGuides(
    presentationGuides: PptxDrawingGuide[] | undefined,
  ): this {
    this.presentationGuides = presentationGuides;
    return this;
  }

  public build(): PptxData {
    return {
      width: this.width,
      height: this.height,
      widthEmu: this.widthEmu,
      heightEmu: this.heightEmu,
      notesWidthEmu: this.notesWidthEmu > 0 ? this.notesWidthEmu : undefined,
      notesHeightEmu: this.notesHeightEmu > 0 ? this.notesHeightEmu : undefined,
      slides: this.slides,
      layoutOptions: this.layoutOptions,
      headerFooter: this.headerFooter,
      presentationProperties: this.presentationProperties,
      customShows: this.customShows,
      sections: this.sections,
      warnings: this.warnings,
      themeColorMap: this.themeColorMap,
      theme: this.theme,
      tableStyleMap: this.tableStyleMap,
      embeddedFonts: this.embeddedFonts,
      mruColors: this.mruColors,
      notesMaster: this.notesMaster,
      handoutMaster: this.handoutMaster,
      slideMasters: this.slideMasters,
      tags: this.tags,
      customProperties: this.customProperties,
      coreProperties: this.coreProperties,
      appProperties: this.appProperties,
      themeOptions: this.themeOptions,
      hasMacros: this.hasMacros,
      hasDigitalSignatures: this.hasDigitalSignatures,
      digitalSignatureCount: this.digitalSignatureCount,
      presentationGuides: this.presentationGuides,
    };
  }
}
