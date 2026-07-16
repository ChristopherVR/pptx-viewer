/**
 * Geometry types: adjustment handles, custom geometry points, segments,
 * paths, and custom path properties.
 *
 * @module pptx-types/geometry
 */

// ==========================================================================
// Geometry types: adjustment handles and custom geometry paths
// ==========================================================================

/**
 * Defines an adjustment handle position for a shape geometry.
 *
 * Adjustment handles allow users to interactively reshape preset shapes
 * (e.g. rounding a rectangle corner or adjusting arrow head width).
 *
 * @example
 * ```ts
 * const handle: GeometryAdjustmentHandle = {
 *   guideName: "adj",
 *   xFraction: 0.25,
 *   minValue: 0,
 *   maxValue: 50000,
 * };
 * // => satisfies GeometryAdjustmentHandle
 * ```
 */
export interface GeometryAdjustmentHandle {
	/** Name of the adjustment guide this handle controls (e.g. "adj", "adj1"). */
	guideName: string;
	/** X position as a fraction of shape width (0..1), or undefined if the handle only moves vertically. */
	xFraction?: number;
	/** Y position as a fraction of shape height (0..1), or undefined if the handle only moves horizontally. */
	yFraction?: number;
	/** Minimum allowed value for the adjustment guide. */
	minValue?: number;
	/** Maximum allowed value for the adjustment guide. */
	maxValue?: number;
}

// ==========================================================================
// Custom geometry (a:custGeom) structured types
// ==========================================================================

/**
 * A single point in a custom geometry path.
 *
 * @example
 * ```ts
 * const pt: CustomGeometryPoint = { x: 100, y: 200 };
 * // => satisfies CustomGeometryPoint
 * ```
 */
export interface CustomGeometryPoint {
	x: number;
	y: number;
}

/**
 * A segment within a custom geometry path.
 *
 * Discriminated union over `type` — can be a moveTo, lineTo,
 * cubic Bézier, quadratic Bézier, or close command.
 *
 * @example
 * ```ts
 * const segments: CustomGeometrySegment[] = [
 *   { type: "moveTo", pt: { x: 0, y: 0 } },
 *   { type: "lineTo", pt: { x: 100, y: 0 } },
 *   { type: "lineTo", pt: { x: 100, y: 100 } },
 *   { type: "close" },
 * ];
 * // => satisfies CustomGeometrySegment[]
 * ```
 */
export type CustomGeometrySegment =
	| { type: 'moveTo'; pt: CustomGeometryPoint }
	| { type: 'lineTo'; pt: CustomGeometryPoint }
	| {
			type: 'cubicBezTo';
			pts: [CustomGeometryPoint, CustomGeometryPoint, CustomGeometryPoint];
	  }
	| { type: 'quadBezTo'; pts: [CustomGeometryPoint, CustomGeometryPoint] }
	| {
			type: 'arcTo';
			/** Horizontal radius of the ellipse. */
			wR: number;
			/** Vertical radius of the ellipse. */
			hR: number;
			/** Start angle in 60000ths of a degree. */
			stAng: number;
			/** Sweep angle in 60000ths of a degree. */
			swAng: number;
	  }
	| { type: 'close' };

/**
 * A single sub-path in a custom geometry definition (maps to one `a:path`).
 *
 * @example
 * ```ts
 * const path: CustomGeometryPath = {
 *   width: 100,
 *   height: 100,
 *   segments: [
 *     { type: "moveTo", pt: { x: 0, y: 0 } },
 *     { type: "lineTo", pt: { x: 100, y: 100 } },
 *   ],
 * };
 * // => satisfies CustomGeometryPath
 * ```
 */
export interface CustomGeometryPath {
	/** Coordinate-space width for this sub-path. */
	width: number;
	/** Coordinate-space height for this sub-path. */
	height: number;
	/** Ordered list of drawing segments. */
	segments: CustomGeometrySegment[];
	/** Path fill mode (`a:path/@fill`): norm, lighten, lightenLess, darken, darkenLess, none. */
	fillMode?: 'norm' | 'lighten' | 'lightenLess' | 'darken' | 'darkenLess' | 'none';
	/** Whether the path is stroked (`a:path/@stroke`). */
	stroke?: boolean;
	/** 3D extrusion compatibility (`a:path/@extrusionOk`). */
	extrusionOk?: boolean;
}

/**
 * Auxiliary raw XML preserved from `a:custGeom` for round-trip serialization.
 * These are stored opaquely so adjustment guides, handles, connection sites,
 * and the text rectangle are not lost when a custGeom is edited and saved.
 */
export interface CustomGeometryRawData {
	/** Raw `a:avLst` XML content (adjustment value list). */
	avLstXml?: unknown;
	/** Raw `a:gdLst` XML content (guide list). */
	gdLstXml?: unknown;
	/** Raw `a:ahLst` XML content (adjustment handles). */
	ahLstXml?: unknown;
	/** Raw `a:cxnLst` XML content (connection sites). */
	cxnLstXml?: unknown;
	/** Raw `a:rect` XML content (text rectangle). */
	rectXml?: unknown;
}

// ==========================================================================
// Typed adjustment handles and connection sites for custom geometry
// ==========================================================================

