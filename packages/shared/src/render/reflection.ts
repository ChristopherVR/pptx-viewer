/**
 * `a:reflection` compositing: a real, cross-browser mirrored copy of an
 * element rather than `-webkit-box-reflect`.
 *
 * `-webkit-box-reflect` is Chromium/WebKit only - Firefox does not implement
 * it at all, so every reflected picture/shape in this app rendered nothing
 * whatsoever in Firefox. It also cannot express `@sx`/`@sy` (scale),
 * `@kx`/`@ky` (skew), `@rot` (independent reflection rotation), `@fadeDir`
 * (fade axis), or `@algn` (anchor), so those five attributes were parsed and
 * round-tripped but never rendered even in a browser that DID support the
 * property.
 *
 * This module replaces it with a wrapper style for a mirrored SIBLING node a
 * binding renders just below (or per `@algn`, from) the source element:
 *   - `transform: scaleY(-1)` does the mirror (the flip `-webkit-box-reflect`
 *     did for free); `scale()`/`skew()`/`rotate()` add `@sx`/`@sy`, `@kx`/
 *     `@ky`, `@rot` on top of it, all CSS properties Firefox has always
 *     supported.
 *   - `mask-image`/`-webkit-mask-image` with a `linear-gradient` alpha ramp
 *     reproduces the fade (`@stA`/`@endA`/`@stPos`/`@endPos`/`@blurRad`), at
 *     an angle driven by `@fadeDir` (falling back to the same "fades toward
 *     the far edge" default `-webkit-box-reflect` always used). `mask-image`
 *     is supported unprefixed in Firefox and Chromium alike (Safari still
 *     wants the `-webkit-` form, hence both properties).
 *   - `transform-origin` encodes `@algn`.
 *
 * The wrapper only supplies POSITION/TRANSFORM/MASK; the binding paints the
 * mirrored CONTENT inside it (the resolved fill CSS from
 * `getComputedFillStyle` for a shape, or a cloned `<img>` for a picture) -
 * this module has no opinion on that, so it stays framework- and
 * content-agnostic like every other decision function in this package.
 *
 * `getTextReflectionWrapperStyle` reuses the same computation for a text run's
 * `a:rPr/a:effectLst/a:reflection`: the OOXML element is identical
 * (`CT_ReflectionEffect`), but core's text-run parser (
 * `PptxHandlerRuntimeTextRunEffects.ts`) only extracts `@stA`/`@endA`/`@dist`/
 * `@blurRad` onto {@link TextStyle} today (`textReflection*`), not
 * `@sx`/`@sy`/`@kx`/`@ky`/`@rot`/`@fadeDir`/`@algn`/`@stPos`/`@endPos` the way
 * the shape parser does onto {@link ShapeStyle} - so a text run's reflection
 * always renders as the "plain" wrapper (straight mirror, default fade axis
 * and anchor) until that parser gap is closed. No fork was needed to reuse
 * {@link getReflectionWrapperStyle}: the four attributes text DOES carry map
 * onto the exact same {@link ShapeStyle} field names it already reads.
 *
 * @module render/reflection
 */
import type { ShapeStyle, TextStyle } from 'pptx-viewer-core';

/** Clamp a number to the inclusive `[0, 1]` range. */
function clampUnit(value: number): number {
	return value < 0 ? 0 : value > 1 ? 1 : value;
}

/**
 * CSS `mask-image`/`-webkit-mask-image` value plus the raw `transform` for a
 * mirrored reflection sibling. Every value is a ready-to-apply CSS string (or
 * `'none'` sentinel avoided - fields are omitted when the browser default
 * already matches), so a binding can spread this directly onto its own style
 * object with no further per-framework logic.
 */
export interface ReflectionWrapperStyle {
	position: 'absolute';
	left: string;
	/** `calc(100% + <dist>px)`: sits `@dist` px below the source element's box. */
	top: string;
	width: string;
	height: string;
	/** Mirror (`scaleY(-1)`) composed with `@sx`/`@sy`/`@kx`/`@ky`/`@rot`. */
	transform: string;
	/** Anchor point for the transform above, from `@algn` (default `center top`). */
	transformOrigin: string;
	maskImage: string;
	WebkitMaskImage: string;
	pointerEvents: 'none';
}

