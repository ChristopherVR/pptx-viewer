/**
 * Concrete element types (one per `type` discriminant) and the
 * {@link PptxElement} discriminated union.
 *
 * Narrow on `element.type` to access variant-specific properties:
 * ```ts
 * if (element.type === "image") {
 *   console.log(element.imageData); // ImagePptxElement-only
 * }
 * ```
 *
 * @module pptx-types/elements
 */

// ==========================================================================
// Concrete element types (discriminated by `type`) and union
// ==========================================================================

import type { PptxChartData } from './chart';
import type { XmlObject } from './common';
import type { PptxElementBase, PptxTextProperties, PptxShapeProperties } from './element-base';
import type { PptxCustomPathProperties } from './geometry';
import type { PptxImageProperties } from './image';
import type {
	PptxMediaType,
	PptxMediaReferenceKind,
	PptxAudioCdPosition,
	MediaBookmark,
	MediaMetadata,
	MediaCaptionTrack,
} from './media';
import type { ShapeStyle } from './shape-style';
import type { PptxSmartArtData } from './smart-art';
import type { PptxTableData } from './table';

/**
 * Accessibility metadata from `p:cNvPr/a:extLst`'s "Mark as decorative"
 * vendor extension (issue G16). PowerPoint's Alt Text pane writes
 * `a:ext[@uri='{C183D7F6-B498-43B3-948B-1728B52AA6E4}']/adec:decorative
 * val="1"` when a shape or image is marked decorative; mixed into the
 * element variants whose `p:cNvPr` that pane covers.
 */
export interface PptxAccessibilityProperties {
	/**
	 * Whether the element is marked decorative. When true, alt text /
	 * aria-label / Markdown export should skip describing the element even
	 * when {@link PptxImageProperties.altText} (or similar) is present.
	 */
	isDecorative?: boolean;
}

/**
 * Accessibility description/title from `p:cNvPr/@descr` / `@title` on a
 * plain shape, text box or connector (`p:sp` / `p:cxnSp`). The same pair of
 * attributes already round-trips for a graphic frame (see
 * {@link TablePptxElement.altText}) and, `descr` only, for a picture
 * ({@link PptxImageProperties.altText}); this mixin extends it to the three
 * element kinds whose PowerPoint Alt Text pane data was previously dropped
 * on load because neither field existed on the model.
 */
export interface PptxNonVisualDescription {
	/** `p:cNvPr/@descr`. */
	altText?: string;
	/** `p:cNvPr/@title`. */
	title?: string;
}

/**
 * `a:cNvPicPr/@preferRelativeResize` (issue G13), a picture-only non-visual
 * property distinct from `a:picLocks`.
 */
export interface PptxPictureNonVisualProperties {
	/**
	 * `a:cNvPicPr/@preferRelativeResize` (ST_Boolean, defaults to `true` when
	 * absent). Controls whether a picture's crop rectangle is reinterpreted
	 * relative to the picture's ORIGINAL dimensions or its CURRENT
	 * (already-resized) dimensions when it is resized again after being
	 * cropped. Parsed and round-tripped for now; not yet wired into
	 * resize-after-crop arithmetic (this app always uses current-size
	 * semantics, which only diverges from `preferRelativeResize="0"` on a
	 * second resize after a crop).
	 */
	preferRelativeResize?: boolean;
}

/**
 * A text box — a plain rectangle containing text, typically with no
 * visible fill or stroke.
 *
 * @example
 * ```ts
 * const title: TextPptxElement = {
 *   type: "text",
 *   id: "txt_1", x: 50, y: 30, width: 800, height: 60,
 *   text: "Welcome",
 *   textStyle: { fontSize: 36, bold: true },
 * };
 * // => satisfies TextPptxElement
 * ```
 */
export interface TextPptxElement
	extends PptxElementBase, PptxTextProperties, PptxShapeProperties, PptxNonVisualDescription {
	type: 'text';
}

