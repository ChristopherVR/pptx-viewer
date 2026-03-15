/**
 * Top-level presentation types: slides, canvas dimensions, export options,
 * and the root {@link PptxData} structure returned by `PptxHandlerCore.load()`.
 *
 * @module pptx-types/presentation
 */

// ==========================================================================
// Slide, presentation data, and export types
// ==========================================================================

import type { XmlObject, PptxDrawingGuide } from "./common";
import type { TextSegment } from "./text";
import type { PptxElement } from "./elements";
import type { PptxSlideTransition } from "./transition";
import type { PptxElementAnimation, PptxNativeAnimation } from "./animation";
import type {
  PptxComment,
  PptxCommentAuthor,
  PptxCompatibilityWarning,
  PptxTagCollection,
  PptxCustomProperty,
  PptxCoreProperties,
  PptxAppProperties,
} from "./metadata";
import type { PptxViewProperties } from "./view-properties";
import type { PptxTheme } from "./theme";
import type {
  PptxThemeOption,
  PptxNotesMaster,
  PptxHandoutMaster,
  PptxSlideMaster,
} from "./masters";
import type { ParsedTableStyleMap } from "./table";

/**
 * A customer data reference from `p:custDataLst / p:custData`.
 *
 * Enterprise add-ins and integrations store custom data parts in the
 * package and reference them via relationship IDs in the slide or
 * presentation XML.
 *
 * @see ECMA-376 Part 1, §19.2.1.3 (custDataLst), §19.3.1.6 (custData)
 */
export interface PptxCustomerData {
  /** Resolved part path inside the package (e.g. `ppt/customerData/item1.xml`). */
  id: string;
  /** Relationship ID referencing the custom data part. */
  relId: string;
  /** Raw string content of the custom data part (if resolvable). */
  data?: string;
}

/**
 * An ActiveX control reference from `p:controls / p:control`.
 *
 * ActiveX form controls (buttons, text boxes, check boxes, combo boxes, etc.)
 * are embedded via OLE parts and referenced by relationship ID in the slide XML.
 *
 * @see ECMA-376 Part 1, §19.3.1.3 (controls), §19.3.1.2 (control)
 */
export interface PptxActiveXControl {
  /** Relationship ID referencing the ActiveX binary part. */
  relId: string;
  /** Control name from @name attribute. */
  name?: string;
  /** Shape ID this control is linked to (from @spid). */
  shapeId?: string;
  /** Raw XML for round-trip preservation. */
  rawXml?: XmlObject;
}

/**
 * A single slide in a parsed PPTX presentation.
 *
 * Contains the element tree, background settings, notes, comments,
 * transition / animation data, and metadata like layout path and section.
 *
 * @example
 * ```ts
 * const slide: PptxSlide = {
 *   id: "slide1",
 *   rId: "rId2",
 *   slideNumber: 1,
 *   elements: [titleTextBox, subtitleTextBox],
 *   backgroundColor: "#FFFFFF",
 *   notes: "Remember to mention quarterly goals.",
 * };
 * // => satisfies PptxSlide
 * ```
 */
export interface PptxSlide {
  id: string;
  rId: string; // Relationship ID
  sourceSlideId?: string; // Optional source slide path when creating new slides
  layoutPath?: string;
  layoutName?: string;
  slideNumber: number;
  hidden?: boolean; // Hidden slides are skipped in presentation mode
  sectionName?: string;
  sectionId?: string;
  elements: PptxElement[];
  backgroundColor?: string;
  backgroundImage?: string; // base64 data URL for background image
  backgroundGradient?: string; // CSS gradient string for background
  transition?: PptxSlideTransition;
  animations?: PptxElementAnimation[];
  /** Native OOXML animation data parsed from `p:timing`. */
  nativeAnimations?: PptxNativeAnimation[];
  /** Preserved raw `p:timing` XML for lossless round-trip of native animations. */
  rawTiming?: XmlObject;
  notes?: string;
  /** Rich text segments for the slide notes (preserves formatting). */
  notesSegments?: TextSegment[];
  comments?: PptxComment[];
  warnings?: PptxCompatibilityWarning[];
  rawXml?: XmlObject;
  /** Per-slide colour map override parsed from `p:clrMapOvr`. */
  clrMapOverride?: Record<string, string>;
  /** Whether background animations should play (`p:bg/@showAnimation`). */
  backgroundShowAnimation?: boolean;
  /** Whether master slide shapes should be shown on this slide (`p:sld/@showMasterSp`). */
  showMasterShapes?: boolean;
  /** Drawing guides parsed from slide extension list. */
  guides?: PptxDrawingGuide[];
  /** When explicitly `false`, the slide is unmodified and save can skip re-serialization. */
  isDirty?: boolean;
  /** Customer data references from `p:custDataLst` on this slide. */
  customerData?: PptxCustomerData[];
  /** ActiveX control references from `p:controls` on this slide. */
  activeXControls?: PptxActiveXControl[];
}

