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

import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import JSZip from 'jszip';

import { PptxElementXmlBuilder } from '../../builders/PptxElementXmlBuilder';
import type {
	IPptxCompatibilityService,
	IPptxEditorAnimationService,
	IPptxNativeAnimationService,
	IPptxAnimationWriteService,
	IPptxSlideLoaderService,
	IPptxSlideTransitionService,
	IPptxTemplateBackgroundService,
	IPptxXmlLookupService,
	PptxDocumentPropertiesUpdater,
} from '../../services';
import { PlaceholderDefaults, PptxElement, PptxLayoutOption, XmlObject } from '../../types';
import type {
	PptxCommentAuthor,
	PptxModernCommentAuthor,
	PptxCustomXmlPart,
	PptxEmbeddedFont,
	PptxMasterTextStyles,
	PptxThemeFormatScheme,
	PptxThemeObjectDefaults,
	PptxViewProperties,
} from '../../types';
import { SignatureDetectionResult, normalizeStrictXml, detectStrictConformance } from '../../utils';
import type { AlternateContentBlock } from '../../utils';
import type {
	IPptxColorStyleCodec,
	IPptxCommentAuthorsXmlFactory,
	IPptxConnectorParser,
	IPptxContentTypesBuilder,
	IPptxElementTransformUpdater,
	IPptxGraphicFrameParser,
	IPptxMediaDataParser,
	IPptxPresentationSaveBuilder,
	IPptxPresentationSlidesReconciler,
	IPptxShapeStyleExtractor,
	IPptxSlideBackgroundBuilder,
	IPptxSlideCommentPartWriter,
	IPptxSlideCommentsXmlFactory,
	IPptxSlideMediaRelationshipBuilder,
	IPptxSlideNotesPartUpdater,
	IPptxTableDataParser,
} from '../builders';
import type { IPptxRuntimeDependencyFactory } from '../factories';

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
	protected layoutPlaceholderDefaultsCache: Map<string, Map<string, PlaceholderDefaults>> =
		new Map();

	/** Placeholder defaults from masters, keyed by master path -> placeholder key. */
	protected masterPlaceholderDefaultsCache: Map<string, Map<string, PlaceholderDefaults>> =
		new Map();

	/** Presentation-level default text style (`p:defaultTextStyle`) fallback. */
	protected presentationDefaultTextStyle: PlaceholderDefaults | undefined;

	/** Cache of decoded image URLs keyed by image archive path. */
	protected imageDataCache: Map<string, string> = new Map();

	/**
	 * Tracks Blob URLs created by {@link createImageUrl} so they can be
	 * revoked when the handler is disposed or re-loaded.
	 */
	protected blobUrlCache: Set<string> = new Set();

	/**
	 * When true, images are decoded eagerly during load (slower initial
	 * load but images are immediately available).  When false (default),
	 * images are decoded lazily on first access via {@link getImageData}.
	 */
	protected eagerDecodeImages = false;

	/**
	 * When true, relationship targets pointing at `http://` / `https://`
	 * URLs are passed through to `<img src>`. Default `false`. Mirrors the
	 * `allowExternalImages` load option.
	 */
	protected allowExternalImages = false;

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

	/**
	 * Per-master colour map alias dictionaries parsed from each master's
	 * `<p:clrMap>` element (e.g. `bg1 → lt1`, `tx1 → dk1`, `accent1 → accent1`).
	 *
	 * `clrMap` is the *aliasing* layer between logical colour names used in
	 * DrawingML and the raw theme scheme slots. Per ECMA-376 §19.3.1.7 it
	 * lives on each `p:sldMaster`, and slide layouts/slides may further
	 * override it via `p:clrMapOvr`. Resolution must happen at colour-lookup
	 * time, *not* by baking it into {@link themeColorMap}.
	 *
	 * Phase 2 Stream B / C-H4.
	 */
	protected masterClrMaps: Map<string, Record<string, string>> = new Map();

	/**
	 * Per-master theme color maps. Each master may reference its own theme
	 * file via `_rels/slideMasterN.xml.rels`. For multi-master decks, slides
	 * must resolve scheme colours against their *own* master's theme.
	 *
	 * Falls back to {@link themeColorMap} when a master entry is missing.
	 *
	 * Phase 2 Stream B / C-H4.
	 */
	protected masterThemeColorMaps: Map<string, Record<string, string>> = new Map();

	/**
	 * Per-master theme font maps. Same rationale as
	 * {@link masterThemeColorMaps}: multi-master decks may have one font
	 * scheme per theme.
	 */
	protected masterThemeFontMaps: Map<string, Record<string, string>> = new Map();

	/**
	 * Per-master format schemes (fmtScheme). For multi-master decks each
	 * master's slides should resolve fill/line/effect refs against the
	 * matrix from that master's theme.
	 */
	protected masterThemeFormatSchemes: Map<string, PptxThemeFormatScheme> = new Map();

	/**
	 * Per-master mapping from slide-master path to the theme path it
	 * references via `_rels/slideMasterN.xml.rels`. Populated by
	 * {@link loadPerMasterThemes} during load. Used by the save-side
	 * theme writer to know which themeN.xml to (re)emit for each master.
	 *
	 * Phase 4 Stream A / C-H3.
	 */
	protected masterThemePaths: Map<string, string> = new Map();

	/**
	 * Per-script font tables for major and minor fonts. Captured per master
	 * theme. Keys are master paths; values map `mj`/`mn` -> script tag (e.g.
	 * `Hans`, `Hant`, `Arab`, `Hebr`, `Thai`, `Beng`, …) -> typeface name.
	 *
	 * Phase 4 Stream A / M4.
	 */
	protected masterThemeMajorFontScripts: Map<string, Record<string, string>> = new Map();
	protected masterThemeMinorFontScripts: Map<string, Record<string, string>> = new Map();

	/**
	 * Theme name attribute (`<a:theme @name>`) per master theme path.
	 * Captured for byte-stable round-trip.
	 */
	protected masterThemeNames: Map<string, string> = new Map();
	/**
	 * `<a:fontScheme @name>` per master theme path.
	 */
	protected masterThemeFontSchemeNames: Map<string, string> = new Map();
	/**
	 * `<a:clrScheme @name>` per master theme path.
	 */
	protected masterThemeColorSchemeNames: Map<string, string> = new Map();

	/**
	 * Raw original theme XML keyed by theme path. Captured at load-time.
	 * Used by the save pipeline to passthrough the full theme XML when no
	 * in-memory mutation has occurred — preserving fillStyleLst /
	 * lnStyleLst / effectStyleLst / bgFillStyleLst /
	 * extraClrSchemeLst / objectDefaults / extLst exactly as written.
	 *
	 * Phase 4 Stream A / C-H3.
	 */
	protected originalThemeXmlByPath: Map<string, string> = new Map();

	/**
	 * Set of theme paths whose in-memory state has been mutated since
	 * load. Saving a theme path that's NOT dirty is a no-op (the original
	 * file already exists in the ZIP). Saving a dirty theme path
	 * regenerates the part from in-memory state.
	 *
	 * Phase 4 Stream A / C-H3.
	 */
	protected dirtyThemePaths: Set<string> = new Set();

	/**
	 * Per-master parsed `<p:txStyles>` (titleStyle/bodyStyle/otherStyle).
	 * Populated by {@link enrichSlideMastersWithTxStyles} during load so the
	 * inheritance chain can find the master text-style cascade without
	 * re-parsing master XML on every lookup. Phase 4 Stream B / P-H1.
	 */
	protected masterTxStylesCache: Map<string, PptxMasterTextStyles> = new Map();

	/**
	 * Captured `<a:objectDefaults>` snapshot per master theme path. The
	 * full ECMA-376 inheritance chain (master / layout / placeholder /
	 * objectDefaults) is non-trivial; we store the raw spDef/lnDef/txDef
	 * subtrees and re-emit them verbatim for round-trip.
	 *
	 * Phase 4 Stream A / M5.
	 */
	protected masterThemeObjectDefaults: Map<string, PptxThemeObjectDefaults> = new Map();

	/**
	 * Captured `<a:extraClrSchemeLst>` raw subtree per master theme path
	 * for verbatim round-trip.
	 *
	 * Phase 4 Stream A.
	 */
	protected masterThemeExtraClrSchemeLst: Map<string, unknown> = new Map();

	/**
	 * Captured `<a:custClrLst>` raw subtree per master theme path
	 * for verbatim round-trip.
	 *
	 * Phase 4 Stream A.
	 */
	protected masterThemeCustClrLst: Map<string, unknown> = new Map();

	/**
	 * Captured theme-level `<a:extLst>` raw subtree per master theme path.
	 */
	protected masterThemeExtLst: Map<string, unknown> = new Map();

	/**
	 * Active master's clrMap for the slide currently being parsed.  Walked
	 * after `currentSlideClrMapOverride` (slide and layout overrides take
	 * precedence). `null` means "fall through to themeColorMap directly".
	 */
	protected currentMasterClrMap: Record<string, string> | null = null;

	/**
	 * Snapshot of the global theme state taken right after
	 * {@link loadThemeData} completes. Used as the fallback when a slide's
	 * master has no per-master theme entry, so per-slide multi-master
	 * switching does not leak the previous slide's master state.
	 */
	protected globalThemeColorMapSnapshot: Record<string, string> = {};
	protected globalThemeFontMapSnapshot: Record<string, string> = {};
	protected globalThemeFormatSchemeSnapshot: PptxThemeFormatScheme | undefined;

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

	/**
	 * Maps an element's `rawXml` reference to the `mc:AlternateContent`
	 * envelope that originally wrapped it (CC-4).  Populated during slide
	 * (and `p:grpSp`) parsing; consulted at save time to re-emit the
	 * original `<mc:Choice>` / `<mc:Fallback>` shape so legacy renderers
	 * keep their fallback content.
	 *
	 * Multiple sibling elements may share the same `AlternateContentBlock`
	 * value (a single AC envelope often wraps several child shapes — e.g.
	 * `p14:media` + its `p:pic` fallback nest one each).  WeakMap so AC
	 * envelopes are GC'd if the parsed XmlObject is dropped.
	 */
	protected alternateContentBlockByRawXml: WeakMap<XmlObject, AlternateContentBlock> =
		new WeakMap();

	/** Embedded fonts extracted during load, preserved for automatic re-embedding on save. */
	protected loadedEmbeddedFonts: PptxEmbeddedFont[] = [];

	/** Typed source metadata for lossless embedded-font list round trips. */
	protected loadedEmbeddedFontList: import('../../types').PptxEmbeddedFontList | undefined;

	/**
	 * View properties parsed from `ppt/viewProps.xml` during load, preserved so
	 * an unmodified load -> save round-trips the typed model and callers that do
	 * not override `saveOptions.viewProperties` still persist the loaded state.
	 */
	protected loadedViewProperties: PptxViewProperties | undefined;

	/** Map of comment author IDs to display names (from `ppt/commentAuthors.xml`). */
	protected commentAuthorMap: Map<string, string> = new Map();

	/** Full comment author details keyed by author ID, preserving initials/lastIdx/clrIdx for round-trip. */
	protected commentAuthorDetails: Map<string, PptxCommentAuthor> = new Map();

	/** Original `p:cmAuthorLst` root, including unmodelled attributes and extensions. */
	protected commentAuthorsRootXml: XmlObject | undefined;

	/** Office 2021 p188 author metadata keyed by its GUID identifier. */
	protected modernCommentAuthors: Map<string, PptxModernCommentAuthor> = new Map();
	protected modernCommentAuthorsRootXml: XmlObject | undefined;
	protected modernCommentAuthorsPartPath: string | undefined;
	protected modernCommentAuthorsRelationshipId: string | undefined;
	protected modernCommentParts: Map<string, import('../../types').PptxModernCommentPart> =
		new Map();

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
	protected static EDITOR_META_EXTENSION_URI = '{A6F62C1B-B45C-4E8A-8B0A-1B3E5F8C8D4A}';

	/** XML namespace URI for the `pptx:` prefix in the slide XML. */
	protected static EDITOR_META_NAMESPACE_URI = 'http://schemas.pptx.ai/pptx/editor-meta';

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
					if (prop === 'parse') {
						return function (xmlData: string, validationOption?: boolean) {
							const result = target.parse(xmlData, validationOption ?? false);
							if (typeof result === 'object' && result !== null) {
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