/**
 * A shape — may contain text and custom geometry (preset or freeform).
 *
 * @example
 * ```ts
 * const rect: ShapePptxElement = {
 *   type: "shape",
 *   id: "shp_1", x: 100, y: 200, width: 300, height: 150,
 *   shapeType: "roundRect",
 *   shapeStyle: { fillColor: "#00AA55" },
 *   text: "OK",
 * };
 * // => satisfies ShapePptxElement
 * ```
 */
export interface ShapePptxElement
	extends
		PptxElementBase,
		PptxTextProperties,
		PptxShapeProperties,
		PptxCustomPathProperties,
		PptxAccessibilityProperties,
		PptxNonVisualDescription {
	type: 'shape';
}

/**
 * A connector (straight, bent, or curved line between shapes).
 *
 * Connector endpoints can snap to specific shapes via
 * `shapeStyle.connectorStartConnection` / `connectorEndConnection`.
 *
 * @example
 * ```ts
 * const line: ConnectorPptxElement = {
 *   type: "connector",
 *   id: "cxn_1", x: 100, y: 100, width: 200, height: 0,
 *   shapeStyle: {
 *     strokeColor: "#333",
 *     connectorEndArrow: "triangle",
 *   },
 * };
 * // => satisfies ConnectorPptxElement
 * ```
 */
export interface ConnectorPptxElement
	extends PptxElementBase, PptxTextProperties, PptxShapeProperties, PptxNonVisualDescription {
	type: 'connector';
}

/**
 * An image element from an OOXML `<p:pic>` node with `type: "image"`.
 *
 * @example
 * ```ts
 * const img: ImagePptxElement = {
 *   type: "image",
 *   id: "img_1", x: 0, y: 0, width: 960, height: 540,
 *   imagePath: "ppt/media/image1.png",
 *   altText: "Background scenery",
 * };
 * // => satisfies ImagePptxElement
 * ```
 */
export interface ImagePptxElement
	extends
		PptxElementBase,
		PptxShapeProperties,
		PptxCustomPathProperties,
		PptxImageProperties,
		PptxAccessibilityProperties,
		PptxPictureNonVisualProperties {
	type: 'image';
}

/**
 * A picture element from an OOXML `<p:pic>` node with `type: "picture"`.
 *
 * Functionally identical to {@link ImagePptxElement} but distinguished by
 * the `type` discriminant for semantic clarity.
 */
export interface PicturePptxElement
	extends
		PptxElementBase,
		PptxShapeProperties,
		PptxCustomPathProperties,
		PptxImageProperties,
		PptxAccessibilityProperties,
		PptxPictureNonVisualProperties {
	type: 'picture';
}

/**
 * A single unrecognised `<a:graphicData>/<a:extLst>/<a:ext>` extension on a
 * graphicFrame, captured verbatim so the round-trip can preserve future or
 * vendor-specific markup that the parser doesn't yet understand.
 *
 * The XML is preserved as a fast-xml-parser object tree (the same shape as
 * `rawXml` on other elements) so the save layer can re-emit it through the
 * existing builder without lossy string manipulation.
 */
export interface PptxGraphicFrameExtension {
	/** The `@_uri` attribute identifying the extension (e.g. `{C3CD43...}`). */
	uri: string;
	/** Parsed XML payload of the extension, suitable for re-serialization. */
	xml: import('./common').XmlObject;
}

/**
 * A table embedded via a `<p:graphicFrame>`.
 *
 * @example
 * ```ts
 * const tbl: TablePptxElement = {
 *   type: "table",
 *   id: "tbl_1", x: 50, y: 200, width: 860, height: 300,
 *   tableData: {
 *     rows: [
 *       { cells: [{ text: "Name" }, { text: "Score" }] },
 *       { cells: [{ text: "Alice" }, { text: "95" }] },
 *     ],
 *   },
 * };
 * // => satisfies TablePptxElement
 * ```
 */
