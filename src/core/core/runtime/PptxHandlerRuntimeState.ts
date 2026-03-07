import JSZip from "jszip";
import { XMLBuilder, XMLParser } from "fast-xml-parser";
import {
  PlaceholderDefaults,
  PptxElement,
  PptxLayoutOption,
  XmlObject,
  type PptxThemeFormatScheme,
} from "../../types";
import { PptxElementXmlBuilder } from "../../builders/PptxElementXmlBuilder";
import {
  type IPptxCompatibilityService,
  type IPptxEditorAnimationService,
  type IPptxNativeAnimationService,
  type IPptxAnimationWriteService,
  type IPptxSlideLoaderService,
  type IPptxSlideTransitionService,
  type IPptxTemplateBackgroundService,
  type IPptxXmlLookupService,
  type PptxDocumentPropertiesUpdater,
} from "../../services";
import {
  type IPptxColorStyleCodec,
  type IPptxCommentAuthorsXmlFactory,
  type IPptxConnectorParser,
  type IPptxContentTypesBuilder,
  type IPptxElementTransformUpdater,
  type IPptxGraphicFrameParser,
  type IPptxMediaDataParser,
  type IPptxPresentationSaveBuilder,
  type IPptxPresentationSlidesReconciler,
  type IPptxShapeStyleExtractor,
  type IPptxSlideBackgroundBuilder,
  type IPptxSlideCommentPartWriter,
  type IPptxSlideCommentsXmlFactory,
  type IPptxSlideMediaRelationshipBuilder,
  type IPptxSlideNotesPartUpdater,
  type IPptxTableDataParser,
} from "../builders";
import { type IPptxRuntimeDependencyFactory } from "../factories";
import { SignatureDetectionResult } from "../../utils";

export class PptxHandlerRuntime {
  protected zip!: JSZip;

  protected parser!: XMLParser;

  protected builder!: XMLBuilder;

  protected presentationData: XmlObject | null = null;

  protected slideMap: Map<string, XmlObject> = new Map();

  protected slideRelsMap: Map<string, Map<string, string>> = new Map();

  protected layoutCache: Map<string, PptxElement[]> = new Map();

  protected masterCache: Map<string, PptxElement[]> = new Map();

  protected layoutXmlMap: Map<string, XmlObject> = new Map();

  protected masterXmlMap: Map<string, XmlObject> = new Map();

  protected layoutPlaceholderDefaultsCache: Map<
    string,
    Map<string, PlaceholderDefaults>
  > = new Map();

  protected masterPlaceholderDefaultsCache: Map<
    string,
    Map<string, PlaceholderDefaults>
  > = new Map();

  /** Presentation-level default text style (`p:defaultTextStyle`) fallback. */
  protected presentationDefaultTextStyle: PlaceholderDefaults | undefined;

  protected imageDataCache: Map<string, string> = new Map();

  protected eagerDecodeImages = true;

  /** Ordered slide file paths (populated during load for action target resolution). */
  protected orderedSlidePaths: string[] = [];

  protected themeColorMap: Record<string, string> = {};

  protected themeFontMap: Record<string, string> = {};

  /** Parsed format scheme from `a:fmtScheme` — fill, line and effect style matrices. */
  protected themeFormatScheme!: PptxThemeFormatScheme | undefined;

  /** Cache of loaded theme override XML parts keyed by the override file path. */
  protected themeOverrideCache: Map<
    string,
    {
      colorOverrides?: Record<string, string>;
      formatSchemeOverride?: PptxThemeFormatScheme;
    }
  > = new Map();

  /**
   * Temporarily holds the per-slide colour map override while parsing a
   * slide's elements so that `resolveThemeColor` can respect
   * `p:clrMapOvr / a:overrideClrMapping`.
   */
  protected currentSlideClrMapOverride: Record<string, string> | null = null;

  /** Raw VBA project binary preserved for macro-enabled (.pptm) round-trip. */
  protected vbaProjectBin: Uint8Array | null = null;

  /** Additional VBA-related part paths (e.g. vbaData.xml) to preserve during save. */
  protected vbaRelatedParts: Map<string, Uint8Array> = new Map();

  /** Detected digital signature information (populated during load). */
  protected signatureDetection: SignatureDetectionResult | null = null;

  protected commentAuthorMap: Map<string, string> = new Map();

  protected layoutOptions: PptxLayoutOption[] = [];

  protected compatibilityService!: IPptxCompatibilityService;

  protected slideLoaderService!: IPptxSlideLoaderService;

  protected slideTransitionService!: IPptxSlideTransitionService;

  protected editorAnimationService!: IPptxEditorAnimationService;

  protected nativeAnimationService!: IPptxNativeAnimationService;

  protected animationWriteService!: IPptxAnimationWriteService;

  protected templateBackgroundService!: IPptxTemplateBackgroundService;

  protected xmlLookupService!: IPptxXmlLookupService;

  protected dependencyFactory!: IPptxRuntimeDependencyFactory;

  protected rawSlideWidthEmu = 0;

  protected rawSlideHeightEmu = 0;

  protected elementXmlBuilder!: PptxElementXmlBuilder;

  protected contentTypesBuilder!: IPptxContentTypesBuilder;

  protected elementTransformUpdater!: IPptxElementTransformUpdater;

  protected presentationSaveBuilder!: IPptxPresentationSaveBuilder;

  protected presentationSlidesReconciler!: IPptxPresentationSlidesReconciler;

  protected slideBackgroundBuilder!: IPptxSlideBackgroundBuilder;

  protected slideCommentPartWriter!: IPptxSlideCommentPartWriter;

  protected slideMediaRelationshipBuilder!: IPptxSlideMediaRelationshipBuilder;

  protected slideNotesPartUpdater!: IPptxSlideNotesPartUpdater;

  protected slideCommentsXmlFactory!: IPptxSlideCommentsXmlFactory;

  protected commentAuthorsXmlFactory!: IPptxCommentAuthorsXmlFactory;

  protected colorStyleCodec!: IPptxColorStyleCodec;

  protected connectorParser!: IPptxConnectorParser;

  protected shapeStyleExtractor!: IPptxShapeStyleExtractor;

  protected tableDataParser!: IPptxTableDataParser;

  protected mediaDataParser!: IPptxMediaDataParser;

  protected graphicFrameParser!: IPptxGraphicFrameParser;

  protected documentPropertiesUpdater!: PptxDocumentPropertiesUpdater;

  protected static EMU_PER_PX = 9525;

  /** URI used as the `@_uri` attribute for our custom editor-meta extension in `p:extLst`. */
  protected static EDITOR_META_EXTENSION_URI =
    "{A6F62C1B-B45C-4E8A-8B0A-1B3E5F8C8D4A}";

  /** XML namespace URI for the `fuzor:` prefix in the slide XML. */
  protected static EDITOR_META_NAMESPACE_URI =
    "http://schemas.fuzor.ai/pptx/editor-meta";
}
