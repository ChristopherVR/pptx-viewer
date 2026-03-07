/**
 * Type definitions for the EMF/WMF metafile converter.
 */

// ---------------------------------------------------------------------------
// Shared type aliases
// ---------------------------------------------------------------------------

export type CanvasContext =
  | CanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2D;

export type TransformMatrix = [number, number, number, number, number, number];

// ---------------------------------------------------------------------------
// GDI object types
// ---------------------------------------------------------------------------

export interface GdiPen {
  kind: "pen";
  style: number; // PS_SOLID=0, PS_DASH=1, PS_DOT=2, PS_DASHDOT=3, PS_NULL=5
  widthX: number;
  color: string;
}

export interface GdiBrush {
  kind: "brush";
  style: number; // BS_SOLID=0, BS_NULL=1, BS_HATCHED=2
  color: string;
}

export interface GdiFont {
  kind: "font";
  height: number;
  weight: number;
  italic: boolean;
  family: string;
}

export type GdiObject = GdiPen | GdiBrush | GdiFont;

// ---------------------------------------------------------------------------
// Drawing state
// ---------------------------------------------------------------------------

export interface DrawState {
  penColor: string;
  penWidth: number;
  penStyle: number;
  brushColor: string;
  brushStyle: number;
  textColor: string;
  bkColor: string;
  bkMode: number; // 1=TRANSPARENT, 2=OPAQUE
  fontHeight: number;
  fontWeight: number;
  fontItalic: boolean;
  fontFamily: string;
  curX: number;
  curY: number;
  polyFillMode: number; // 1=ALTERNATE, 2=WINDING
  textAlign: number;
  worldTransform: TransformMatrix;
}

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

export function cloneState(s: DrawState): DrawState {
  return {
    ...s,
    worldTransform: [...s.worldTransform] as TransformMatrix,
  };
}

// ---------------------------------------------------------------------------
// EMF header types
// ---------------------------------------------------------------------------

export interface EmfBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

// ---------------------------------------------------------------------------
// EMF+ GDI+ object table types
// ---------------------------------------------------------------------------

export interface EmfPlusBrush {
  kind: "plus-brush";
  color: string;
}

export interface EmfPlusPen {
  kind: "plus-pen";
  color: string;
  width: number;
  dashStyle: number;
}

export interface EmfPlusFont {
  kind: "plus-font";
  emSize: number;
  flags: number; // 1=Bold, 2=Italic, 4=Underline, 8=Strikeout
  family: string;
}

export interface EmfPlusPath {
  kind: "plus-path";
  points: Array<{ x: number; y: number }>;
  types: Uint8Array;
}

export interface EmfPlusImage {
  kind: "plus-image";
  data: ArrayBuffer | SharedArrayBuffer | null;
  type: number; // 0=Unknown, 1=Bitmap, 2=Metafile
}

export interface EmfPlusStringFormat {
  kind: "plus-stringformat";
  flags: number;
  alignment: number;
  lineAlignment: number;
}

export interface EmfPlusImageAttributes {
  kind: "plus-imageattributes";
}

export type EmfPlusObject =
  | EmfPlusBrush
  | EmfPlusPen
  | EmfPlusFont
  | EmfPlusPath
  | EmfPlusImage
  | EmfPlusStringFormat
  | EmfPlusImageAttributes;

// ---------------------------------------------------------------------------
// Deferred image draw (resolved asynchronously after sync replay)
// ---------------------------------------------------------------------------

export interface DeferredImageDraw {
  imageData: ArrayBuffer | SharedArrayBuffer;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
  transform: TransformMatrix;
  /** When true, imageData is an embedded EMF/WMF metafile. */
  isMetafile?: boolean;
}

// ---------------------------------------------------------------------------
// EMF+ persistent state (survives across multiple EMR_COMMENT records)
// ---------------------------------------------------------------------------

export interface EmfPlusState {
  objectTable: Map<number, EmfPlusObject>;
  worldTransform: TransformMatrix;
  saveStack: Array<{ transform: TransformMatrix }>;
  saveIdMap: Map<number, number>;
}

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

export interface WmfHeader {
  headerSize: number;
  maxRecordSize: number;
  boundsLeft: number;
  boundsTop: number;
  boundsRight: number;
  boundsBottom: number;
  unitsPerInch: number;
}

// ---------------------------------------------------------------------------
// WMF coordinate helpers
// ---------------------------------------------------------------------------

export interface WmfCoord {
  mx: (x: number) => number;
  my: (y: number) => number;
  mw: (w: number) => number;
  mh: (h: number) => number;
}

export interface WmfReplayCtx {
  view: DataView;
  ctx: CanvasContext;
  state: DrawState;
  coord: WmfCoord;
}

// ---------------------------------------------------------------------------
// EMF+ replay context (shared state passed to handler functions)
// ---------------------------------------------------------------------------

export interface EmfPlusReplayCtx {
  ctx: CanvasContext;
  view: DataView;
  objectTable: Map<number, EmfPlusObject>;
  worldTransform: TransformMatrix;
  deferredImages: DeferredImageDraw[];
  saveStack: Array<{ transform: TransformMatrix }>;
  saveIdMap: Map<number, number>;
  totalImageObjects: number;
  totalDrawImageCalls: number;
}

// ---------------------------------------------------------------------------
// EMF GDI replay context (shared state passed to handler functions)
// ---------------------------------------------------------------------------

export interface EmfGdiReplayCtx {
  ctx: CanvasContext;
  view: DataView;
  objectTable: Map<number, GdiObject>;
  state: DrawState;
  stateStack: DrawState[];
  inPath: boolean;
  windowOrg: { x: number; y: number };
  windowExt: { cx: number; cy: number };
  viewportOrg: { x: number; y: number };
  viewportExt: { cx: number; cy: number };
  useMappingMode: boolean;
  clipSaveDepth: number;
  bounds: EmfBounds;
  canvasW: number;
  canvasH: number;
  sx: number;
  sy: number;
}
