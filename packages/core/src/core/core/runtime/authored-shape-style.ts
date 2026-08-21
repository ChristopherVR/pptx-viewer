import type { ShapeStyle } from '../../types';

/**
 * Decide, per property, whether a shape's `spPr` may carry it.
 *
 * ## Why this exists
 *
 * `<p:style>` is a LINK, not a value. `<a:fillRef idx="1"><a:schemeClr
 * val="accent1"/></a:fillRef>` says "paint me with fill style 1 of the theme's
 * format scheme, with `phClr` bound to accent1" (ECMA-376 §20.1.4.2.10,
 * §20.1.2.2.36), and `<a:lnRef>` says the same for the outline. A shape that
 * authors no `spPr` fill and no `spPr/a:ln` fill is painted entirely by those
 * references, which is what makes Recolor, Reset and a theme change move it.
 *
 * The load pipeline resolves the references into one flat {@link ShapeStyle},
 * because that is what a renderer needs. Writing the flat style back turns
 * every link into a literal, and an `spPr` fill OUTRANKS `fillRef`, so the
 * shape stops following the theme after a single save. Measured on
 * `issue-132-hr-deck.pptx`, a re-serialized deck gained 81 `a:srgbClr` and lost
 * 250 `a:schemeClr`, and 361 outlines acquired a baked `w=` they never had.
 *
 * ## The rule
 *
 * Emit a property when it no longer agrees with what the reference resolved
 * to. That is how an EDIT is recognised: an editor mutates the flat style and
 * knows nothing about the baseline, so anything it changed differs, while
 * anything untouched still matches and can be left to the reference.
 *
 * When no baseline was recorded the shape has no style reference for that
 * aspect (or did not come from a parsed deck at all), the flat style is the
 * only description of it, and everything is written exactly as before.
 *
 * @see authored-run-style.ts - the run-scope twin of this decision.
 */
export type ShapeStyleGate = (...keys: Array<keyof ShapeStyle>) => boolean;

/**
 * Fill properties `resolveThemeFillRef` derives from `<a:fillRef>`. The
 * baseline snapshot covers exactly these, so a change to any of them (a
 * recolour, a switch to a gradient, an explicit "no fill") is detected.
 */
export const STYLE_MATRIX_FILL_KEYS: readonly (keyof ShapeStyle)[] = [
	'fillMode',
	'fillColor',
	'fillOpacity',
	'fillGradient',
	'fillGradientStops',
	'fillGradientAngle',
	'fillGradientType',
	'fillPatternPreset',
	'fillPatternBackgroundColor',
];

/** Outline properties `resolveThemeLineRef` derives from `<a:lnRef>`. */
export const STYLE_MATRIX_LINE_KEYS: readonly (keyof ShapeStyle)[] = [
	'strokeColor',
	'strokeOpacity',
	'strokeWidth',
	'strokeDash',
	'lineJoin',
	'lineCap',
	'compoundLine',
];

/**
 * Effect/3D properties `resolveThemeEffectRef` derives from `<a:effectRef>`:
 * shadow, inner shadow, glow, soft edge, reflection, and the format scheme's
 * 3D scene/shape. The baseline snapshot (`PptxShapeStyleExtractor`) covers
 * exactly these, so a change to any of them - a new shadow, an edited glow
 * radius, a cleared reflection - is detected.
 */
export const STYLE_MATRIX_EFFECT_KEYS: readonly (keyof ShapeStyle)[] = [
	'shadowColor',
	'shadowBlur',
	'shadowOffsetX',
	'shadowOffsetY',
	'shadowOpacity',
	'innerShadowColor',
	'innerShadowBlur',
	'innerShadowOffsetX',
	'innerShadowOffsetY',
	'innerShadowOpacity',
	'glowColor',
	'glowRadius',
	'glowOpacity',
	'softEdgeRadius',
	'reflectionBlurRadius',
	'reflectionStartOpacity',
	'reflectionEndOpacity',
	'reflectionEndPosition',
	'reflectionDirection',
	'reflectionRotation',
	'reflectionDistance',
	'scene3d',
	'shape3d',
];