export interface TablePptxElement extends PptxElementBase {
	type: 'table';
	/** Parsed table cell data for editing. */
	tableData?: PptxTableData;
	/**
	 * Accessibility description from `p:nvGraphicFramePr/p:cNvPr/@descr`, the
	 * same non-visual-properties attribute a picture's alt text comes from.
	 */
	altText?: string;
	/** Accessibility title from `p:nvGraphicFramePr/p:cNvPr/@title`. */
	title?: string;
	/**
	 * Unrecognised extensions captured from `a:graphicData/a:extLst` so they
	 * round-trip losslessly. See {@link PptxGraphicFrameExtension}.
	 */
	extensionXml?: PptxGraphicFrameExtension[];
}

/**
 * A chart embedded via a `<p:graphicFrame>`.
 *
 * Chart data is parsed from the related `chartN.xml` / `chartExN.xml`
 * parts inside the PPTX archive.
 */
export interface ChartPptxElement extends PptxElementBase {
	type: 'chart';
	chartData?: PptxChartData;
	/** Accessibility description from `p:nvGraphicFramePr/p:cNvPr/@descr`. */
	altText?: string;
	/** Accessibility title from `p:nvGraphicFramePr/p:cNvPr/@title`. */
	title?: string;
	/** Unrecognised graphicFrame extLst extensions, captured verbatim for round-trip. */
	extensionXml?: PptxGraphicFrameExtension[];
}

/**
 * A SmartArt diagram embedded via a `<p:graphicFrame>`.
 *
 * SmartArt data is extracted from `dgm:dataModel` parts. The editor
 * supports real structural editing (adding, removing and reordering nodes,
 * editing node text, and switching layout presets) with a lossless
 * `ptLst` round-trip. When the file carries PowerPoint's own pre-computed
 * drawing part, that exact layout is used; otherwise an algorithmic layout
 * engine approximates it, so complex custom layouts may not match
 * PowerPoint pixel-for-pixel.
 */
export interface SmartArtPptxElement extends PptxElementBase {
	type: 'smartArt';
	smartArtData?: PptxSmartArtData;
	/** Accessibility description from `p:nvGraphicFramePr/p:cNvPr/@descr`. */
	altText?: string;
	/** Accessibility title from `p:nvGraphicFramePr/p:cNvPr/@title`. */
	title?: string;
	/** Unrecognised graphicFrame extLst extensions, captured verbatim for round-trip. */
	extensionXml?: PptxGraphicFrameExtension[];
}

/**
 * Recognised OLE object application types derived from `progId` / `clsId`.
 *
 * Used to show type-specific icons and previews in the editor.
 */
export type OleObjectType = 'excel' | 'word' | 'pdf' | 'visio' | 'mathtype' | 'package' | 'unknown';

/**
 * An OLE (Object Linking and Embedding) object.
 *
 * OLE objects can be embedded Excel sheets, Word documents, PDFs, Visio
 * diagrams, MathType equations, or generic "packages". They carry a
 * preview image for display and optional binary data for extraction.
 *
 * @example
 * ```ts
 * const ole: OlePptxElement = {
 *   type: "ole",
 *   id: "ole_1", x: 100, y: 200, width: 400, height: 300,
 *   oleObjectType: "excel",
 *   oleProgId: "Excel.Sheet.12",
 *   fileName: "budget.xlsx",
 * };
 * // => satisfies OlePptxElement
 * ```
 */