/**
 * A slide layout available in the loaded presentation.
 *
 * Each entry maps to a `<p:sldLayout>` inside `ppt/slideLayouts/`.
 *
 * @example
 * ```ts
 * const layout: PptxLayoutOption = {
 *   path: "ppt/slideLayouts/slideLayout2.xml",
 *   name: "Title and Content",
 * };
 * // => satisfies PptxLayoutOption
 * ```
 */
export interface PptxLayoutOption {
  path: string;
  name: string;
  /** Standard layout type from `p:sldLayout/@type` (e.g. "obj", "twoColTx", "blank"). */
  type?: string;
}

/**
 * Header, footer, date-time, and slide-number placeholders.
 *
 * Parsed from `ppt/presProps.xml` and individual slide layouts.
 *
 * @example
 * ```ts
 * const hf: PptxHeaderFooter = {
 *   hasFooter: true,
 *   footerText: "Confidential",
 *   hasSlideNumber: true,
 * };
 * // => satisfies PptxHeaderFooter
 * ```
 */
export interface PptxHeaderFooter {
  hasHeader?: boolean;
  headerText?: string;
  hasFooter?: boolean;
  footerText?: string;
  hasDateTime?: boolean;
  dateTimeText?: string;
  dateTimeAuto?: boolean;
  /** OOXML date format pattern (e.g. "M/d/yyyy", "dddd, MMMM dd, yyyy"). */
  dateFormat?: string;
  hasSlideNumber?: boolean;
}

/**
 * Presentation-level properties parsed from `presentationPr.xml`.
 *
 * Controls slideshow behaviour, print settings, custom colours, and grid.
 *
 * @example
 * ```ts
 * const props: PptxPresentationProperties = {
 *   showType: "presented",
 *   loopContinuously: false,
 *   advanceMode: "useTimings",
 * };
 * // => satisfies PptxPresentationProperties
 * ```
 */
export interface PptxPresentationProperties {
  /** Show type: presented, browsed, kiosk. */
  showType?: "presented" | "browsed" | "kiosk";
  /** Whether to loop the slideshow continuously. */
  loopContinuously?: boolean;
  /** Whether to show without narration. */
  showWithNarration?: boolean;
  /** Whether to show without animation. */
  showWithAnimation?: boolean;
  /** Advance slides mode: manual click or use stored timings. */
  advanceMode?: "manual" | "useTimings";
  /** Show slides: 'all', a custom show id, or a from-to range. */
  showSlidesMode?: "all" | "customShow" | "range";
  /** Custom show id to use when showSlidesMode is 'customShow'. */
  showSlidesCustomShowId?: string;
  /** Slide range start (1-based) when showSlidesMode is 'range'. */
  showSlidesFrom?: number;
  /** Slide range end (1-based) when showSlidesMode is 'range'. */
  showSlidesTo?: number;
  /** Whether to show subtitles/captions during presentation mode. */
  showSubtitles?: boolean;
  /** Print settings: slides per page. */
  printSlidesPerPage?: number;
  /** Print settings: frame slides. */
  printFrameSlides?: boolean;
  /** Print settings: colour mode (from `p:prnPr/@clrMode`). */
  printColorMode?: "clr" | "gray" | "bw";
  /** Most-recently-used colours from the presentation palette. */
  mruColors?: string[];
  /** Grid spacing in EMUs (cx, cy). Default is 914400 / 8 = 114300. */
  gridSpacing?: { cx: number; cy: number };
  /** Pen colour for presentation mode annotations (from `p:showPr/p:penClr`). */
  penColor?: string;
  /** Kiosk auto-restart interval in milliseconds (from `p:kiosk/@restart`). Only meaningful when showType is "kiosk". */
  kioskRestartTime?: number;
}