/**
 * XY-style adjustment handle (`a:ahXY`) on a custom geometry.
 *
 * Allows interactive editing of one or two guide values constrained to a
 * rectangular range. Coordinates are formula references (e.g. `"adj1"`,
 * `"w/2"`, `"0"`) preserved verbatim so they can re-emit unchanged.
 *
 * @example
 * ```ts
 * const handle: AdjustHandleXY = {
 *   gdRefX: "adj1",
 *   minX: "0",
 *   maxX: "w",
 *   posX: "adj1",
 *   posY: "h/2",
 * };
 * // => satisfies AdjustHandleXY
 * ```
 */
export interface AdjustHandleXY {
	/** Guide reference for the X axis (`@_gdRefX`). */
	gdRefX?: string;
	/** Guide reference for the Y axis (`@_gdRefY`). */
	gdRefY?: string;
	/** Minimum X value, as a formula reference (`@_minX`). */
	minX?: string;
	/** Maximum X value (`@_maxX`). */
	maxX?: string;
	/** Minimum Y value (`@_minY`). */
	minY?: string;
	/** Maximum Y value (`@_maxY`). */
	maxY?: string;
	/** Handle position X (formula or literal) from `a:pos/@_x`. */
	posX?: string;
	/** Handle position Y from `a:pos/@_y`. */
	posY?: string;
}

/**
 * Polar-style adjustment handle (`a:ahPolar`) on a custom geometry.
 *
 * Drives a guide via radial distance and angle rather than XY coordinates.
 *
 * @example
 * ```ts
 * const handle: AdjustHandlePolar = {
 *   gdRefR: "adj1",
 *   gdRefAng: "adj2",
 *   posX: "wd2",
 *   posY: "hd2",
 * };
 * // => satisfies AdjustHandlePolar
 * ```
 */
export interface AdjustHandlePolar {
	/** Guide reference for the radial distance (`@_gdRefR`). */
	gdRefR?: string;
	/** Guide reference for the angle (`@_gdRefAng`). */
	gdRefAng?: string;
	/** Minimum radial value (`@_minR`). */
	minR?: string;
	/** Maximum radial value (`@_maxR`). */
	maxR?: string;
	/** Minimum angle (`@_minAng`). */
	minAng?: string;
	/** Maximum angle (`@_maxAng`). */
	maxAng?: string;
	/** Handle position X from `a:pos/@_x`. */
	posX?: string;
	/** Handle position Y from `a:pos/@_y`. */
	posY?: string;
}

/**
 * Connection site (`a:cxn`) on a custom geometry.
 *
 * Defines a point on a custom shape that connectors may snap to.
 *
 * @example
 * ```ts
 * const cxn: ConnectionSite = { ang: "0", posX: "0", posY: "hd2" };
 * // => satisfies ConnectionSite
 * ```
 */
export interface ConnectionSite {
	/** Approach angle (`@_ang`) — formula or literal degree-1/60000 value. */
	ang?: string;
	/** Site position X from `a:pos/@_x`. */
	posX?: string;
	/** Site position Y from `a:pos/@_y`. */
	posY?: string;
}

/**
 * Typed text rectangle (`a:rect`) on a custom geometry.
 *
 * Each edge is the formula or literal string preserved from the source XML
 * (`"l"`, `"t"`, `"r"`, `"b"`, or any guide name / formula).
 */
export interface CustomGeometryTextRect {
	/** Left edge formula reference (`@_l`). */
	l?: string;
	/** Top edge (`@_t`). */
	t?: string;
	/** Right edge (`@_r`). */
	r?: string;
	/** Bottom edge (`@_b`). */
	b?: string;
}

/**
 * Custom (non-preset) geometry path — only on shapes and pictures.
 *
 * Contains SVG path data and/or structured custom geometry paths
 * parsed from `a:custGeom/a:pathLst`.
 *
 * @example
 * ```ts
 * const custom: PptxCustomPathProperties = {
 *   pathData: "M 0 0 L 100 0 L 100 100 Z",
 *   pathWidth: 100,
 *   pathHeight: 100,
 * };
 * // => satisfies PptxCustomPathProperties
 * ```
 */
export interface PptxCustomPathProperties {
	/** SVG path data for custom shapes. */
	pathData?: string;
	/** Coordinate-space width for the custom path. */
	pathWidth?: number;
	/** Coordinate-space height for the custom path. */
	pathHeight?: number;
	/** Structured custom geometry paths for editing (maps to a:custGeom/a:pathLst). */
	customGeometryPaths?: CustomGeometryPath[];
	/** Raw adjustment/guide/handle/connection/text-rectangle XML preserved for serialization. */
	customGeometryRawData?: CustomGeometryRawData;
	/**
	 * Typed XY adjustment handles parsed from `a:custGeom/a:ahLst/a:ahXY`.
	 * SDK-built shapes can populate this and the writer will emit `<a:ahXY>` entries
	 * even when no raw XML was preserved.
	 */
	customGeometryAdjustHandlesXY?: AdjustHandleXY[];
	/**
	 * Typed polar adjustment handles parsed from `a:custGeom/a:ahLst/a:ahPolar`.
	 */
	customGeometryAdjustHandlesPolar?: AdjustHandlePolar[];
	/**
	 * Typed connection sites parsed from `a:custGeom/a:cxnLst/a:cxn`.
	 */
	customGeometryConnectionSites?: ConnectionSite[];
	/**
	 * Typed text rectangle parsed from `a:custGeom/a:rect`. When present this is
	 * preferred over {@link customGeometryRawData}'s `rectXml` on save.
	 */
	customGeometryTextRect?: CustomGeometryTextRect;
}
