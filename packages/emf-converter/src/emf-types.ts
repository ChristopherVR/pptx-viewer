/**
 * Type definitions for the EMF/WMF metafile converter.
 *
 * This module centralises every interface, type alias, and factory function
 * used across the converter. It has no runtime dependencies so it can be
 * imported freely without risk of circular imports.
 *
 * @module emf-types
 */

// ---------------------------------------------------------------------------
// Shared type aliases
// ---------------------------------------------------------------------------

/**
 * Union of the two 2D rendering context types the converter can target.
 * OffscreenCanvas is preferred (works in Web Workers); HTMLCanvasElement
 * is used as a fallback in older browsers.
 */
export type CanvasContext =
  | CanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2D;

/**
 * A 2x3 affine transformation matrix stored as a flat 6-element tuple
 * in the order `[a, b, c, d, e, f]`, matching the six arguments of
 * {@link CanvasRenderingContext2D.setTransform}.
 *
 * The mapping is:
 * ```
 *   | a  c  e |       | scaleX  skewX   translateX |
 *   | b  d  f |  <==> | skewY   scaleY  translateY |
 *   | 0  0  1 |       | 0       0       1          |
 * ```
 */
export type TransformMatrix = [number, number, number, number, number, number];

// ---------------------------------------------------------------------------
// GDI object types
// ---------------------------------------------------------------------------

/**
 * Represents a GDI pen object created by EMR_CREATEPEN or EMR_EXTCREATEPEN.
 * Pens define the stroke style, width, and colour used when drawing lines
 * and shape outlines.
 */
export interface GdiPen {
  kind: "pen";
  /** Pen style constant: PS_SOLID=0, PS_DASH=1, PS_DOT=2, PS_DASHDOT=3, PS_NULL=5. */
  style: number;
  /** Pen width in logical units (X axis). */
  widthX: number;
  /** CSS hex colour string, e.g. `"#ff0000"`. */
  color: string;
}

/**
 * Represents a GDI brush object created by EMR_CREATEBRUSHINDIRECT.
 * Brushes define the fill colour/style for closed shapes.
 */
export interface GdiBrush {
  kind: "brush";
  /** Brush style constant: BS_SOLID=0, BS_NULL=1 (hollow), BS_HATCHED=2. */
  style: number;
  /** CSS hex colour string. */
  color: string;
}

/**
 * Represents a GDI font object created by EMR_EXTCREATEFONTINDIRECTW.
 */
export interface GdiFont {
  kind: "font";
  /** Font height in logical units (always stored as absolute value). */
  height: number;
  /** Font weight (400 = normal, 700 = bold). */
  weight: number;
  /** Whether the font is italic. */
  italic: boolean;
  /** Font family name (e.g. `"Arial"`, `"sans-serif"`). */
  family: string;
}

/**
 * Discriminated union of all GDI object types that can appear in the
 * metafile's object table. The `kind` field acts as the discriminator.
 */
export type GdiObject = GdiPen | GdiBrush | GdiFont;

// ---------------------------------------------------------------------------
// Drawing state
// ---------------------------------------------------------------------------

/**
 * Mutable snapshot of the current GDI drawing state.
 *
 * Mirrors the subset of the Win32 device-context state that matters for
 * canvas rendering. Instances are pushed/popped on EMR_SAVEDC / EMR_RESTOREDC
 * so that nested state changes can be undone.
 */
export interface DrawState {
  /** Current pen stroke colour (CSS hex). */
  penColor: string;
  /** Current pen width in logical units. */
  penWidth: number;
  /** Current pen style constant. */
  penStyle: number;
  /** Current brush fill colour (CSS hex). */
  brushColor: string;
  /** Current brush style constant. */
  brushStyle: number;
  /** Current text foreground colour (CSS hex). */
  textColor: string;
  /** Current background colour used for opaque text backgrounds. */
  bkColor: string;
  /** Background mode: 1 = TRANSPARENT, 2 = OPAQUE. */
  bkMode: number;
  /** Current font height in logical units. */
  fontHeight: number;
  /** Current font weight (400 = normal, 700 = bold). */
  fontWeight: number;
  /** Whether the current font is italic. */
  fontItalic: boolean;
  /** Current font family name. */
  fontFamily: string;
  /** Current pen position X (logical coordinates). */
  curX: number;
  /** Current pen position Y (logical coordinates). */
  curY: number;
  /** Polygon fill mode: 1 = ALTERNATE (even-odd), 2 = WINDING (nonzero). */
  polyFillMode: number;
  /** Text alignment flags (TA_* bitmask). */
  textAlign: number;
  /** The current GDI world transform matrix. */
  worldTransform: TransformMatrix;
}

