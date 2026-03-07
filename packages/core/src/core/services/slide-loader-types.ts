/**
 * Type definitions for the PptxSlideLoaderService.
 * Extracted to keep the service file under the 300-line limit.
 *
 * @module slide-loader-types
 */
import type { XMLParser } from "fast-xml-parser";
import type JSZip from "jszip";
import type {
  PptxComment,
  PptxCustomerData,
  PptxElement,
  PptxElementAnimation,
  PptxNativeAnimation,
  PptxSlide,
  PptxSlideTransition,
  PptxSmartArtData,
  PptxThemeFormatScheme,
  TextSegment,
  XmlObject,
} from "../types";
import type { IPptxCompatibilityService } from "./PptxCompatibilityService";

/**
 * Media timing metadata for a single media element within a slide.
 * Captures trim points, looping, full-screen, and poster frame information.
 */
export interface PptxMediaTimingEntry {
  /** Start trim offset in milliseconds. */
  trimStartMs?: number;
  /** End trim offset in milliseconds. */
  trimEndMs?: number;
  /** Whether the media should play in full-screen mode. */
  fullScreen?: boolean;
  /** Whether the media should loop continuously. */
  loop?: boolean;
  /** Path to the poster frame image within the .pptx archive. */
  posterFramePath?: string;
}

/**
 * Map from media element identifier (relationship ID or shape ID) to its
 * timing metadata.
 */
export type PptxMediaTimingMap = Map<string, PptxMediaTimingEntry>;

/**
 * Result of extracting speaker notes from a slide.
 */
export interface PptxSlideNotesResult {
  /** Plain-text representation of the notes. */
  notes?: string;
  /** Rich text segments preserving formatting. */
  notesSegments?: TextSegment[];
}

/**
 * Theme override information for a slide that differs from the master theme.
 * Used when a layout or slide has its own color map or format scheme.
 */
export interface PptxSlideLoaderThemeOverride {
  /** Color scheme overrides mapping theme color names to hex values. */
  colorOverrides?: Record<string, string>;
  /** Format scheme override (fill, line, effect styles). */
  formatSchemeOverride?: PptxThemeFormatScheme;
}

/**
 * Parameter bundle for {@link IPptxSlideLoaderService.loadSlides}.
 *
 * Aggregates all dependencies and callbacks the slide loader needs to
 * parse, enrich, and assemble slide data from the PPTX archive.
 */