/** `@algn` (CT_ReflectionEffect) → CSS `transform-origin`, a 3x3 anchor grid. */
const ALGN_TRANSFORM_ORIGIN: Record<string, string> = {
	tl: 'left top',
	t: 'center top',
	tr: 'right top',
	l: 'left top',
	ctr: 'center top',
	r: 'right top',
	bl: 'left bottom',
	b: 'center bottom',
	br: 'right bottom',
};

/**
 * Build the mask-image alpha-gradient value: a linear ramp from
 * `startOpacity` (optionally held for `holdPx`) through an optional blur
 * midpoint down to `endOpacity`, at `cssAngleDeg`. Mirrors the gradient
 * shape `-webkit-box-reflect`'s CSS-gradient mask always used, generalised to
 * an arbitrary angle for `@fadeDir` and expressed as alpha (`rgba(0,0,0,a)`)
 * rather than white, since a CSS mask reads the ALPHA channel of a gradient,
 * not its colour.
 */
function buildReflectionMaskGradient(
	cssAngleDeg: number,
	startOpacity: number,
	endOpacity: number,
	fadeLength: number,
	blurRadius: number,
	holdPx: number,
): string {
	const effectiveFadeLength = fadeLength + blurRadius * 2;
	const midOpacity = (startOpacity + endOpacity) / 2;
	const midPoint = Math.round(effectiveFadeLength * 0.5);
	const holdStop = holdPx > 0 ? `, rgba(0,0,0,${startOpacity}) ${holdPx}px` : '';

	if (blurRadius > 0) {
		return (
			`linear-gradient(${cssAngleDeg}deg, rgba(0,0,0,${startOpacity}) 0px${holdStop}, ` +
			`rgba(0,0,0,${midOpacity}) ${midPoint}px, rgba(0,0,0,${endOpacity}) ${effectiveFadeLength}px)`
		);
	}
	return (
		`linear-gradient(${cssAngleDeg}deg, rgba(0,0,0,${startOpacity}) 0px${holdStop}, ` +
		`rgba(0,0,0,${endOpacity}) ${fadeLength}px)`
	);
}

/**
 * Compute the reflection wrapper style for a {@link ShapeStyle}, given the
 * element height (needed to convert `@endPos`'s fraction into a px fade
 * length, matching the OOXML semantics).
 *
 * @returns `undefined` when the element has no reflection.
 */
