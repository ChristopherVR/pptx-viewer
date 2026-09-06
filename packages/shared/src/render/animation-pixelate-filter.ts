/**
 * `animation-pixelate-filter` - the `p:animEffect/@filter="pixelate"` mosaic
 * reveal/conceal: a genuinely blocky, content-preserving grid dissolve built
 * from a small, FIXED set of self-contained SVG `<filter>` data-URIs. Every
 * value is inlined directly inside the generated `@keyframes` CSS text
 * (`filter: url("data:image/svg+xml,...")`), exactly like the diamond/wedge
 * mask reveals' data-URI `mask-image`s in `animation-mask-reveal.ts`: no DOM
 * `<defs>` injection, no per-element id, nothing for a binding to wire up.
 *
 * How the mosaic works (SVG filter primitives only, no canvas/WebGL):
 *  1. `feFlood` paints a small opaque square (the "dot") sized `x=0 y=0
 *     width=<dot> height=<dot>` inside a coordinate space that uses
 *     `primitiveUnits="objectBoundingBox"`, so `<dot>` is a FRACTION of the
 *     element's own box, not an absolute pixel size.
 *  2. `<feComposite in="dot" width="<tile>" height="<tile>"/>` (no `in2`)
 *     re-declares that dot's filter SUBREGION as the larger `<tile>` pitch,
 *     so the dot now sits inside extra transparent margin: this margin is
 *     what becomes the "grout" gap between cells once tiled.
 *  3. `<feTile>` repeats that dot-plus-margin tile across the whole element,
 *     producing an evenly spaced grid of opaque squares.
 *  4. A final `<feComposite in="SourceGraphic" in2="grid" operator="in"/>`
 *     masks `SourceGraphic` through that grid: each visible square shows the
 *     element's OWN real painted content at that screen position (not a
 *     repeated/duplicated sample from elsewhere), and the grout gaps are
 *     fully transparent. This is the standard "SVG pixelate filter" recipe.
 *
 * Because `primitiveUnits="objectBoundingBox"` scales the whole filter with
 * the element's own size, a small FIXED number of filter defs (one per
 * mosaic "coarseness" level, {@link PIXELATE_LEVELS}) covers every element
 * regardless of its pixel dimensions, matching this engine's "one static
 * `@keyframes` block per effect" shape (see `animation-keyframes.ts`'s
 * module doc): nothing here is keyed by element id, unlike
 * `visual-effects.ts`'s per-element soft-edge/duotone `<filter>`s, which DO
 * need a binding to inject matching DOM `<defs>`.
 *
 * CSS cannot interpolate `filter: url(...)` between two distinct filters, so
 * playback is a fixed sequence of DISCRETE steps: coarse -> fine for a
 * reveal (`pixelateIn`), fine -> coarse for a conceal (`pixelateOut`), each
 * one its own keyframe percentage. The browser's default
 * non-interpolatable-property behaviour (hold the earlier value, then flip
 * at the midpoint to the next keyframe's value) turns that into the
 * coarsening/refining animation, while `opacity` keeps ramping smoothly
 * across the same stops.
 *
 * A non-square element gets non-square mosaic cells (objectBoundingBox
 * fractions apply independently to the box's width and height), which is an
 * accepted approximation, the same tradeoff `animation-mask-reveal.ts` makes
 * for `diamondOut`/`wedgeOut`.
 *
 * ## Verified against real PowerPoint: there is no PowerPoint animation here
 *
 * Checked against PowerPoint 2016 (Office16 x64) via COM automation:
 * `Presentation.CreateVideo` on `e2e/fixtures/pixelate-filter.pptx` (a bare,
 * non-preset `p:animEffect filter="pixelate" transition="in"` click step),
 * frame-diffed against an otherwise byte-identical control deck where only
 * the `filter` value was swapped to `"dissolve"` (a real, Basic-gallery,
 * PowerPoint-rendered SMIL filter). The control deck visibly dissolves: an
 * early frame (mid-reveal, dithered) differs pixel-for-pixel from a later,
 * settled frame. The pixelate deck does not: the earliest and latest frames
 * of its click step are byte-for-byte identical, and the target shape is
 * already fully painted at full opacity from the very first rendered frame.
 * PowerPoint 2016 performs NO animation at all for `filter="pixelate"`, not
 * a mosaic, not a fade, not even a hide-then-reveal: it silently snaps
 * straight to the resolved end state, the same way it treats a build effect
 * it cannot interpret.
 *
 * So there is no PowerPoint frame sequence for this module's mosaic to be
 * verified AGAINST. `pixelate` is a schema-legal `ST_TransitionFilterType`
 * value (ECMA-376 20.1.8.49) with no host implementation in real PowerPoint,
 * not a rendered effect whose timing this engine could match. The block-size
 * progression ({@link PIXELATE_LEVELS}) and step count are therefore a
 * deliberate, hand-tuned design choice, not a fit to any PowerPoint
 * reference: they exist so a file authored by a non-PowerPoint tool with
 * this filter value gets a genuine, content-preserving reveal in this viewer
 * instead of the silent instant-snap PowerPoint itself falls back to.
 *
 * @module render/animation-pixelate-filter
 */

