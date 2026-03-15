/**
 * @fileoverview Base state class for the PptxHandlerRuntime mixin chain.
 *
 * This file defines the root of the runtime class hierarchy. It holds all
 * shared, mutable state — caches, ZIP handle, XML parser/builder, theme
 * data, relationship maps, and references to injected services/builders.
 *
 * Every other runtime mixin file extends this class (directly or
 * transitively) and adds methods that read from or write to these
 * protected fields.
 *
 * **Design rationale**: Concentrating state in a single base class makes
 * it easy to audit what is shared, avoids duplicated field declarations
 * across mixins, and keeps the constructor (in
 * {@link PptxHandlerRuntimeImplementation}) as the sole place where
 * services are wired up.
 */

import JSZip from "jszip";
import { XMLBuilder, XMLParser } from "fast-xml-parser";
import {
  PlaceholderDefaults,
  PptxElement,
  PptxLayoutOption,
  XmlObject,
  type PptxCommentAuthor,
  type PptxCustomXmlPart,
  type PptxEmbeddedFont,
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
import {
  SignatureDetectionResult,
  normalizeStrictXml,
  detectStrictConformance,
} from "../../utils";

/**
 * Root state class for the PptxHandlerRuntime mixin chain.
 *
 * Contains all protected fields that are shared across the runtime's
 * parsing, saving, and editing methods. No business logic lives here —
 * only field declarations, default values, and constants.
 *
 * Fields annotated with `!` (definite assignment) are initialised in
 * the constructor of the final concrete class
 * ({@link PptxHandlerRuntimeImplementation}).
 */
export class PptxHandlerRuntime {
  /** The in-memory ZIP archive representing the OPC (.pptx) package. */
  protected zip!: JSZip;

  /** fast-xml-parser instance used to parse XML strings into JS objects. */
  protected parser!: XMLParser;

  /** fast-xml-parser builder used to serialize JS objects back to XML strings. */
  protected builder!: XMLBuilder;

  /** Parsed `ppt/presentation.xml` root object. `null` before load. */
  protected presentationData: XmlObject | null = null;

  /** Cached slide XML objects keyed by slide archive path (e.g. "ppt/slides/slide1.xml"). */
  protected slideMap: Map<string, XmlObject> = new Map();

  /** Per-slide relationship maps: slide path -> (rId -> target path). */
  protected slideRelsMap: Map<string, Map<string, string>> = new Map();

  /** Tracks relationship IDs with TargetMode="External" per slide/part path. */
  protected externalRelsMap: Map<string, Set<string>> = new Map();

  /** Cached parsed layout elements keyed by layout archive path. */
  protected layoutCache: Map<string, PptxElement[]> = new Map();

  /** Cached parsed master elements keyed by master archive path. */
  protected masterCache: Map<string, PptxElement[]> = new Map();

  /** Raw parsed layout XML objects keyed by layout archive path. */
  protected layoutXmlMap: Map<string, XmlObject> = new Map();

  /** Raw parsed master XML objects keyed by master archive path. */
  protected masterXmlMap: Map<string, XmlObject> = new Map();

  /** Placeholder defaults from layouts, keyed by layout path -> placeholder key. */
  protected layoutPlaceholderDefaultsCache: Map<
    string,
    Map<string, PlaceholderDefaults>
  > = new Map();

  /** Placeholder defaults from masters, keyed by master path -> placeholder key. */
  protected masterPlaceholderDefaultsCache: Map<
    string,
    Map<string, PlaceholderDefaults>
  > = new Map();

  /** Presentation-level default text style (`p:defaultTextStyle`) fallback. */
  protected presentationDefaultTextStyle: PlaceholderDefaults | undefined;

  /** Cache of decoded image data URIs keyed by image archive path. */
  protected imageDataCache: Map<string, string> = new Map();

  /** When true, images are decoded to base64 data URIs eagerly during load. */
  protected eagerDecodeImages = true;

  /** Ordered slide file paths (populated during load for action target resolution). */
  protected orderedSlidePaths: string[] = [];

  /** Theme colour scheme map: scheme key (e.g. "dk1", "accent1") -> hex colour value. */
  protected themeColorMap: Record<string, string> = {};

  /** Theme font map: font slot key (e.g. "mj-lt", "mn-ea") -> typeface name. */
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

  /** Thumbnail image data from `docProps/thumbnail.jpeg` preserved for round-trip. */
  protected thumbnailData: Uint8Array | null = null;

  /** Raw VBA project binary preserved for macro-enabled (.pptm) round-trip. */
  protected vbaProjectBin: Uint8Array | null = null;

  /** Additional VBA-related part paths (e.g. vbaData.xml) to preserve during save. */
  protected vbaRelatedParts: Map<string, Uint8Array> = new Map();

  /** Detected digital signature information (populated during load). */
  protected signatureDetection: SignatureDetectionResult | null = null;

  /** Custom XML data parts parsed from `customXml/` in the OPC package. */
  protected customXmlParts: PptxCustomXmlPart[] = [];

  /** Embedded fonts extracted during load, preserved for automatic re-embedding on save. */
  protected loadedEmbeddedFonts: PptxEmbeddedFont[] = [];

  /** Map of comment author IDs to display names (from `ppt/commentAuthors.xml`). */
  protected commentAuthorMap: Map<string, string> = new Map();

  /** Full comment author details keyed by author ID, preserving initials/lastIdx/clrIdx for round-trip. */
  protected commentAuthorDetails: Map<string, PptxCommentAuthor> = new Map();

  /** Available slide layout options collected during load. */
  protected layoutOptions: PptxLayoutOption[] = [];

  // ── Injected services ──────────────────────────────────────────────

  /** Service for tracking and reporting compatibility warnings. */
  protected compatibilityService!: IPptxCompatibilityService;

  /** Service for loading individual slides from the ZIP archive. */
  protected slideLoaderService!: IPptxSlideLoaderService;

  /** Service for parsing slide transition definitions. */
  protected slideTransitionService!: IPptxSlideTransitionService;

  /** Service for parsing editor-authored animation definitions. */
  protected editorAnimationService!: IPptxEditorAnimationService;

  /** Service for parsing native PowerPoint animation timing XML. */
  protected nativeAnimationService!: IPptxNativeAnimationService;

  /** Service for writing animation XML back into slides during save. */
  protected animationWriteService!: IPptxAnimationWriteService;

  /** Service for managing template (layout/master) background colours. */
  protected templateBackgroundService!: IPptxTemplateBackgroundService;

  /** Service for XML element lookups and namespace-aware queries. */
  protected xmlLookupService!: IPptxXmlLookupService;

  /** Factory for creating runtime dependency instances (parser, builder, services). */
  protected dependencyFactory!: IPptxRuntimeDependencyFactory;

  // ── Presentation dimensions ────────────────────────────────────────

  /** Slide width in EMU as read from `p:sldSz/@_cx`. */
  protected rawSlideWidthEmu = 0;

  /** Slide height in EMU as read from `p:sldSz/@_cy`. */
  protected rawSlideHeightEmu = 0;

  /** Slide size type as read from `p:sldSz/@_type` (e.g. "screen4x3", "custom"). */
  protected rawSlideSizeType: string | undefined;

  // ── Builders and codecs ────────────────────────────────────────────

  /** Builder for creating new element XML (shapes, connectors, pictures). */
  protected elementXmlBuilder!: PptxElementXmlBuilder;

  /** Builder for updating `[Content_Types].xml` entries. */
  protected contentTypesBuilder!: IPptxContentTypesBuilder;

  /** Updater that applies position/size/rotation transforms to element XML. */
  protected elementTransformUpdater!: IPptxElementTransformUpdater;

  /** Builder that applies save-time options to the presentation XML. */
  protected presentationSaveBuilder!: IPptxPresentationSaveBuilder;

  /** Reconciler that synchronises the slide list in presentation XML during save. */
  protected presentationSlidesReconciler!: IPptxPresentationSlidesReconciler;

  /** Builder for slide background XML nodes. */
  protected slideBackgroundBuilder!: IPptxSlideBackgroundBuilder;

  /** Writer for legacy comment parts (`ppt/comments/commentN.xml`). */
  protected slideCommentPartWriter!: IPptxSlideCommentPartWriter;

  /** Builder for media relationship entries in slide .rels files. */
  protected slideMediaRelationshipBuilder!: IPptxSlideMediaRelationshipBuilder;

  /** Updater for slide notes parts (`ppt/notesSlides/`). */
  protected slideNotesPartUpdater!: IPptxSlideNotesPartUpdater;

  /** Factory for creating slide comment XML elements. */
  protected slideCommentsXmlFactory!: IPptxSlideCommentsXmlFactory;

  /** Factory for creating comment author XML elements. */
  protected commentAuthorsXmlFactory!: IPptxCommentAuthorsXmlFactory;

  /** Codec for reading/writing colour style XML (solid, gradient, pattern fills). */
  protected colorStyleCodec!: IPptxColorStyleCodec;

  /** Parser for connector shape XML (`p:cxnSp`). */
  protected connectorParser!: IPptxConnectorParser;

  /** Extractor for shape style properties (fill, stroke, effects). */
  protected shapeStyleExtractor!: IPptxShapeStyleExtractor;

  /** Parser for table data from `a:tbl` graphic frames. */
  protected tableDataParser!: IPptxTableDataParser;

  /** Parser for media data (audio/video) from graphic frames. */
  protected mediaDataParser!: IPptxMediaDataParser;

  /** Parser for generic graphic frames (tables, charts, OLE, media). */
  protected graphicFrameParser!: IPptxGraphicFrameParser;

  /** Updater for OPC core/app/custom document property parts. */
  protected documentPropertiesUpdater!: PptxDocumentPropertiesUpdater;

  // ── Constants ──────────────────────────────────────────────────────

  /**
   * Conversion factor: English Metric Units per CSS pixel.
   * 1 inch = 914400 EMU = 96 px, so 1 px = 9525 EMU.
   */
  protected static EMU_PER_PX = 9525;

  /** URI used as the `@_uri` attribute for our custom editor-meta extension in `p:extLst`. */
  protected static EDITOR_META_EXTENSION_URI =
    "{A6F62C1B-B45C-4E8A-8B0A-1B3E5F8C8D4A}";

  /** XML namespace URI for the `pptx:` prefix in the slide XML. */
  protected static EDITOR_META_NAMESPACE_URI =
    "http://schemas.pptx.ai/pptx/editor-meta";

  /**
   * Whether the loaded file uses Strict Open XML conformance class.
   * When true, all parsed XML is automatically normalized to Transitional
   * namespace URIs so the rest of the codebase needs no changes.
   */
  protected isStrictOoxml = false;

  /** The original (unwrapped) XML parser, preserved for restore on next load. */
  private _originalParser: XMLParser | null = null;

  /**
   * Detect Strict Open XML conformance from a parsed XML object.
   * If detected, normalizes the already-parsed object in place and wraps
   * `this.parser` with a Proxy that auto-normalizes all future `parse()`
   * results. This ensures the entire codebase — all 50+ `this.parser.parse()`
   * call sites — transparently receives Transitional namespace URIs.
   */
  protected detectAndSetStrictConformance(xmlObj: XmlObject): void {
    if (!detectStrictConformance(xmlObj as Record<string, unknown>)) {
      return;
    }

    this.isStrictOoxml = true;

    // Normalize the already-parsed presentation XML in place
    normalizeStrictXml(xmlObj as Record<string, unknown>);

    // Wrap this.parser so every subsequent parse() call auto-normalizes
    if (!this._originalParser) {
      this._originalParser = this.parser;
      const original = this.parser;
      this.parser = new Proxy(original, {
        get(target, prop, receiver) {
          if (prop === "parse") {
            return function (xmlData: string, validationOption?: boolean) {
              const result = target.parse(xmlData, validationOption);
              if (typeof result === "object" && result !== null) {
                normalizeStrictXml(result as Record<string, unknown>);
              }
              return result;
            };
          }
          return Reflect.get(target, prop, receiver);
        },
      });
    }
  }

  /**
   * Restore the original (unwrapped) parser. Called during
   * `initializeLoadSession` to reset state for the next load.
   */
  protected restoreOriginalParser(): void {
    if (this._originalParser) {
      this.parser = this._originalParser;
      this._originalParser = null;
    }
  }
}