/**
 * Creates a fresh {@link DrawState} initialised with Win32 GDI defaults:
 * black pen, white brush, transparent background mode, identity transform, etc.
 *
 * @returns A new default DrawState instance.
 */
export function defaultState(): DrawState {
  return {
    penColor: "#000000",
    penWidth: 1,
    penStyle: 0,
    brushColor: "#ffffff",
    brushStyle: 0,
    textColor: "#000000",
    bkColor: "#ffffff",
    bkMode: 1,
    fontHeight: 12,
    fontWeight: 400,
    fontItalic: false,
    fontFamily: "sans-serif",
    curX: 0,
    curY: 0,
    polyFillMode: 1,
    textAlign: 0,
    worldTransform: [1, 0, 0, 1, 0, 0],
  };
}

/**
 * Creates a shallow clone of a {@link DrawState}, deep-copying the
 * `worldTransform` tuple so mutations to the clone do not affect the original.
 *
 * @param s - The state to clone.
 * @returns An independent copy of `s`.
 */
export function cloneState(s: DrawState): DrawState {
  return {
    ...s,
    worldTransform: [...s.worldTransform] as TransformMatrix,
  };
}

// ---------------------------------------------------------------------------
// EMF header types
// ---------------------------------------------------------------------------

/**
 * Axis-aligned bounding rectangle in logical (device-independent) units,
 * as stored in the EMF header's `rclBounds` / `rclFrame` fields.
 */
export interface EmfBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

// ---------------------------------------------------------------------------
// EMF+ GDI+ object table types
// ---------------------------------------------------------------------------

/** An EMF+ (GDI+) solid-colour brush object. */
export interface EmfPlusBrush {
  kind: "plus-brush";
  /** CSS rgba() colour string. */
  color: string;
}

/** An EMF+ (GDI+) pen object used for stroking shapes. */
export interface EmfPlusPen {
  kind: "plus-pen";
  /** CSS rgba() colour string. */
  color: string;
  /** Pen width in world units. */
  width: number;
  /** Dash style enum: 0=Solid, 1=Dash, 2=Dot, 3=DashDot, 4=DashDotDot, 5=Custom. */
  dashStyle: number;
}

/** An EMF+ (GDI+) font object used for text rendering. */
export interface EmfPlusFont {
  kind: "plus-font";
  /** Font em-size in points. */
  emSize: number;
  /** Style flags bitmask: 1=Bold, 2=Italic, 4=Underline, 8=Strikeout. */
  flags: number;
  /** Font family name. */
  family: string;
}

/**
 * An EMF+ (GDI+) path object — an ordered list of points with per-point
 * type bytes that specify move-to (0), line-to (1), or bezier (3) segments.
 */
export interface EmfPlusPath {
  kind: "plus-path";
  /** Ordered path vertices. */
  points: Array<{ x: number; y: number }>;
  /**
   * Per-point type byte array. Low nibble encodes the segment type
   * (0=Start, 1=Line, 3=Bezier); bit 7 signals "close sub-path".
   */
  types: Uint8Array;
}

/** An EMF+ (GDI+) image object — either a raster bitmap or an embedded metafile. */
export interface EmfPlusImage {
  kind: "plus-image";
  /** Raw image bytes, or `null` when decoding failed / data was out of bounds. */
  data: ArrayBuffer | SharedArrayBuffer | null;
  /** Image type: 0=Unknown, 1=Bitmap, 2=Metafile (embedded EMF/WMF). */
  type: number;
}

/** An EMF+ (GDI+) string format object controlling text layout and alignment. */
export interface EmfPlusStringFormat {
  kind: "plus-stringformat";
  /** StringFormat flags bitmask. */
  flags: number;
  /** Horizontal alignment: 0=Near, 1=Center, 2=Far. */
  alignment: number;
  /** Vertical (line) alignment: 0=Near, 1=Center, 2=Far. */
  lineAlignment: number;
}

/** An EMF+ (GDI+) image-attributes object (colour remapping, gamma, etc.). Currently a stub. */
export interface EmfPlusImageAttributes {
  kind: "plus-imageattributes";
}

/**
 * An EMF+ Region object representing a complex clipping region.
 * Regions can be built from rectangles, paths, or combined from other regions
 * using boolean operations (Intersect, Union, Xor, Exclude, Complement).
 */
export interface EmfPlusRegion {
  kind: "plus-region";
  /** The region node tree - a recursive structure. */
  nodes: EmfPlusRegionNode[];
}

/**
 * A node in the EMF+ region tree. Each node is either:
 * - A rectangle leaf (type "rect")
 * - A path leaf (type "path") referencing an EmfPlusPath
 * - An infinite region (type "infinite")
 * - An empty region (type "empty")
 * - A combination node (type "combine") with a CombineMode and two children
 */