/**
 * Mosaic "coarseness" levels, coarsest first: each is the tile pitch as a
 * fraction of the element's own bounding box. Loosely mirrors a progression
 * of on-screen pixel sizes (imagine roughly 32px down to roughly 2px on a
 * typical slide-sized element) expressed as size-independent fractions
 * instead of absolute pixels.
 */
export const PIXELATE_LEVELS: readonly number[] = [0.5, 0.34, 0.24, 0.17, 0.11, 0.07, 0.04];

/**
 * Fraction of each tile pitch that is the visible ("painted") square; the
 * remainder is the transparent grout gap between cells. High enough that
 * cells read as solid mosaic blocks rather than a sparse halftone dot grid.
 */
const DOT_RATIO = 0.82;

/** Round to a fixed precision and strip a trailing `.0000`-style tail. */
function round(value: number, precision: number): number {
	const factor = 10 ** precision;
	return Math.round(value * factor) / factor;
}

/**
 * Percent-encode an SVG document for a `data:image/svg+xml,...` URI.
 * `encodeURIComponent` already escapes everything unsafe inside a CSS
 * `url("...")` string (quotes, angle brackets, `#`, `%`); the trailing
 * `#<filterId>` fragment is appended UN-encoded afterwards, since a percent
 * encoded `#` (`%23`) is treated as literal data rather than a URL fragment
 * and the filter reference silently fails to resolve.
 */
function svgDataUri(svg: string, filterId: string): string {
	return `url("data:image/svg+xml,${encodeURIComponent(svg)}#${filterId}")`;
}

/** Build the single-filter SVG document for one mosaic coarseness level. */
function pixelateFilterMarkup(level: number, filterId: string): string {
	const tile = round(level, 4);
	const dot = round(level * DOT_RATIO, 4);
	return (
		'<svg xmlns="http://www.w3.org/2000/svg">' +
		`<filter id="${filterId}" primitiveUnits="objectBoundingBox" x="-0.5" y="-0.5" width="2" height="2" color-interpolation-filters="sRGB">` +
		`<feFlood x="0" y="0" width="${dot}" height="${dot}" result="dot"/>` +
		`<feComposite in="dot" width="${tile}" height="${tile}" result="tile"/>` +
		'<feTile in="tile" result="grid"/>' +
		'<feComposite in="SourceGraphic" in2="grid" operator="in"/>' +
		'</filter></svg>'
	);
}

/**
 * Ready-to-use `filter: url("data:...")` CSS values, one per
 * {@link PIXELATE_LEVELS} entry (coarsest first, same order/index).
 */
export const PIXELATE_FILTER_VALUES: readonly string[] = PIXELATE_LEVELS.map((level, index) => {
	const filterId = `pptx-pixelate-${index}`;
	return svgDataUri(pixelateFilterMarkup(level, filterId), filterId);
});

/**
 * Build one `@keyframes` block stepping through `order` (a sequence of CSS
 * `filter` values, including the literal `'none'` for the fully-resolved
 * end), with `opacity` ramping linearly from `opacityFrom` to `opacityTo`
 * across the same evenly spaced percentage stops.
 */
function buildSteppedKeyframes(
	name: string,
	order: readonly string[],
	opacityFrom: number,
	opacityTo: number,
): string {
	const lastIndex = order.length - 1;
	const lines = order.map((filterValue, index) => {
		const pct = round((index / lastIndex) * 100, 2);
		const opacity = round(opacityFrom + ((opacityTo - opacityFrom) * index) / lastIndex, 3);
		return `\t${pct}% { opacity: ${opacity}; filter: ${filterValue}; }`;
	});
	return `@keyframes ${name} {\n${lines.join('\n')}\n}`;
}

const ENTRANCE_ORDER: readonly string[] = [...PIXELATE_FILTER_VALUES, 'none'];
const EXIT_ORDER: readonly string[] = ['none', ...[...PIXELATE_FILTER_VALUES].reverse()];

/**
 * `pixelateIn` keyframes: opacity 0 -> 1 while the mosaic refines from the
 * coarsest level down to fully resolved (`filter: none`).
 */
export const PIXELATE_IN_KEYFRAMES: string = buildSteppedKeyframes(
	'pptx-pixelateIn',
	ENTRANCE_ORDER,
	0,
	1,
);

/**
 * `pixelateOut` keyframes: opacity 1 -> 0 while the mosaic coarsens from
 * fully resolved (`filter: none`) down to the coarsest level.
 */
export const PIXELATE_OUT_KEYFRAMES: string = buildSteppedKeyframes(
	'pptx-pixelateOut',
	EXIT_ORDER,
	1,
	0,
);
