import type { PptxXmlBuilder } from "../builders/fluent";
import type {
  PptxAppProperties,
  PptxCoreProperties,
  PptxCustomProperty,
  PptxChartData,
  PptxCompatibilityWarning,
  PptxCustomShow,
  PptxExportOptions,
  PptxHandoutMaster,
  PptxLayoutOption,
  PptxData,
  PptxHeaderFooter,
  PptxKinsoku,
  PptxModifyVerifier,
  PptxNotesMaster,
  PptxPhotoAlbum,
  PptxPresentationProperties,
  PptxSection,
  PptxSlide,
  PptxSmartArtData,
  PptxTagCollection,
  PptxThemeColorScheme,
  PptxThemeFontScheme,
  PptxViewProperties,
  XmlObject,
} from "../types";

export interface PptxHandlerLoadOptions {
  eagerDecodeImages?: boolean;
  password?: string;
}

/** Output format for the save pipeline. */
export type PptxSaveFormat = "pptx" | "ppsx" | "pptm";

export interface PptxHandlerSaveOptions {
  headerFooter?: PptxHeaderFooter;
  presentationProperties?: PptxPresentationProperties;
  customShows?: PptxCustomShow[];
  sections?: PptxSection[];
  coreProperties?: PptxCoreProperties;
  appProperties?: PptxAppProperties;
  customProperties?: PptxCustomProperty[];
  /** Updated notes master data to save back to notesMaster1.xml. */
  notesMaster?: PptxNotesMaster;
  /** Updated handout master data to save back to handoutMaster1.xml. */
  handoutMaster?: PptxHandoutMaster;
  /** Updated tag collections to save back to ppt/tags/tag*.xml. */
  tags?: PptxTagCollection[];
  /** Photo album metadata to save back to `p:photoAlbum`. */
  photoAlbum?: PptxPhotoAlbum;
  /** East Asian line-break settings to save back to `p:kinsoku`. */
  kinsoku?: PptxKinsoku;
  /** Write-protection verifier. Set to `null` to remove, `undefined` to preserve existing. */
  modifyVerifier?: PptxModifyVerifier | null;
  /** View properties to save back to ppt/viewProps.xml. */
  viewProperties?: PptxViewProperties;
  /**
   * Target output format.
   * - `'pptx'` (default): Standard presentation.
   * - `'ppsx'`: Slide-show file (opens in presentation mode).
   * - `'pptm'`: Macro-enabled presentation (requires VBA data).
   */
  outputFormat?: PptxSaveFormat;
}

export interface IPptxHandlerRuntime {
  getCompatibilityWarnings(): PptxCompatibilityWarning[];
  getLayoutOptions(): PptxLayoutOption[];
  createXmlBuilder(data: PptxData): PptxXmlBuilder;
  Builder(data: PptxData): PptxXmlBuilder;
  setTemplateBackground(
    path: string,
    backgroundColor: string | undefined,
  ): void;
  setPresentationTheme(
    themePath: string,
    applyToAllMasters?: boolean,
  ): Promise<void>;
  getTemplateBackgroundColor(path: string): string | undefined;
  updateThemeColorScheme(colorScheme: PptxThemeColorScheme): Promise<void>;
  updateThemeFontScheme(fontScheme: PptxThemeFontScheme): Promise<void>;
  updateThemeName(name: string): Promise<void>;
  applyTheme(
    colorScheme: PptxThemeColorScheme,
    fontScheme: PptxThemeFontScheme,
    themeName?: string,
  ): Promise<void>;
  load(data: ArrayBuffer, options?: PptxHandlerLoadOptions): Promise<PptxData>;
  getChartDataForGraphicFrame(
    slidePath: string,
    graphicFrame: XmlObject | undefined,
  ): Promise<PptxChartData | undefined>;
  getSmartArtDataForGraphicFrame(
    slidePath: string,
    graphicFrame: XmlObject | undefined,
  ): Promise<PptxSmartArtData | undefined>;
  getImageData(imagePath: string): Promise<string | undefined>;
  /**
   * Extract a media file from the PPTX archive as an ArrayBuffer.
   * Returns undefined if the file is not found.
   */
  getMediaArrayBuffer(mediaPath: string): Promise<ArrayBuffer | undefined>;
  save(
    slides: PptxSlide[],
    options?: PptxHandlerSaveOptions,
  ): Promise<Uint8Array>;
  exportSlides(
    slides: PptxSlide[],
    options: PptxExportOptions,
  ): Promise<Map<number, Uint8Array>>;
  /**
   * Get the available slide layouts for a specific slide, based on the
   * slide's master. Scans the slide master's relationships to find all
   * layouts that belong to it.
   *
   * @param slideIndex - Zero-based slide index.
   * @param slides - Current slides array.
   * @returns Array of layout options belonging to the same slide master.
   */
  getAvailableLayoutsForSlide(
    slideIndex: number,
    slides: PptxSlide[],
  ): Promise<PptxLayoutOption[]>;
  /**
   * Scan the loaded PPTX archive for all theme parts.
   */
  getAvailableThemes(): Promise<Array<{ path: string; name?: string }>>;
  /**
   * Apply a different layout to an existing slide by updating the slide's
   * relationship to point to the new layout and re-parsing layout
   * placeholders / background.
   *
   * @param slideIndex - Zero-based slide index.
   * @param layoutPath - Archive path of the target layout
   *                     (e.g. `ppt/slideLayouts/slideLayout2.xml`).
   * @param slides - Current slides array.
   * @returns The updated slide with new layout path, name, and background.
   */
  applyLayoutToSlide(
    slideIndex: number,
    layoutPath: string,
    slides: PptxSlide[],
  ): Promise<PptxSlide>;
}