/**
 * A named custom slide show (`p:custShowLst / p:custShow`).
 *
 * Custom shows define ordered subsets of slides that can be presented
 * independently of the full deck.
 *
 * @example
 * ```ts
 * const show: PptxCustomShow = {
 *   name: "Executive Summary",
 *   id: "0",
 *   slideRIds: ["rId2", "rId5", "rId8"],
 * };
 * // => satisfies PptxCustomShow
 * ```
 */
export interface PptxCustomShow {
  /** Custom show name. */
  name: string;
  /** Custom show id. */
  id: string;
  /** Ordered list of slide relationship IDs included in this custom show. */
  slideRIds: string[];
}

/**
 * An ordered section in the presentation (from `p:sectionLst` / `p14:sectionLst`).
 *
 * Sections group consecutive slides under a named heading (visible
 * in the PowerPoint slide sorter).
 *
 * @example
 * ```ts
 * const section: PptxSection = {
 *   id: "sec_1",
 *   name: "Introduction",
 *   slideIds: ["256", "257"],
 * };
 * // => satisfies PptxSection
 * ```
 */
export interface PptxSection {
  /** Section unique identifier (GUID or synthetic). */
  id: string;
  /** Human-readable section name. */
  name: string;
  /** Ordered list of numeric slide IDs that belong to this section. */
  slideIds: string[];
  /** Whether the section is collapsed in the slide sorter (from p15:sectionPr). */
  collapsed?: boolean;
  /** Section highlight color hex (from p15:sectionPr/@clr). */
  color?: string;
}

/**
 * Write-protection hash data parsed from `p:modifyVerifier` in `presentation.xml`.
 *
 * When present, the presentation is marked as "read-only recommended" or
 * write-protected with a password hash.  The hash parameters follow the
 * ECMA-376 Part 1, section 19.2.1.22 specification.
 *
 * @example
 * ```ts
 * const verifier: PptxModifyVerifier = {
 *   algorithmName: "SHA-512",
 *   hashData: "base64EncodedHash==",
 *   saltData: "base64EncodedSalt==",
 *   spinValue: 100000,
 * };
 * // => satisfies PptxModifyVerifier
 * ```
 */
export interface PptxModifyVerifier {
  /** Hash algorithm name (e.g. "SHA-512", "SHA-1"). */
  algorithmName?: string;
  /** Base64-encoded hash value. */
  hashData?: string;
  /** Base64-encoded salt value. */
  saltData?: string;
  /** Number of hash iterations (spin count). */
  spinValue?: number;
  /** Legacy algorithm ID extension. */
  algIdExt?: string;
  /** Legacy algorithm ID. */
  cryptAlgorithmSid?: number;
  /** Cryptographic algorithm type (e.g. "typeAny"). */
  cryptAlgorithmType?: string;
  /** Cryptographic provider name. */
  cryptProvider?: string;
  /** Cryptographic provider type (e.g. "providerTypeRsaFull"). */
  cryptProviderType?: string;
  /** Cryptographic algorithm class (e.g. "hash"). */
  cryptAlgorithmClass?: string;
}

/**
 * Photo album metadata from `p:photoAlbum` in `presentation.xml`.
 *
 * Stores settings for presentations created via Insert > Photo Album.
 *
 * @see ECMA-376 Part 1, §19.2.1.27
 */
export interface PptxPhotoAlbum {
  /** Whether photos are displayed in black-and-white. */
  bw?: boolean;
  /** Whether captions are shown below each photo. */
  showCaptions?: boolean;
  /** Photo album layout (e.g. "1pic", "2pic", "4pic", "fitToSlide"). */
  layout?: string;
  /** Frame style applied to each photo (e.g. "frameStyle1"). */
  frame?: string;
}