export interface PptxSlideLoaderParams {
  /** Parsed root presentation XML object. */
  presentationData: XmlObject;
  /** XML parser instance for parsing raw XML strings. */
  parser: XMLParser;
  /** JSZip instance representing the opened .pptx archive. */
  zip: JSZip;
  /** Service for inspecting and reporting compatibility warnings. */
  compatibilityService: IPptxCompatibilityService;
  /** Mutable map storing parsed slide XML keyed by slide path. */
  slideMap: Map<string, XmlObject>;
  /** Map from slide numeric ID to its section metadata. */
  sectionBySlideId: Map<string, { sectionId: string; sectionName: string }>;
  /** Callback to register the ordered array of slide file paths. */
  setOrderedSlidePaths: (paths: string[]) => void;
  /** Load relationship data for a specific slide. */
  loadSlideRelationships: (
    slidePath: string,
    slideRelsPath: string,
  ) => Promise<void>;
  /** Parse color map override from slide XML, if present. */
  parseSlideClrMapOverride: (
    slideXml: XmlObject,
  ) => Record<string, string> | null;
  /** Set the active color map override for the current slide being parsed. */
  setCurrentSlideClrMapOverride: (
    override: Record<string, string> | null,
  ) => void;
  /** Resolve the layout file path associated with a given slide path. */
  findLayoutPathForSlide: (slidePath: string) => string | undefined;
  /** Load theme override data from a layout or slide part. */
  loadThemeOverride: (
    partBasePath: string,
  ) => Promise<PptxSlideLoaderThemeOverride | null>;
  /** Apply a theme override and return a restore function to revert it. */
  applyThemeOverrideState: (
    override: PptxSlideLoaderThemeOverride,
  ) => () => void;
  /** Retrieve parsed layout elements inherited by a slide. */
  getLayoutElements: (slidePath: string) => Promise<PptxElement[]>;
  /** Parse a slide XML object into an array of presentation elements. */
  parseSlide: (
    slideXml: XmlObject,
    slidePath: string,
  ) => Promise<PptxElement[]>;
  /** Extract media timing metadata from a slide's XML. */
  extractMediaTimingMap: (
    slideXml: XmlObject,
    slidePath: string,
  ) => PptxMediaTimingMap;
  /** Enrich media elements with trim, loop, and poster frame info. */
  enrichMediaElementsWithTiming: (
    elements: PptxElement[],
    timingMap: PptxMediaTimingMap,
  ) => Promise<void>;
  /** Extract solid background color from slide XML. */
  extractBackgroundColor: (slideXml: XmlObject) => string | undefined;
  /** Get background color from the slide's layout (fallback). */
  getLayoutBackgroundColor: (slidePath: string) => Promise<string | undefined>;
  /** Extract gradient background CSS from slide XML. */
  extractBackgroundGradient: (slideXml: XmlObject) => string | undefined;
  /** Get gradient background from the slide's layout (fallback). */
  getLayoutBackgroundGradient: (
    slidePath: string,
  ) => Promise<string | undefined>;
  /** Extract background image data URI from slide XML. */
  extractBackgroundImage: (
    slideXml: XmlObject,
    slidePath: string,
  ) => Promise<string | undefined>;
  /** Get background image from the slide's layout (fallback). */
  getLayoutBackgroundImage: (slidePath: string) => Promise<string | undefined>;
  /** Extract speaker notes text and rich segments from a slide. */
  extractSlideNotes: (slidePath: string) => Promise<PptxSlideNotesResult>;
  /** Extract legacy (pre-Office 2021) comments from a slide. */
  extractSlideComments: (slidePath: string) => Promise<PptxComment[]>;
  /** Extract modern (Office 2021+) threaded comments from a slide. */
  extractModernSlideComments: (slidePath: string) => Promise<PptxComment[]>;
  /** Check whether background shapes should animate. */
  extractBackgroundShowAnimation: (slideXml: XmlObject) => boolean | undefined;
  /** Check whether master slide shapes should be shown. */
  extractShowMasterShapes: (slideXml: XmlObject) => boolean | undefined;
  /** Determine if a slide is marked as hidden. */
  isSlideHidden: (
    slideXml: XmlObject,
    slideIdEntry: XmlObject | undefined,
  ) => boolean;
  /** Parse the slide transition from slide XML. */
  parseSlideTransition: (
    slideXml: XmlObject,
    slidePath: string,
  ) => PptxSlideTransition | undefined;
  /** Parse editor-level animation definitions from slide XML. */
  parseEditorAnimations: (
    slideXml: XmlObject,
  ) => PptxElementAnimation[] | undefined;
  /** Parse native OOXML animation timing trees from slide XML. */
  parseNativeAnimations: (
    slideXml: XmlObject,
  ) => PptxNativeAnimation[] | undefined;
  /** Resolve SmartArt data for a graphic frame element. */
  getSmartArtDataForGraphicFrame: (
    slidePath: string,
    graphicFrame: XmlObject | undefined,
  ) => Promise<PptxSmartArtData | undefined>;
  /** Parse customer data tags from a slide's `p:custDataLst`. */
  parseSlideCustomerData: (
    slideXml: XmlObject,
    slidePath: string,
  ) => Promise<PptxCustomerData[]>;
}

/**
 * Service interface for loading all slides from a PPTX presentation.
 */
export interface IPptxSlideLoaderService {
  /**
   * Load and parse all slides from the presentation archive.
   * @param params - Bundle of dependencies and callbacks for slide parsing.
   * @returns Array of fully parsed slide objects in presentation order.
   */
  loadSlides(params: PptxSlideLoaderParams): Promise<PptxSlide[]>;
}
