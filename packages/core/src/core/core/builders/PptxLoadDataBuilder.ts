import type {
  ParsedTableStyleMap,
  PptxAppProperties,
  PptxCoreProperties,
  PptxCustomProperty,
  PptxCustomShow,
  PptxCustomXmlPart,
  PptxCustomerData,
  PptxData,
  PptxKinsoku,
  PptxModifyVerifier,
  PptxPhotoAlbum,
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

  private customXmlParts: PptxCustomXmlPart[] | undefined;

  private photoAlbum: PptxPhotoAlbum | undefined;

  private kinsoku: PptxKinsoku | undefined;

  private modifyVerifier: PptxModifyVerifier | undefined;

  private customerData: PptxCustomerData[] | undefined;

  private slideSizeType: string | undefined;

  private thumbnailData: Uint8Array | undefined;

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

  public withCustomXmlParts(
    customXmlParts: PptxCustomXmlPart[] | undefined,
  ): this {
    this.customXmlParts = customXmlParts;
    return this;
  }

  public withPhotoAlbum(photoAlbum: PptxPhotoAlbum | undefined): this {
    this.photoAlbum = photoAlbum;
    return this;
  }

  public withKinsoku(kinsoku: PptxKinsoku | undefined): this {
    this.kinsoku = kinsoku;
    return this;
  }

  public withModifyVerifier(modifyVerifier: PptxModifyVerifier | undefined): this {
    this.modifyVerifier = modifyVerifier;
    return this;
  }

  public withCustomerData(customerData: PptxCustomerData[] | undefined): this {
    this.customerData = customerData;
    return this;
  }

  public withSlideSizeType(slideSizeType: string | undefined): this {
    this.slideSizeType = slideSizeType;
    return this;
  }

  public withThumbnailData(thumbnailData: Uint8Array | undefined): this {
    this.thumbnailData = thumbnailData;
    return this;
  }

  public build(): PptxData {
    return {
      width: this.width,
      height: this.height,
      widthEmu: this.widthEmu,
      heightEmu: this.heightEmu,
      slideSizeType: this.slideSizeType,
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
      photoAlbum: this.photoAlbum,
      kinsoku: this.kinsoku,
      modifyVerifier: this.modifyVerifier,
      customXmlParts: this.customXmlParts,
      customerData: this.customerData,
      thumbnailData: this.thumbnailData,
    };
  }
}
