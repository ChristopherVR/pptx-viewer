/**
 * Three.js SmartArt renderer - pure model types (phase 1: extruded layouts).
 *
 * These describe a framework-agnostic, three.js-agnostic 3D scene derived from
 * the 2D {@link SmartArtLayoutResult}. The pure model is built by
 * `buildSmartArt3DModel` (no `three` import, fully testable) and consumed by the
 * vanilla-three scene builder under `pptx-viewer-shared/smartart-3d`, which is
 * shared verbatim by the React, Vue, and Angular bindings.
 *
 * Coordinate convention: world space is y-up, centred on the origin, with the
 * front face of every extruded block facing +z. Layout (SVG) space is y-down
 * with the origin at the top-left; the model builder performs the flip.
 */

/** A point in the world's XZ-agnostic 2D outline space (y-up). */
export interface Point2 {
	x: number;
	y: number;
}

/** A world-space position (y-up). */
export interface Vec3 {
	x: number;
	y: number;
	z: number;
}

/**
 * A single extruded shape (one SmartArt node) in the 3D scene.
 *
 * The {@link outline} is a closed polygon centred on the mesh's own origin
 * (y-up); the scene builder extrudes it by {@link depth} along +z and positions
 * the result at {@link position}.
 */
export interface SmartArt3DMesh {
	id: string;
	/** Closed 2D outline to extrude, centred on the mesh origin (y-up). */
	outline: Point2[];
	/** Hint that the outline approximates a circle (drives tessellation). */
	rounded: boolean;
	/** Extrusion depth along +z, in layout pixels. */
	depth: number;
	/** Bevel size; 0 disables bevelling. */
	bevel: number;
	/** Fill colour, `#rrggbb`. */
	fill: string;
	/** Edge/stroke colour, `#rrggbb`. */
	stroke: string;
	/** Stroke width in layout pixels (0 = no visible edge line). */
	strokeWidth: number;
	/** Mesh opacity, 0..1. */
	opacity: number;
	/** World-space centre of the mesh (y-up, z = 0 base plane). */
	position: Vec3;
	/**
	 * Euler rotation (radians, XYZ order) applied to the mesh. `{0,0,0}` for the
	 * extruded (phase 1) layout, where every block faces +z; spatial layouts
	 * (e.g. the cycle carousel) rotate blocks to face along the arrangement.
	 */
	rotation: Vec3;
	/** Text label drawn on the front (+z) face. */
	text: string;
	/** Text colour, `#rrggbb`. */
	textColor: string;
	/** Font size in layout pixels. */
	fontSize: number;
	/** Half-width of the footprint (for sizing the text plane). */
	halfWidth: number;
	/** Half-height of the footprint. */
	halfHeight: number;
}

/** A connector poly-line drawn between meshes on the base plane. */
export interface SmartArt3DConnector {
	id: string;
	/** World-space points (y-up). */
	points: Vec3[];
	/** Line colour, `#rrggbb`. */
	color: string;
	/** Line width in layout pixels. */
	width: number;
}

/** Camera-framing bounds of the whole model, in layout pixels. */
export interface SmartArt3DBounds {
	width: number;
	height: number;
}

/** The layout family the model was built from (drives the spatial transform). */
export type SmartArt3DFamily =
	| 'list'
	| 'process'
	| 'cycle'
	| 'hierarchy'
	| 'matrix'
	| 'radial'
	| 'pyramid'
	| 'venn'
	| 'funnel'
	| 'target';

/** The complete pure 3D model for one SmartArt element. */
export interface SmartArt3DModel {
	meshes: SmartArt3DMesh[];
	connectors: SmartArt3DConnector[];
	bounds: SmartArt3DBounds;
	/** Layout family, used to choose a spatial arrangement. */
	family?: SmartArt3DFamily;
	/** Optional background chrome colour, `#rrggbb`. */
	background?: string;
}

/** Tunables for {@link buildSmartArt3DModel}. */
export interface SmartArt3DModelOptions {
	/**
	 * Extrusion depth as a fraction of each node's smaller footprint dimension.
	 * Ignored when {@link depth} is set. Default `0.35`.
	 */
	depthRatio?: number;
	/** Fixed extrusion depth in layout pixels; overrides {@link depthRatio}. */
	depth?: number;
	/** Bevel size as a fraction of the extrusion depth. Default `0.2`. */
	bevelRatio?: number;
	/** Background chrome colour, `#rrggbb`. */
	background?: string;
	/**
	 * Arrange nodes in genuine 3D space per layout family (cycle -> carousel
	 * ring, hierarchy -> layered tree, pyramid -> stacked tiers) instead of the
	 * flat extruded layout. Families without a spatial form keep the flat
	 * layout. Default `false` (phase 1 extruded behaviour).
	 */
	spatial?: boolean;
}