/**
 * East Asian line-break (kinsoku) settings from `p:kinsoku` in `presentation.xml`.
 *
 * Defines forbidden start/end characters for a given language so that
 * line-breaking follows East Asian typographic rules.
 *
 * @see ECMA-376 Part 1, §19.2.1.17
 */
export interface PptxKinsoku {
  /** Language code (e.g. "ja-JP", "zh-CN"). */
  lang?: string;
  /** Characters that cannot begin a line. */
  invalStChars?: string;
  /** Characters that cannot end a line. */
  invalEndChars?: string;
}

/**
 * Root data structure returned by {@link PptxHandlerCore.load}.
 *
 * Contains every slide, canvas dimensions, theme data, layout options,
 * metadata, and optional features (custom shows, sections, macros,
 * digital signatures, embedded fonts).
 *
 * @example
 * ```ts
 * const data: PptxData = await handler.load(buffer);
 * console.log(`${data.slides.length} slides, ${data.width}×${data.height}`);
 * // => e.g. "24 slides, 960×540"
 * ```
 */
export interface PptxData {
  slides: PptxSlide[];
  width: number; // Presentation width in pixels (approx)
  height: number;
  /** Slide width in EMU (for save round-trip). */
  widthEmu?: number;
  /** Slide height in EMU (for save round-trip). */
  heightEmu?: number;
  /** Slide size type from `p:sldSz/@type` (e.g. "screen4x3", "screen16x9", "custom"). */
  slideSizeType?: string;
  /** Notes page width in EMU (from `p:notesSz`). */
  notesWidthEmu?: number;
  /** Notes page height in EMU (from `p:notesSz`). */
  notesHeightEmu?: number;
  layoutOptions?: PptxLayoutOption[];
  headerFooter?: PptxHeaderFooter;
  /** Presentation-level properties parsed from `presentationPr.xml`. */
  presentationProperties?: PptxPresentationProperties;
  /** Named custom slide shows from `p:custShowLst`. */
  customShows?: PptxCustomShow[];
  /** Ordered presentation sections from `p:sectionLst` / `p14:sectionLst`. */
  sections?: PptxSection[];
  warnings?: PptxCompatibilityWarning[];
  /** Map of theme colour scheme keys to resolved hex values. */
  themeColorMap?: Record<string, string>;
  /** Full parsed theme object with colours, fonts, and name. */
  theme?: PptxTheme;
  /** Available theme parts discovered in `ppt/theme/`. */
  themeOptions?: PptxThemeOption[];
  /** Parsed table style definitions from `ppt/tableStyles.xml`. */
  tableStyleMap?: ParsedTableStyleMap;
  /** Whether the presentation is password-protected. */
  isPasswordProtected?: boolean;
  /** Embedded font data (name + binary data URL) extracted from the presentation. */
  embeddedFonts?: PptxEmbeddedFont[];
  /** Most-recently-used colour list from presentation properties. */
  mruColors?: string[];
  /** Parsed notes master data if present in the PPTX. */
  notesMaster?: PptxNotesMaster;
  /** Parsed handout master data if present in the PPTX. */
  handoutMaster?: PptxHandoutMaster;
  /** Structured slide master data for each master in the presentation. */
  slideMasters?: PptxSlideMaster[];
  /** Parsed tag collections attached to the presentation or slides. */
  tags?: PptxTagCollection[];
  /** Custom document properties from `docProps/custom.xml`. */
  customProperties?: PptxCustomProperty[];
  /** Core document properties from `docProps/core.xml`. */
  coreProperties?: PptxCoreProperties;
  /** Extended (application) properties from `docProps/app.xml`. */
  appProperties?: PptxAppProperties;
  /** Whether the presentation contains VBA macros (is a .pptm file). */
  hasMacros?: boolean;
  /** Whether the presentation contains digital signatures (`_xmlsignatures/` parts). */
  hasDigitalSignatures?: boolean;
  /** Number of digital signatures found. */
  digitalSignatureCount?: number;
  /** Presentation-level drawing guides from `p:extLst`. */
  presentationGuides?: PptxDrawingGuide[];
  /** View properties from `ppt/viewProps.xml`. */
  viewProperties?: PptxViewProperties;
  /** Write-protection verifier from `p:modifyVerifier` in `presentation.xml`. */
  modifyVerifier?: PptxModifyVerifier;
  /** Photo album metadata from `p:photoAlbum` in `presentation.xml`. */
  photoAlbum?: PptxPhotoAlbum;
  /** East Asian line-break settings from `p:kinsoku` in `presentation.xml`. */
  kinsoku?: PptxKinsoku;
  /** Custom XML data parts from `customXml/` in the OPC package. */
  customXmlParts?: PptxCustomXmlPart[];
  /** Customer data references from `p:custDataLst` in `presentation.xml`. */
  customerData?: PptxCustomerData[];
  /** Thumbnail image binary data from `docProps/thumbnail.{jpeg,png}`. */
  thumbnailData?: Uint8Array;
  /** Comment authors parsed from `ppt/commentAuthors.xml` for round-trip preservation. */
  commentAuthors?: PptxCommentAuthor[];
  /**
   * OOXML conformance class of the loaded file.
   * - `'strict'` -- ISO/IEC 29500 Strict (uses `purl.oclc.org` namespace URIs)
   * - `'transitional'` -- ECMA-376 Transitional (uses `schemas.openxmlformats.org` URIs)
   *
   * When saving, if the save option `conformance` is `'preserve'` (default),
   * the file will be saved using the same conformance class as the original.
   */
  conformance?: "strict" | "transitional";
}