export function getReflectionWrapperStyle(
	style: ShapeStyle | undefined,
	elementHeight: number,
): ReflectionWrapperStyle | undefined {
	if (!style) {
		return undefined;
	}
	const hasReflection =
		(typeof style.reflectionStartOpacity === 'number' && style.reflectionStartOpacity > 0) ||
		(typeof style.reflectionDistance === 'number' && style.reflectionDistance > 0) ||
		(typeof style.reflectionBlurRadius === 'number' && style.reflectionBlurRadius > 0);
	if (!hasReflection) {
		return undefined;
	}

	const distance = style.reflectionDistance ?? 0;
	const startOpacity = clampUnit(
		typeof style.reflectionStartOpacity === 'number' ? style.reflectionStartOpacity : 0.5,
	);
	const endOpacity = clampUnit(
		typeof style.reflectionEndOpacity === 'number' ? style.reflectionEndOpacity : 0,
	);
	const fadeLength =
		typeof style.reflectionEndPosition === 'number'
			? Math.round(style.reflectionEndPosition * Math.max(elementHeight, 1))
			: 100;
	const blurRadius =
		typeof style.reflectionBlurRadius === 'number' ? Math.max(0, style.reflectionBlurRadius) : 0;
	// `@stPos`: a 0-1 fraction of the fade length the reflection holds at full
	// `startOpacity` before the fade begins.
	const holdPx =
		typeof style.reflectionStartPosition === 'number' && style.reflectionStartPosition > 0
			? Math.round(Math.min(clampUnit(style.reflectionStartPosition) * fadeLength, fadeLength - 1))
			: 0;

	// `@fadeDir` (falling back to the default "downward" `@dir`/90deg
	// `-webkit-box-reflect` always assumed) is an OOXML angle: 0deg points
	// right, increasing clockwise. CSS `linear-gradient(<angle>)` has 0deg
	// point up, increasing clockwise, so OOXML 90deg (down) needs +90 to land
	// on CSS 180deg (also down) - `cssAngle = ooxmlAngle + 90`.
	const fadeDirectionDeg = style.reflectionFadeDirection ?? 90;
	const cssAngleDeg = (((fadeDirectionDeg + 90) % 360) + 360) % 360;

	const scaleX = (style.reflectionScaleX ?? 100000) / 100000;
	const scaleY = (style.reflectionScaleY ?? 100000) / 100000;
	const skewX = (style.reflectionSkewX ?? 0) / 60000;
	const skewY = (style.reflectionSkewY ?? 0) / 60000;
	const rotation = (style.reflectionRotation ?? 0) / 60000;

	const transformParts = ['scaleY(-1)'];
	if (scaleX !== 1 || scaleY !== 1) {
		transformParts.push(`scale(${scaleX}, ${scaleY})`);
	}
	if (skewX !== 0 || skewY !== 0) {
		transformParts.push(`skew(${skewX}deg, ${skewY}deg)`);
	}
	if (rotation !== 0) {
		transformParts.push(`rotate(${rotation}deg)`);
	}

	const maskImage = buildReflectionMaskGradient(
		cssAngleDeg,
		startOpacity,
		endOpacity,
		fadeLength,
		blurRadius,
		holdPx,
	);

	return {
		position: 'absolute',
		left: '0',
		top: `calc(100% + ${Math.round(distance)}px)`,
		width: '100%',
		height: '100%',
		transform: transformParts.join(' '),
		transformOrigin: ALGN_TRANSFORM_ORIGIN[style.reflectionAlignment ?? 'ctr'] ?? 'center top',
		maskImage,
		WebkitMaskImage: maskImage,
		pointerEvents: 'none',
	};
}

/**
 * {@link getReflectionWrapperStyle} for a text run's `TextStyle`, so a
 * binding's text renderer paints the SAME cross-browser mirrored-sibling
 * wrapper a shape/picture does, rather than a second, `-webkit-box-reflect`
 * based implementation.
 *
 * Maps the four `textReflection*` fields core's text-run parser extracts
 * today onto the identically-named {@link ShapeStyle} fields
 * {@link getReflectionWrapperStyle} already reads, then delegates entirely -
 * no reflection maths is duplicated here. `textReflectionStartOpacity`
 * defaults to `0.5` (matching the CSS this replaces) so a bare
 * `<a:reflection/>` with no attributes still renders, exactly as it did
 * through `-webkit-box-reflect`'s implicit default. The scale/skew/rotation/
 * fade-direction/anchor/hold-position attributes {@link getReflectionWrapperStyle}
 * also accepts have no `TextStyle` equivalent yet (see the module doc), so a
 * text reflection always renders with their defaults (straight mirror, fade
 * toward the far edge, top-centre anchor) until core's text-run parser is
 * extended to match its shape-parser counterpart.
 *
 * @returns `undefined` when the run has no reflection.
 */
export function getTextReflectionWrapperStyle(
	style: TextStyle | undefined,
	elementHeight: number,
): ReflectionWrapperStyle | undefined {
	if (!style?.textReflection) {
		return undefined;
	}
	return getReflectionWrapperStyle(
		{
			reflectionStartOpacity: style.textReflectionStartOpacity ?? 0.5,
			reflectionEndOpacity: style.textReflectionEndOpacity ?? 0,
			reflectionDistance: style.textReflectionOffset ?? 0,
			reflectionBlurRadius: style.textReflectionBlur ?? 0,
		},
		elementHeight,
	);
}
