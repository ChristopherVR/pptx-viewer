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
	/**
	 * Additional closed loops cut out of {@link outline} as holes (e.g. a
	 * compound custom-geometry shape), in the same mesh-local space. Empty for
	 * the common single-loop case.
	 */
	holes?: Point2[][];
	/** Hint that the outline approximates a circle (drives tessellation). */
	rounded: boolean;
	/** Extrusion depth along +z, in layout pixels. */
	depth: number;
	/** Bevel size; 0 disables bevelling. */
	bevel: number;
	/**
	 * True when this mesh should render as a flat, unlit, zero-depth face
	 * (`ShapeGeometry`) rather than an extruded/bevelled solid
	 * (`ExtrudeGeometry`), matching a PowerPoint flat SmartArt quick style.
	 */
	flat?: boolean;
	/** Fill colour, `#rrggbb`. Ignored (nothing painted) when {@link fillNone}. */
	fill: string;
	/**
	 * The source shape declared `a:noFill`: paint nothing, but the mesh may
	 * still carry a {@link textBlock} (SmartArt commonly stacks an unfilled
	 * label shape over a painted one).
	 */
	fillNone?: boolean;
	/** Resolved data-URI/URL of a picture fill, when the source shape has one (not yet textured). */
	imageUrl?: string;
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
	 * extruded (phase 1) layout and the flat drawing-shape model (rotation is
	 * baked into {@link outline} there); spatial layouts (e.g. the cycle
	 * carousel) rotate blocks to face along the arrangement.
	 */
	rotation: Vec3;
	/** Text label drawn on the front (+z) face (single string; legacy consumers). */
	text: string;
	/**
	 * Pre-laid-out multi-line text matching the 2D SVG projection. Preferred
	 * over {@link text} when present.
	 */
	textBlock?: SmartArt3DTextBlock;
	/** Text colour, `#rrggbb`. */
	textColor: string;
	/** Font size in layout pixels. */
	fontSize: number;
	/** Half-width of the footprint (for sizing the text plane). */
	halfWidth: number;
	/** Half-height of the footprint. */
	halfHeight: number;
}

/**
 * A multi-line text label, pre-laid-out to match the 2D SVG projection
 * (`centeredSvgTextLines`), for the renderer to draw onto a texture/plane
 * rather than re-wrapping text itself.
 */
export interface SmartArt3DTextBlock {
	/** One entry per line; `dy` is the line's offset from the block centre (y-up, layout px). */
	lines: Array<{ text: string; dy: number }>;
	/** World-space centre of the text block. */
	x: number;
	y: number;
	z: number;
	/** Available width/height for the block, in layout pixels. */
	maxWidth: number;
	maxHeight: number;
	/** Text colour, `#rrggbb`. */
	color: string;
	/** Font size in layout pixels. */
	fontSize: number;
	fontFamily?: string;
	fontWeight?: number;
	fontStyle?: 'normal' | 'italic';
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

/**
 * Which PowerPoint quick-style family this model was built for, so the scene
 * builder can pick the right camera/shading/geometry pipeline: `'flat'`
 * (unlit, zero-depth, orthographic matching the 2D viewBox), `'bevel'`
 * (per-shape `orthographicFront` camera + `shape3d` bevel/material, not yet
 * built by any model builder), or `'scene'` (one whole-diagram camera from
 * the quick style, not yet built). Undefined for the legacy layout-engine
 * model (`buildSmartArt3DModel`), which predates this distinction.
 */
export type SmartArt3DStyleCategory = 'flat' | 'bevel' | 'scene';

/** The complete pure 3D model for one SmartArt element. */
export interface SmartArt3DModel {
	meshes: SmartArt3DMesh[];
	connectors: SmartArt3DConnector[];
	bounds: SmartArt3DBounds;
	/** Layout family, used to choose a spatial arrangement. */
	family?: SmartArt3DFamily;
	/** Optional background chrome colour, `#rrggbb`. */
	background?: string;
	/** See {@link SmartArt3DStyleCategory}. */
	styleCategory?: SmartArt3DStyleCategory;
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
	/**
	 * `PptxSmartArtNode.id`s carrying `dgm:prSet/@coherent3DOff="1"` (a per-node
	 * opt-out of PowerPoint's "no two identical" bevel variation a 3-D SmartArt
	 * quick style applies). A mesh whose `RenderedNode.nodeId` is in this set
	 * always gets the plain, un-varied bevel; every other mesh gets a small,
	 * deterministic (hash-of-id) bevel variation so identical shapes do not
	 * render pixel-identical, matching PowerPoint's "coherent 3-D" behaviour.
	 * Absent/empty set: no variation at all (pre-existing behaviour).
	 */
	coherent3DOffNodeIds?: ReadonlySet<string>;
}
