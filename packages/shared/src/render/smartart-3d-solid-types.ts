/**
 * Pure model types for the lit (bevel / scene quick style) SmartArt 3D path.
 *
 * Split out of `smartart-3d-types.ts` to keep both under the repo's LOC
 * budget. Every length is in layout pixels (the drawing's own EMU / 9525),
 * every angle in degrees, and every point in the mesh-local, y-up space the
 * mesh's `outline` uses.
 *
 * @module render/smartart-3d-solid-types
 */

/** A point in mesh-local 2D space (y-up). */
interface SolidPoint2 {
	x: number;
	y: number;
}

/** One `a:bevelT` / `a:bevelB`, in layout pixels. */
export interface SmartArt3DBevel {
	/** Inset of the bevel from the outline (`@w`). */
	width: number;
	/** Relief of the bevel (`@h`). */
	height: number;
	/** `@prst` profile token (`circle` when absent, per ECMA-376). */
	profile: string;
}

/** A shape's resolved `a:sp3d`, in layout pixels. */
export interface SmartArt3DSolid {
	bevelTop?: SmartArt3DBevel;
	bevelBottom?: SmartArt3DBevel;
	/** Extrusion depth behind the front face (`@extrusionH`). */
	extrusion: number;
	/** Side-wall colour (`a:extrusionClr`), `#rrggbb`; the fill colour when absent. */
	extrusionColor?: string;
	/** Contour rim width around the whole solid (`@contourW`). */
	contourWidth: number;
	/** Contour colour (`a:contourClr`), `#rrggbb`. */
	contourColor?: string;
	/** `@prstMaterial` token. */
	material: string;
}

/** One gradient stop, `offset` in 0..1. */
export interface SmartArt3DGradientStop {
	offset: number;
	color: string;
}

/**
 * A shape's gradient fill, in mesh-local space: linear from `from` to `to`,
 * or radial around `from` with the distance to `to` as its radius.
 */
export interface SmartArt3DGradient {
	kind: 'linear' | 'radial';
	from: SolidPoint2;
	to: SolidPoint2;
	stops: SmartArt3DGradientStop[];
}

/** The light rig (`a:lightRig`) a lit SmartArt scene is shaded with. */
export interface SmartArt3DLighting {
	/** `@rig` token, e.g. `threePt`, `flat`, `morning`. */
	rig: string;
	/** `@dir` token, e.g. `t`, `tl`. */
	direction: string;
	/** Rig revolution about the view axis (`a:rot/@rev`), degrees. */
	revDeg: number;
}

/**
 * The whole-diagram camera of a scene quick style (`dgm:styleDef/dgm:scene3d`).
 *
 * The diagram is rotated about its own centre by `latDeg` (about x), `lonDeg`
 * (about y) and `revDeg` (roll about the view axis), then projected either in
 * parallel or through a pinhole placed `distance` layout px away, and
 * finally scaled by `zoom`.
 */
export interface SmartArt3DCamera {
	projection: 'orthographic' | 'perspective';
	latDeg: number;
	lonDeg: number;
	revDeg: number;
	/**
	 * Camera distance from the diagram centre in layout px (`perspective`
	 * only). Absolute, like PowerPoint's: a larger diagram shows stronger
	 * perspective under the same preset.
	 */
	distance: number;
	/** `a:camera/@zoom` as a fraction (1 = 100%). */
	zoom: number;
}
