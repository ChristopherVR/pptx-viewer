/**
 * Type definitions for the PptxSlideLoaderService.
 * Extracted to keep the service file under the 300-line limit.
 */
import type { XMLParser } from "fast-xml-parser";
import type JSZip from "jszip";
import type {
  PptxComment,
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

export interface PptxMediaTimingEntry {
  trimStartMs?: number;
  trimEndMs?: number;
  fullScreen?: boolean;
  loop?: boolean;
  posterFramePath?: string;
}

export type PptxMediaTimingMap = Map<string, PptxMediaTimingEntry>;

export interface PptxSlideNotesResult {
  notes?: string;
  notesSegments?: TextSegment[];
}

export interface PptxSlideLoaderThemeOverride {
  colorOverrides?: Record<string, string>;
  formatSchemeOverride?: PptxThemeFormatScheme;
}

export interface PptxSlideLoaderParams {
  presentationData: XmlObject;
  parser: XMLParser;
  zip: JSZip;
  compatibilityService: IPptxCompatibilityService;
  slideMap: Map<string, XmlObject>;
  sectionBySlideId: Map<string, { sectionId: string; sectionName: string }>;
  setOrderedSlidePaths: (paths: string[]) => void;
  loadSlideRelationships: (
    slidePath: string,
    slideRelsPath: string,
  ) => Promise<void>;
  parseSlideClrMapOverride: (
    slideXml: XmlObject,
  ) => Record<string, string> | null;
  setCurrentSlideClrMapOverride: (
    override: Record<string, string> | null,
  ) => void;
  findLayoutPathForSlide: (slidePath: string) => string | undefined;
  loadThemeOverride: (
    partBasePath: string,
  ) => Promise<PptxSlideLoaderThemeOverride | null>;
  applyThemeOverrideState: (
    override: PptxSlideLoaderThemeOverride,
  ) => () => void;
  getLayoutElements: (slidePath: string) => Promise<PptxElement[]>;
  parseSlide: (
    slideXml: XmlObject,
    slidePath: string,
  ) => Promise<PptxElement[]>;
  extractMediaTimingMap: (
    slideXml: XmlObject,
    slidePath: string,
  ) => PptxMediaTimingMap;
  enrichMediaElementsWithTiming: (
    elements: PptxElement[],
    timingMap: PptxMediaTimingMap,
  ) => Promise<void>;
  extractBackgroundColor: (slideXml: XmlObject) => string | undefined;
  getLayoutBackgroundColor: (slidePath: string) => Promise<string | undefined>;
  extractBackgroundGradient: (slideXml: XmlObject) => string | undefined;
  getLayoutBackgroundGradient: (
    slidePath: string,
  ) => Promise<string | undefined>;
  extractBackgroundImage: (
    slideXml: XmlObject,
    slidePath: string,
  ) => Promise<string | undefined>;
  getLayoutBackgroundImage: (slidePath: string) => Promise<string | undefined>;
  extractSlideNotes: (slidePath: string) => Promise<PptxSlideNotesResult>;
  extractSlideComments: (slidePath: string) => Promise<PptxComment[]>;
  extractModernSlideComments: (slidePath: string) => Promise<PptxComment[]>;
  extractBackgroundShowAnimation: (slideXml: XmlObject) => boolean | undefined;
  extractShowMasterShapes: (slideXml: XmlObject) => boolean | undefined;
  isSlideHidden: (
    slideXml: XmlObject,
    slideIdEntry: XmlObject | undefined,
  ) => boolean;
  parseSlideTransition: (
    slideXml: XmlObject,
    slidePath: string,
  ) => PptxSlideTransition | undefined;
  parseEditorAnimations: (
    slideXml: XmlObject,
  ) => PptxElementAnimation[] | undefined;
  parseNativeAnimations: (
    slideXml: XmlObject,
  ) => PptxNativeAnimation[] | undefined;
  getSmartArtDataForGraphicFrame: (
    slidePath: string,
    graphicFrame: XmlObject | undefined,
  ) => Promise<PptxSmartArtData | undefined>;
}

export interface IPptxSlideLoaderService {
  loadSlides(params: PptxSlideLoaderParams): Promise<PptxSlide[]>;
}