export interface OlePptxElement extends PptxElementBase {
	type: 'ole';
	oleTarget?: string;
	oleProgId?: string;
	oleName?: string;
	/** CLSID of the OLE object (from `@_classid`). */
	oleClsId?: string;
	/** Detected application type (excel, word, pdf, etc.). */
	oleObjectType?: OleObjectType;
	/** File extension for the embedded binary (e.g. "xlsx", "docx"). */
	oleFileExtension?: string;
	/** Original file name when available. */
	fileName?: string;
	/** Whether this is a linked (vs. embedded) object. */
	isLinked?: boolean;
	/** External file path for linked OLE objects (TargetMode="External"). */
	externalPath?: string;
	/** Data-URL or path for the OLE preview image. */
	previewImage?: string;
	/** Decoded preview image as a data-URL. */
	previewImageData?: string;
	/** Whether the OLE object is shown as an icon (`p:oleObj/@showAsIcon`). */
	oleShowAsIcon?: boolean;
	/** Authored display width of the OLE object preview, in EMU (`@imgW`). */
	oleImgW?: number;
	/** Authored display height of the OLE object preview, in EMU (`@imgH`). */
	oleImgH?: number;
	/**
	 * The recovered embedded payload as a data-URL (e.g.
	 * `data:application/vnd...;base64,...`), suitable for download or
	 * open-in-new-tab. For a generic "Package" OLE object this is the unwrapped
	 * inner file; for a plain embedded file (e.g. `.xlsx`) it is that file
	 * directly. Undefined when the embedding is missing or unreadable.
	 *
	 * Stored as a data-URL string to mirror how images store decoded bytes
	 * ({@link ImagePptxElement.imageData}) and to stay serialization-safe.
	 */
	oleEmbeddedData?: string;
	/** Original file name of the embedded payload when recoverable. */
	oleEmbeddedFileName?: string;
	/** MIME type of the embedded payload, derived from its extension/ProgID. */
	oleEmbeddedMimeType?: string;
	/** Size of the embedded payload in bytes. */
	oleEmbeddedByteSize?: number;
	/**
	 * `p:link/@followColorScheme` (`ST_OleObjectFollowColorScheme`): whether a
	 * LINKED OLE object's icon recolours to match the presentation theme.
	 * Only meaningful when {@link isLinked} is `true`. ECMA-376 §19.3.1.28.
	 */
	oleFollowColorScheme?: 'none' | 'full' | 'textAndBackground';
	/**
	 * `p:link/@updateAutomatic` (`CT_OleObjectLink`, ECMA-376 §19.3.2.4):
	 * whether a LINKED OLE object refreshes automatically from its source
	 * (PowerPoint's Edit Links dialog "Automatic" vs. "Manual" radio buttons).
	 * Only meaningful when {@link isLinked} is `true`. The schema default is
	 * `false`; `undefined` means the source authored no explicit value.
	 */
	oleUpdateAutomatic?: boolean;
	/** Accessibility description from `p:nvGraphicFramePr/p:cNvPr/@descr`. */
	altText?: string;
	/** Accessibility title from `p:nvGraphicFramePr/p:cNvPr/@title`. */
	title?: string;
	/** Unrecognised graphicFrame extLst extensions, captured verbatim for round-trip. */
	extensionXml?: PptxGraphicFrameExtension[];
}

/**
 * An audio or video media element.
 *
 * Media elements reference files inside the PPTX archive
 * (`mediaPath`) and may include trim points, poster frames, and
 * playback settings for presentation mode.
 *
 * @example
 * ```ts
 * const video: MediaPptxElement = {
 *   type: "media",
 *   id: "vid_1", x: 50, y: 100, width: 640, height: 360,
 *   mediaType: "video",
 *   mediaPath: "ppt/media/media1.mp4",
 *   autoPlay: true,
 *   volume: 0.8,
 * };
 * // => satisfies MediaPptxElement
 * ```
 */