// ==========================================================================
// Export options (GAP-20 — stubs for future PDF/PNG export)
// ==========================================================================

/**
 * Target format for slide export.
 *
 * @see {@link PptxExportOptions}
 */
export type PptxExportFormat = "pdf" | "png" | "svg";

/**
 * Options controlling slide export to raster or vector formats.
 *
 * @example
 * ```ts
 * const opts: PptxExportOptions = {
 *   format: "png",
 *   slideIndices: [0, 2, 4],
 *   dpi: 300,
 * };
 * // => satisfies PptxExportOptions
 * ```
 */
export interface PptxExportOptions {
  /** Target format. */
  format: PptxExportFormat;
  /** Slide indices to export (0-based). If omitted, all slides are exported. */
  slideIndices?: number[];
  /** Output width in pixels (for PNG). Height is derived from aspect ratio. */
  width?: number;
  /** DPI for raster export (default 150). */
  dpi?: number;
  /** Whether to include hidden slides. */
  includeHidden?: boolean;
}

/**
 * Embedded font data extracted from a PPTX file.
 *
 * Used to register `@font-face` rules so the renderer can display
 * the correct typeface even when the system font is missing.
 *
 * @example
 * ```ts
 * const font: PptxEmbeddedFont = {
 *   name: "CustomSans",
 *   dataUrl: "data:font/truetype;base64,AAEAK...",
 *   format: "truetype",
 * };
 * // => satisfies PptxEmbeddedFont
 * ```
 */
/**
 * A single Custom XML Data Part stored in `customXml/` within the OPC package.
 *
 * These parts are used by add-ins, data-binding, and enterprise templates
 * to store structured data alongside the presentation.
 *
 * @see ECMA-376 Part 1, §15.2.5
 */
export interface PptxCustomXmlPart {
  /** Item number (e.g. "1" for `customXml/item1.xml`). */
  id: string;
  /** Raw XML string content of the custom XML item. */
  data: string;
  /** Schema target namespace URI from `itemProps` (ds:schemaRef/@ds:uri). */
  schemaUri?: string;
  /** Raw XML string content of the associated `itemProps` file. */
  properties?: string;
  /** Raw XML string content of the OPC relationship file (`customXml/_rels/item{id}.xml.rels`). */
  rels?: string;
}

export interface PptxEmbeddedFont {
  name: string;
  dataUrl: string;
  bold?: boolean;
  italic?: boolean;
  /** CSS font format hint (e.g. "truetype", "opentype"). */
  format?: "truetype" | "opentype" | "woff" | "woff2";
}