/**
 * Effect fields `resolveThemeEffectRef` never populates. A theme's
 * `effectStyleLst` entry cannot express a Gaussian blur, a preset-shadow
 * name, or an effect DAG, so any of these being present always means
 * something was authored beyond the reference, and `spPr/a:effectLst` must be
 * written even when every {@link STYLE_MATRIX_EFFECT_KEYS} property still
 * matches the baseline.
 */
const EFFECT_AUTHORED_ONLY_KEYS: readonly (keyof ShapeStyle)[] = [
	'blurRadius',
	'presetShadowName',
	'effectDagXml',
	'effectDagTree',
];

/**
 * Snapshot the given keys of a style as an inheritance baseline.
 *
 * Values are copied by REFERENCE (a gradient stop array is shared with the
 * flat style, not cloned), so the snapshot costs one small object per shape
 * and an editor that replaces an array still registers as a change.
 */
export function captureStyleBaseline(
	style: ShapeStyle,
	keys: readonly (keyof ShapeStyle)[],
): ShapeStyle {
	const baseline: ShapeStyle = {};
	for (const key of keys) {
		const value = style[key];
		if (value !== undefined) {
			// One assignment per key, so the union stays sound without a cast
			// per property; `baseline` is a fresh object of the same shape.
			(baseline as Record<string, unknown>)[key] = value;
		}
	}
	return baseline;
}

/** True when every listed key still holds what the baseline recorded. */
function matchesBaseline(
	style: ShapeStyle,
	baseline: ShapeStyle,
	keys: readonly (keyof ShapeStyle)[],
): boolean {
	return keys.every((key) => style[key] === baseline[key]);
}

/**
 * True when the shape's fill is still exactly what `<a:fillRef>` resolved to,
 * so `spPr` must stay fill-less and let the reference paint it.
 *
 * False when there is no such baseline (the shape authored its own fill, has
 * no `<p:style>`, or was built by the SDK) or when anything about the fill has
 * changed since load, in which case the concrete fill is written as usual.
 */
export function fillIsPurelyStyleMatrix(style: ShapeStyle): boolean {
	const baseline = style.inheritedFillStyle;
	return baseline !== undefined && matchesBaseline(style, baseline, STYLE_MATRIX_FILL_KEYS);
}

/**
 * Build the ownership predicate for one shape's outline. The predicate answers
 * "may `spPr/a:ln` carry any of these keys?", taking several at once because a
 * single decision is often driven by a group of them (the width and the fill
 * are written together, since a zero width means `a:noFill`).
 */
export function createLineStyleGate(style: ShapeStyle): ShapeStyleGate {
	const baseline = style.inheritedLineStyle;
	if (!baseline) {
		return () => true;
	}
	return (...keys) => keys.some((key) => style[key] !== baseline[key]);
}

/**
 * True when the shape's effects (and 3D scene/shape) are still exactly what
 * `<a:effectRef>` resolved from the theme's `effectStyleLst`, so `spPr` must
 * stay effect-less and let the reference paint it.
 *
 * Unlike the outline (`createLineStyleGate`), effects are gated all-or-nothing
 * like fill: `a:effectLst` is a single element per ECMA-376 §20.1.8.30 rather
 * than a set of independently-overridable attributes, and PowerPoint itself
 * bakes the full resolved effect/3D set the moment any part of it is touched.
 * So the whole group is written as soon as ANY of it differs from the
 * baseline, not just the part that changed.
 *
 * False when there is no such baseline (the shape authored its own effects,
 * has no `<p:style>` effectRef, or was built by the SDK), when anything about
 * the effects has changed since load, or when an effect-only field the theme
 * can never supply (blur, a preset-shadow name, an effect DAG) is present.
 */
export function effectIsPurelyStyleMatrix(style: ShapeStyle): boolean {
	const baseline = style.inheritedEffectStyle;
	if (baseline === undefined) {
		return false;
	}
	if (!matchesBaseline(style, baseline, STYLE_MATRIX_EFFECT_KEYS)) {
		return false;
	}
	return EFFECT_AUTHORED_ONLY_KEYS.every((key) => style[key] === undefined);
}