export type EmfPlusRegionNode =
  | { type: "rect"; x: number; y: number; width: number; height: number }
  | { type: "path"; path: EmfPlusPath }
  | { type: "infinite" }
  | { type: "empty" }
  | { type: "combine"; combineMode: number; left: EmfPlusRegionNode; right: EmfPlusRegionNode };

/**
 * Discriminated union of all EMF+ object types stored in the per-file
 * object table (indexed 0-63). The `kind` field acts as the discriminator.
 */
export type EmfPlusObject =
  | EmfPlusBrush
  | EmfPlusPen
  | EmfPlusFont
  | EmfPlusPath
  | EmfPlusImage
  | EmfPlusStringFormat
  | EmfPlusImageAttributes
  | EmfPlusRegion;

// ---------------------------------------------------------------------------
// Deferred image draw (resolved asynchronously after sync replay)
// ---------------------------------------------------------------------------

/**
 * Descriptor for an image draw that was encountered during the synchronous
 * record replay but cannot be executed immediately because
 * {@link createImageBitmap} is asynchronous.
 *
 * After all records have been replayed, the list of deferred images is
 * processed sequentially in {@link processDeferredImages}.
 */
export interface DeferredImageDraw {
  /** Raw image bytes (PNG/BMP/EMF/WMF). */
  imageData: ArrayBuffer | SharedArrayBuffer;
  /** Destination X in logical coordinates. */
  dx: number;
  /** Destination Y in logical coordinates. */
  dy: number;
  /** Destination width in logical coordinates. */
  dw: number;
  /** Destination height in logical coordinates. */
  dh: number;
  /** The world transform that was active at the time of the draw call. */
  transform: TransformMatrix;
  /** When true, imageData is an embedded EMF/WMF metafile that must be recursively converted. */
  isMetafile?: boolean;
}

// ---------------------------------------------------------------------------
// EMF+ persistent state (survives across multiple EMR_COMMENT records)
// ---------------------------------------------------------------------------

/**
 * Persistent EMF+ state that survives across multiple EMR_COMMENT records.
 *
 * A single EMF file may contain many EMR_COMMENT records, each carrying a
 * batch of EMF+ sub-records. The object table, world transform, and save
 * stack must persist between those batches so that objects defined in one
 * comment can be referenced in a later one.
 */
export interface EmfPlusState {
  /** GDI+ object table keyed by 0-based object ID (max 63). */
  objectTable: Map<number, EmfPlusObject>;
  /** Current GDI+ world transform matrix. */
  worldTransform: TransformMatrix;
  /** Stack of saved transforms for Save/Restore and BeginContainer/EndContainer. */
  saveStack: Array<{ transform: TransformMatrix }>;
  /** Maps the caller-supplied save/container ID to an index in {@link saveStack}. */
  saveIdMap: Map<number, number>;
}

/**
 * Factory that creates a clean initial {@link EmfPlusState} with an empty
 * object table and identity world transform.
 *
 * @returns A freshly initialised EMF+ state.
 */
export function createEmfPlusState(): EmfPlusState {
  return {
    objectTable: new Map(),
    worldTransform: [1, 0, 0, 1, 0, 0],
    saveStack: [],
    saveIdMap: new Map(),
  };
}

// ---------------------------------------------------------------------------
// WMF header type
// ---------------------------------------------------------------------------

/**
 * Parsed WMF file header. Combines fields from the optional Aldus
 * placeable header (magic `0x9AC6CDD7`) and the standard WMF header.
 */
export interface WmfHeader {
  /** Total header byte size (placeable header + standard header). */
  headerSize: number;
  /** Largest record size in bytes (used as a sanity-check upper bound). */
  maxRecordSize: number;
  /** Left edge of the bounding rectangle (logical units). */
  boundsLeft: number;
  /** Top edge of the bounding rectangle (logical units). */
  boundsTop: number;
  /** Right edge of the bounding rectangle (logical units). */
  boundsRight: number;
  /** Bottom edge of the bounding rectangle (logical units). */
  boundsBottom: number;
  /** Logical units per inch (from the placeable header; defaults to 96). */
  unitsPerInch: number;
}

// ---------------------------------------------------------------------------
// WMF coordinate helpers
// ---------------------------------------------------------------------------

/**
 * Coordinate-mapping closures for WMF replay.
 *
 * Each function converts a value from WMF logical coordinates to canvas
 * pixel coordinates, taking the current window origin/extent and canvas
 * dimensions into account.
 */
export interface WmfCoord {
  /** Map logical X position to canvas X. */
  mx: (x: number) => number;
  /** Map logical Y position to canvas Y. */
  my: (y: number) => number;
  /** Map logical width to canvas width. */
  mw: (w: number) => number;
  /** Map logical height to canvas height. */
  mh: (h: number) => number;
}

