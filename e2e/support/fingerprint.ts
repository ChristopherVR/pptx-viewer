/**
 * Scale-free descriptions of what a binding actually painted.
 *
 * Comparing two bindings pixel-for-pixel fails for uninteresting reasons: the
 * demos fit the slide to their own chrome, so the same deck is rendered at a
 * different zoom in each, and every measurement is off by that factor. A
 * fingerprint removes the factor instead of fighting it.
 *
 *  - Geometry is expressed as a percentage of the stage's on-screen box, so any
 *    uniform zoom cancels out.
 *  - Type sizes are converted to on-screen pixels first, by multiplying the
 *    computed `font-size` through the CSS transforms between the text and the
 *    page, and are then expressed as a percentage of the stage's on-screen
 *    height. Normalising against the stage's *layout* box instead is the
 *    obvious approach and it is wrong: the bindings do not hang
 *    `aria-roledescription="slide"` off the same node in the scaling chain, so
 *    the same 54px title measured that way came out 37% larger in one binding
 *    purely because its stage element sits below the zoom transform rather than
 *    above it.
 *  - Style STRINGS (gradients, shadows, filters, clip paths, borders) need no
 *    such normalisation: every binding lays the slide out at the same unscaled
 *    slide dimensions and only then applies the stage zoom as a transform, so
 *    computed px values are already in slide space and comparable directly.
 *    They are only cleaned of float noise and `url()` payloads (see
 *    `support/fingerprint-capture`).
 *
 * What survives is exactly what should match: relative position, relative type
 * scale, rotation, stacking order, and the non-metric styling (family, weight,
 * colour, alignment, fills, borders, effects).
 *
 * The measurement itself lives in `support/fingerprint-capture` (it must be a
 * single self-contained `page.evaluate` callback); this module owns the shape
 * of the data and re-exports the capture so callers import one place.
 *
 * @module e2e/support/fingerprint
 */

export { fingerprintSlide } from './fingerprint-capture';

/** A box as a percentage of the slide stage (x/y from the stage's top-left). */
export interface FingerprintRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** Typography of the largest text-bearing node inside an element. */
export interface FingerprintType {
	/** On-screen `font-size` as a percentage of the stage's painted height. */
	sizePct: number;
	/** Lower-cased, unquoted family list. */
	family: string;
	weight: string;
	style: string;
	/** On-screen `line-height` as a percentage of stage height (0 if `normal`). */
	lineHeightPct: number;
	/** On-screen `letter-spacing` as a percentage of stage height. */
	letterSpacingPct: number;
	align: string;
	transform: string;
	decoration: string;
	/** `rgb()` / `rgba()` as computed. */
	color: string;
}

/** The four sides of an element's border, each `<width>px <style> <color>` or `none`. */
export interface FingerprintBorders {
	top: string;
	right: string;
	bottom: string;
	left: string;
}

/** One rendered slide element. */
export interface ElementFingerprint {
	/** Stable identity used to pair this element with its counterpart. */
	key: string;
	/** Position in DOM order among the slide's elements. */
	index: number;
	/** Collapsed text content, capped so failure output stays readable. */
	text: string;
	rect: FingerprintRect;
	type: FingerprintType | null;
	/** Computed `background-color` of the element box. */
	background: string;
	/** Shorthand of the element's own top border (legacy single-side capture). */
	border: string;
	/** All four borders. */
	borders: FingerprintBorders;
	/** Computed `background-image`, numbers rounded and `url()` payloads elided. */
	backgroundImage: string;
	/** Computed `box-shadow`, normalised the same way (`none` when absent). */
	boxShadow: string;
	/** Computed `filter`, normalised the same way (`none` when absent). */
	filter: string;
	/** Computed `clip-path`, normalised the same way (`none` when absent). */
	clipPath: string;
	/** Rotation painted onto the element, degrees, rounded to 0.1. */
	rotationDeg: number;
	opacity: number;
	/**
	 * Count of each rendering descendant tag, e.g. `{ img: 2, svg: 1 }`.
	 *
	 * A count, not a de-duplicated set: an element that paints one image where
	 * the reference paints five used to fingerprint identically.
	 */
	kinds: Record<string, number>;
}

/** Everything measurable about the slide currently on the main canvas. */
export interface SlideFingerprint {
	/** Stage width / height, as painted. */
	aspect: number;
	elements: ElementFingerprint[];
}