export interface MediaPptxElement extends PptxElementBase {
	type: 'media';
	mediaType?: PptxMediaType;
	mediaPath?: string;
	mediaData?: string;
	mediaMimeType?: string;
	mediaReferenceKind?: PptxMediaReferenceKind;
	mediaReferenceName?: string;
	/** Explicit DrawingML `audioFile/@contentType` value when present. */
	mediaReferenceContentType?: string;
	audioCdStart?: PptxAudioCdPosition;
	audioCdEnd?: PptxAudioCdPosition;
	rawMediaReferenceXml?: XmlObject;
	/** Trim start in milliseconds (from p:cMediaNode p:cTn @st). */
	trimStartMs?: number;
	/** Trim end in milliseconds (from p:cMediaNode p:cTn @end). */
	trimEndMs?: number;
	/** Path to the poster/preview image inside the ZIP. */
	posterFramePath?: string;
	/** Base64 data-URL for the poster frame image. */
	posterFrameData?: string;
	/** Poster source crop from the left edge as a 0..1 fraction. */
	cropLeft?: number;
	/** Poster source crop from the top edge as a 0..1 fraction. */
	cropTop?: number;
	/** Poster source crop from the right edge as a 0..1 fraction. */
	cropRight?: number;
	/** Poster source crop from the bottom edge as a 0..1 fraction. */
	cropBottom?: number;
	/** Poster stretch-target inset from the left frame edge. */
	fillRectLeft?: number;
	/** Poster stretch-target inset from the top frame edge. */
	fillRectTop?: number;
	/** Poster stretch-target inset from the right frame edge. */
	fillRectRight?: number;
	/** Poster stretch-target inset from the bottom frame edge. */
	fillRectBottom?: number;
	/** Whether media should play full-screen during presentation. */
	fullScreen?: boolean;
	/** Whether media should loop continuously. */
	loop?: boolean;
	/** Fade-in duration in seconds. */
	fadeInDuration?: number;
	/** Fade-out duration in seconds. */
	fadeOutDuration?: number;
	/** Playback volume (0 to 1). */
	volume?: number;
	/** Whether media auto-plays on slide entry. */
	autoPlay?: boolean;
	/** Whether audio continues playing across slide transitions (presentation mode). */
	playAcrossSlides?: boolean;
	/** Hide the element when media is not actively playing. */
	hideWhenNotPlaying?: boolean;
	/** Named time bookmarks within the clip. */
	bookmarks?: MediaBookmark[];
	/** Playback speed multiplier (1 = normal, 2 = double, 0.5 = half). */
	playbackSpeed?: number;
	/** Runtime-extracted metadata (duration, resolution, codec). */
	metadata?: MediaMetadata;
	/** Closed caption / subtitle tracks. */
	captionTracks?: MediaCaptionTrack[];
	/** Whether the media source is missing/broken (file not found in archive). */
	mediaMissing?: boolean;
	/**
	 * Whether the media is linked (external `r:link`) rather than embedded
	 * (`r:embed`). Defaults to embedded when undefined.
	 */
	isLinked?: boolean;
	/**
	 * Accessibility description from `p:nvGraphicFramePr/p:cNvPr/@descr`.
	 * Only populated for the `p:graphicFrame`-shaped (SDK-created) media
	 * form; a `p:pic`-shaped media element's alt text is not currently
	 * parsed (see `PptxHandlerRuntimePictureParsing.ts`).
	 */
	altText?: string;
	/** Accessibility title from `p:nvGraphicFramePr/p:cNvPr/@title`. Same scope note as {@link altText}. */
	title?: string;
	/** Unrecognised graphicFrame extLst extensions, captured verbatim for round-trip. */
	extensionXml?: PptxGraphicFrameExtension[];
}

/**
 * A group container that holds child elements.
 *
 * Children inherit the group’s transform, so moving/resizing the group
 * affects all children proportionally.
 *
 * @example
 * ```ts
 * const group: GroupPptxElement = {
 *   type: "group",
 *   id: "grp_1", x: 0, y: 0, width: 960, height: 540,
 *   children: [textEl, shapeEl],
 * };
 * // => satisfies GroupPptxElement
 * ```
 */
export interface GroupPptxElement extends PptxElementBase {
	type: 'group';
	/** Child elements contained within this group. */
	children: PptxElement[];
	/** Fill style extracted from the group's `p:grpSpPr`, used for `a:grpFill` inheritance. */
	groupFill?: ShapeStyle;
}

/**
 * A freehand ink / drawing stroke captured with a stylus or mouse.
 *
 * Ink strokes are stored as SVG path data strings. Each path may
 * have independent colour, width, and opacity.
 */