/**
 * Context object passed through the WMF record handler chain.
 * Bundles the DataView, rendering context, current drawing state,
 * and coordinate-mapping helpers.
 */
export interface WmfReplayCtx {
  /** DataView over the raw WMF file bytes. */
  view: DataView;
  /** Target canvas 2D rendering context. */
  ctx: CanvasContext;
  /** Mutable GDI drawing state. */
  state: DrawState;
  /** Coordinate-mapping closures (logical -> canvas). */
  coord: WmfCoord;
}

// ---------------------------------------------------------------------------
// EMF+ replay context (shared state passed to handler functions)
// ---------------------------------------------------------------------------

/**
 * Context object threaded through every EMF+ record handler.
 *
 * It carries both the persistent GDI+ object table and the transient
 * rendering state (world transform, save stack, deferred image queue).
 */
export interface EmfPlusReplayCtx {
  /** Target canvas 2D rendering context. */
  ctx: CanvasContext;
  /** DataView over the raw metafile bytes. */
  view: DataView;
  /** GDI+ object table (brush, pen, path, font, image, etc.). */
  objectTable: Map<number, EmfPlusObject>;
  /** Current GDI+ world transform. */
  worldTransform: TransformMatrix;
  /** Accumulator for image draws that must be resolved asynchronously. */
  deferredImages: DeferredImageDraw[];
  /** Save/container transform stack. */
  saveStack: Array<{ transform: TransformMatrix }>;
  /** Maps caller-supplied save/container IDs to stack indices. */
  saveIdMap: Map<number, number>;
  /** Running count of Image objects parsed (for diagnostics). */
  totalImageObjects: number;
  /** Running count of DrawImage / DrawImagePoints calls (for diagnostics). */
  totalDrawImageCalls: number;
  /** Number of ctx.save() calls made specifically for clip management. */
  clipSaveDepth: number;
  /** Current page unit (0=World, 2=Pixel, 3=Point, 4=Inch, 5=Document, 6=Millimeter). */
  pageUnit: number;
  /** Current page scale factor. */
  pageScale: number;
  /** Buffer for accumulating continuation object data. */
  continuationBuffer: Uint8Array | null;
  /** The object ID of the current continuation sequence. */
  continuationObjectId: number;
  /** The object type of the current continuation sequence. */
  continuationObjectType: number;
  /** Total size expected for the continuation object. */
  continuationTotalSize: number;
  /** Byte offset into continuationBuffer for the next chunk. */
  continuationOffset: number;
}

// ---------------------------------------------------------------------------
// EMF GDI replay context (shared state passed to handler functions)
// ---------------------------------------------------------------------------

/**
 * Context object threaded through every EMF GDI record handler.
 *
 * It bundles the canvas context, the binary DataView, the GDI object table,
 * the mutable drawing state, coordinate-mapping parameters, and bookkeeping
 * flags such as `inPath` and `clipSaveDepth`.
 */
export interface EmfGdiReplayCtx {
  /** Target canvas 2D rendering context. */
  ctx: CanvasContext;
  /** DataView over the raw EMF file bytes. */
  view: DataView;
  /** GDI object table: maps object handles to pen/brush/font objects. */
  objectTable: Map<number, GdiObject>;
  /** Mutable GDI drawing state (colours, font, pen position, …). */
  state: DrawState;
  /** Stack of saved DrawStates for EMR_SAVEDC / EMR_RESTOREDC. */
  stateStack: DrawState[];
  /** True while inside a BeginPath / EndPath bracket. */
  inPath: boolean;
  /** Window origin (logical coordinates). */
  windowOrg: { x: number; y: number };
  /** Window extent (logical size). */
  windowExt: { cx: number; cy: number };
  /** Viewport origin (device coordinates). */
  viewportOrg: { x: number; y: number };
  /** Viewport extent (device size). */
  viewportExt: { cx: number; cy: number };
  /** When true, use window/viewport mapping instead of simple bounds-based scaling. */
  useMappingMode: boolean;
  /**
   * Tracks how many extra `ctx.save()` calls were made for clipping rects,
   * so they can be unwound before a state save/restore.
   */
  clipSaveDepth: number;
  /** Logical bounding rectangle from the EMF header. */
  bounds: EmfBounds;
  /** Output canvas width in pixels. */
  canvasW: number;
  /** Output canvas height in pixels. */
  canvasH: number;
  /** Horizontal scale factor: `canvasW / logicalWidth`. */
  sx: number;
  /** Vertical scale factor: `canvasH / logicalHeight`. */
  sy: number;
}
