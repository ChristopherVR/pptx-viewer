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

import type {
  PptxElementBase,
  PptxTextProperties,
  PptxShapeProperties,
} from "./element-base";
import type { PptxCustomPathProperties } from "./geometry";
import type { PptxImageProperties } from "./image";
import type { PptxTableData } from "./table";
import type { PptxChartData } from "./chart";
import type { PptxSmartArtData } from "./smart-art";
import type {
  PptxMediaType,
  MediaBookmark,
  MediaMetadata,
  MediaCaptionTrack,
} from "./media";
import type { ShapeStyle } from "./shape-style";

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
  extends PptxElementBase, PptxTextProperties, PptxShapeProperties {
  type: "text";
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
    PptxCustomPathProperties {
  type: "shape";
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
  extends PptxElementBase, PptxTextProperties, PptxShapeProperties {
  type: "connector";
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
    PptxImageProperties {
  type: "image";
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
    PptxImageProperties {
  type: "picture";
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
  type: "table";
  /** Parsed table cell data for editing. */
  tableData?: PptxTableData;
}

/**
 * A chart embedded via a `<p:graphicFrame>`.
 *
 * Chart data is parsed from the related `chartN.xml` / `chartExN.xml`
 * parts inside the PPTX archive.
 */
export interface ChartPptxElement extends PptxElementBase {
  type: "chart";
  chartData?: PptxChartData;
}

/**
 * A SmartArt diagram embedded via a `<p:graphicFrame>`.
 *
 * SmartArt data is extracted from `dgm:dataModel` parts. The editor
 * renders a simplified view; full editing is not supported.
 */
export interface SmartArtPptxElement extends PptxElementBase {
  type: "smartArt";
  smartArtData?: PptxSmartArtData;
}

/**
 * Recognised OLE object application types derived from `progId` / `clsId`.
 *
 * Used to show type-specific icons and previews in the editor.
 */
export type OleObjectType =
  | "excel"
  | "word"
  | "pdf"
  | "visio"
  | "mathtype"
  | "package"
  | "unknown";

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
  type: "ole";
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
  type: "media";
  mediaType?: PptxMediaType;
  mediaPath?: string;
  mediaData?: string;
  mediaMimeType?: string;
  /** Trim start in milliseconds (from p:cMediaNode p:cTn @st). */
  trimStartMs?: number;
  /** Trim end in milliseconds (from p:cMediaNode p:cTn @end). */
  trimEndMs?: number;
  /** Path to the poster/preview image inside the ZIP. */
  posterFramePath?: string;
  /** Base64 data-URL for the poster frame image. */
  posterFrameData?: string;
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
  type: "group";
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
  type: "ink";
  /** SVG path data for ink strokes. */
  inkPaths: string[];
  /** Per-path stroke colours. */
  inkColors?: string[];
  /** Per-path stroke widths. */
  inkWidths?: number[];
  /** Per-path opacities (0-1). */
  inkOpacities?: number[];
  /** Drawing tool used: pen, highlighter, or eraser. */
  inkTool?: "pen" | "highlighter" | "eraser";
}

/**
 * A single ink stroke within a {@link ContentPartPptxElement}.
 */
export interface ContentPartInkStroke {
  path: string;
  color: string;
  width: number;
  opacity: number;
}

/**
 * A content-part element wrapped in `mc:AlternateContent`.
 *
 * Typically contains ink strokes from modern PowerPoint pen/highlighter.
 */
export interface ContentPartPptxElement extends PptxElementBase {
  type: "contentPart";
  /** Ink strokes contained in this content part. */
  inkStrokes?: ContentPartInkStroke[];
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
  type: "zoom";
  /** Type of zoom: slide-level or section-level. */
  zoomType: "slide" | "section";
  /** Zero-based index of the target slide. */
  targetSlideIndex: number;
  /** Section ID for section zoom. */
  targetSectionId?: string;
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
  type: "model3d";
  /** Path to the 3D model file inside the ZIP. */
  modelPath?: string;
  /** Base64 data URL of the 3D model binary. */
  modelData?: string;
  /** MIME type of the model (e.g. "model/gltf-binary"). */
  modelMimeType?: string;
  /** Poster/preview image shown when 3D rendering is unavailable. */
  posterImage?: string;
}

/** An element whose type is not recognised by the parser. */
export interface UnknownPptxElement extends PptxElementBase {
  type: "unknown";
}

// ==========================================================================
// Discriminated union
// ==========================================================================

/**
 * A single element on a PPTX slide.
 *
 * This is a **discriminated union** — narrow on `element.type` to access
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

// ==========================================================================
// Utility type aliases (for function signatures that accept subsets)
// ==========================================================================

/** Elements that can contain text content (text boxes, shapes, and connectors). */
export type PptxElementWithText =
  | TextPptxElement
  | ShapePptxElement
  | ConnectorPptxElement;

/** Elements that carry shape styling (fill, stroke, geometry). */
export type PptxElementWithShapeStyle =
  | TextPptxElement
  | ShapePptxElement
  | ConnectorPptxElement
  | ImagePptxElement
  | PicturePptxElement;

/** Elements that hold raster image data. */
export type PptxImageLikeElement = ImagePptxElement | PicturePptxElement;