export interface InkPptxElement extends PptxElementBase {
	type: 'ink';
	/** SVG path data for ink strokes. */
	inkPaths: string[];
	/** Per-path stroke colours. */
	inkColors?: string[];
	/** Per-path stroke widths. */
	inkWidths?: number[];
	/** Per-path opacities (0-1). */
	inkOpacities?: number[];
	/** Drawing tool used: pen, highlighter, or eraser. */
	inkTool?: 'pen' | 'highlighter' | 'eraser';
	/**
	 * Per-path arrays of per-point pressure values (0-1).
	 *
	 * Each entry corresponds to the path at the same index in `inkPaths`.
	 * Each inner array contains one pressure value per sampled point along
	 * the stroke. When present, the renderer uses these values to produce
	 * variable-width strokes that reflect stylus/pen pressure.
	 */
	inkPointPressures?: number[][];
	/** Unrecognised graphicFrame extLst extensions, captured verbatim for round-trip. */
	extensionXml?: PptxGraphicFrameExtension[];
}

/**
 * A single ink stroke within a {@link ContentPartPptxElement}.
 */
export interface ContentPartInkStroke {
	path: string;
	color: string;
	width: number;
	opacity: number;
	/**
	 * Per-point pressure values (0-1) for this stroke.
	 *
	 * When present, the renderer uses these values to produce
	 * variable-width strokes that reflect stylus/pen pressure.
	 */
	pressures?: number[];
	/**
	 * Per-point pen-tilt lean direction (radians), decoded from the source
	 * InkML's `OTx`/`OTy` tilt-offset channels or its `AZIMUTH` channel.
	 *
	 * When present (paired with {@link tiltMagnitudes}), the renderer widens
	 * each point perpendicular to the lean direction, approximating a
	 * calligraphic (chisel-tip) nib. Absent when the source declared no tilt
	 * channel, in which case rendering is unaffected.
	 */
	tiltAngles?: number[];
	/**
	 * Per-point pen-tilt strength (0 upright, 1 maximally leaned), paired with
	 * {@link tiltAngles}.
	 */
	tiltMagnitudes?: number[];
}

/**
 * A content-part element wrapped in `mc:AlternateContent`.
 *
 * Typically contains ink strokes from modern PowerPoint pen/highlighter.
 */
export interface ContentPartPptxElement extends PptxElementBase {
	type: 'contentPart';
	/** Ink strokes contained in this content part. */
	inkStrokes?: ContentPartInkStroke[];
	/** Package path of the related InkML part. */
	inkPartPath?: string;
	/** Parsed InkML root retained for unknown-node preservation on dirty save. */
	inkPartRawXml?: XmlObject;
}

/**
 * A Slide Zoom or Section Zoom element (PowerPoint Zoom Object).
 *
 * Zoom elements display a live thumbnail of the target slide and
 * navigate to it on click during presentation mode.
 *
 * @example
 * ```ts
 * const zoom: ZoomPptxElement = {
 *   type: "zoom",
 *   id: "zm_1", x: 300, y: 200, width: 200, height: 120,
 *   zoomType: "slide",
 *   targetSlideIndex: 5,
 * };
 * // => satisfies ZoomPptxElement
 * ```
 */
export interface ZoomPptxElement extends PptxElementBase, PptxImageProperties {
	type: 'zoom';
	/** Type of zoom: slide-level, section-level, or a multi-section summary. */
	zoomType: 'slide' | 'section' | 'summary';
	/** Zero-based index of the target slide. */
	targetSlideIndex: number;
	/** Section ID for section zoom. */
	targetSectionId?: string;
	/** Ordered section tiles in a Summary Zoom container. */
	summaryTargets?: SummaryZoomTarget[];
	/** Layout mode authored on the Summary Zoom container. */
	summaryLayout?: 'grid' | 'fixed';
}

/** A single section tile within a PowerPoint Summary Zoom container. */
export interface SummaryZoomTarget extends PptxImageProperties {
	sectionId: string;
	targetSlideIndex: number;
	x: number;
	y: number;
	width: number;
	height: number;
	title?: string;
	description?: string;
	offsetFactorX?: number;
	offsetFactorY?: number;
	scaleFactorX?: number;
	scaleFactorY?: number;
	rawXml?: XmlObject;
}

/**
 * A 3D model object embedded via `p16:model3D` inside an
 * `mc:AlternateContent` block (PowerPoint 365+).
 *
 * The element carries the path to the `.glb`/`.gltf` binary inside
 * the ZIP and a poster/fallback image for rendering in viewers that
 * do not support interactive 3D.
 */
export interface Model3DPptxElement extends PptxElementBase, PptxImageProperties {
	type: 'model3d';
	/** Path to the 3D model file inside the ZIP. */
	modelPath?: string;
	/** Base64 data URL of the 3D model binary. */
	modelData?: string;
	/** MIME type of the model (e.g. "model/gltf-binary"). */
	modelMimeType?: string;
	/** Poster/preview image shown when 3D rendering is unavailable. */
	posterImage?: string;
	/** Unrecognised graphicFrame extLst extensions, captured verbatim for round-trip. */
	extensionXml?: PptxGraphicFrameExtension[];
}

/** An element whose type is not recognised by the parser. */
export interface UnknownPptxElement extends PptxElementBase {
	type: 'unknown';
	/** Unrecognised graphicFrame extLst extensions, captured verbatim for round-trip. */
	extensionXml?: PptxGraphicFrameExtension[];
}

// ==========================================================================
// Discriminated union
// ==========================================================================

/**
 * A single element on a PPTX slide.
 *
 * This is a **discriminated union**: narrow on `element.type` to access
 * variant-specific properties like `imageData` (image/picture), `pathData`
 * (shape), or `textSegments` (text/shape).
 */
export type PptxElement =
	| TextPptxElement
	| ShapePptxElement
	| ConnectorPptxElement
	| ImagePptxElement
	| PicturePptxElement
	| TablePptxElement
	| ChartPptxElement
	| SmartArtPptxElement
	| OlePptxElement
	| MediaPptxElement
	| GroupPptxElement
	| InkPptxElement
	| ContentPartPptxElement
	| ZoomPptxElement
	| Model3DPptxElement
	| UnknownPptxElement;

/**
 * Discriminant values for the `type` field on {@link PptxElement}.
 *
 * DERIVED from the union on purpose. This alias used to be a hand-written list
 * of string literals living in `types/common.ts`, and it drifted: two element
 * types (`contentPart` and `model3d`) were added to {@link PptxElement} without
 * being added to the list, so every consumer that keyed a registry or a switch
 * off the alias was silently blind to ink content parts and 3D models while
 * still type-checking. Deriving it makes that class of drift impossible, at the
 * cost of nothing: the resolved type is identical.
 *
 * Narrow on this type to access variant-specific properties.
 *
 * @example
 * ```ts
 * function isImage(el: PptxElement): el is ImagePptxElement {
 *   return el.type === "image";
 * }
 * // => type guard narrowing PptxElement to ImagePptxElement
 * ```
 */
export type PptxElementType = PptxElement['type'];

// ==========================================================================
// Utility type aliases (for function signatures that accept subsets)
// ==========================================================================

/** Elements that can contain text content (text boxes, shapes, and connectors). */
export type PptxElementWithText = TextPptxElement | ShapePptxElement | ConnectorPptxElement;

/** Elements that carry shape styling (fill, stroke, geometry). */
export type PptxElementWithShapeStyle =
	| TextPptxElement
	| ShapePptxElement
	| ConnectorPptxElement
	| ImagePptxElement
	| PicturePptxElement;

/** Elements that hold raster image data. */
export type PptxImageLikeElement = ImagePptxElement | PicturePptxElement;
