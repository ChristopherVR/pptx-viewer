/**
 * `animation-timeline-absolute` — dynamic CSS `@keyframes` for the absolute
 * `from`/`to` form of `p:animRot` (ST_Angle) and `p:animScale`
 * (percentage), and for a `p:tavLst` ramp attached to a generic `p:anim`
 * behaviour (opacity or colour).
 *
 * {@link buildDynamicKeyframe} / {@link buildDynamicKeyframes} in
 * `animation-timeline-helpers` already handle the RELATIVE `@by` form
 * (`rotationBy` / `scaleByX` / `scaleByY`); this module covers the sibling
 * absolute form, which OOXML allows instead of (or alongside) `@by`:
 * ECMA-376 S19.5.7 CT_TLAnimateRotationBehavior and S19.5.8
 * CT_TLAnimateScaleBehavior both make `from`/`to`/`by` independently
 * optional. Only the relative form was ever read, so a deck that authored
 * "rotate from 0 to 180" (no `@by`) or "scale from 50% to 150%" produced no
 * rotation/scale keyframes at all and the effect silently did nothing.
 *
 * `p:tavLst` (ECMA-376 S19.5.30 CT_TLAnimVariantList) is schema-generic: a
 * `p:anim` node can drive ANY attribute its `p:attrNameLst/p:attrName` names,
 * and until the core parser surfaced that name (`PptxNativeAnimation.attrName`)
 * this module could only guess from the keyframe VALUE shape, which is why it
 * only ever recognised a numeric `[0, 1]` ramp as opacity. With the attribute
 * name available, {@link buildOpacityTavKeyframe} now confirms it against a
 * known opacity name instead of trusting the value shape alone, and
 * {@link buildColorTavKeyframe} covers the sibling case: a multi-stop colour
 * ramp on `fillcolor` / `fill.color` / `style.color` / `stroke.color`, reusing
 * the same attribute -> CSS-property mapping as the dedicated `p:animClr`
 * behaviour (`animation-color.ts`). Every other attribute name (position,
 * size, and anything this module cannot confirm a CSS mapping for) is left on
 * the caller's canned-timing fallback; see `docs/guide/limitations.md`.
 *
 * @module render/animation-timeline-absolute
 */

import type { PptxAnimationKeyframe, PptxNativeAnimation } from 'pptx-viewer-core';

import { resolveCssProperties } from './animation-color';

/**
 * Build an absolute-rotation `@keyframes` block from `rotationFrom`/
 * `rotationTo`, or `undefined` when the animation has no absolute rotation
 * (including when a relative `rotationBy` is present, which the caller
 * already handles and takes priority over this).
 *
 * A `from` with no `to` (or vice versa) still produces a sensible sweep: the
 * missing bound defaults to the other one's value so the animation is a
 * no-op turn rather than being dropped, matching how PowerPoint treats a
 * partially-specified rotation as ending at its one given angle.
 */
export function buildAbsoluteRotationKeyframe(
	anim: Pick<PptxNativeAnimation, 'rotationBy' | 'rotationFrom' | 'rotationTo'>,
	namePrefix: string,
	uid: number,
): { keyframeName: string; css: string } | undefined {
	if (anim.rotationBy !== undefined) {
		return undefined;
	}
	if (anim.rotationFrom === undefined && anim.rotationTo === undefined) {
		return undefined;
	}
	const from = anim.rotationFrom ?? anim.rotationTo ?? 0;
	const to = anim.rotationTo ?? anim.rotationFrom ?? 0;
	const name = `${namePrefix}-${uid}`;
	return {
		keyframeName: name,
		css: `@keyframes ${name} {\n\tfrom { transform: rotate(${from}deg); }\n\tto { transform: rotate(${to}deg); }\n}`,
	};
}

/**
 * Build an absolute-scale `@keyframes` block from `scaleFromX`/`scaleFromY`/
 * `scaleToX`/`scaleToY`, or `undefined` when the animation has no absolute
 * scale (including when a relative `scaleByX`/`scaleByY` is present, which
 * the caller already handles and takes priority over this).
 *
 * A missing `from` defaults to 1 (unscaled) and a missing `to` defaults to
 * the `from` value, mirroring {@link buildAbsoluteRotationKeyframe}'s
 * one-bound-given handling.
 */
export function buildAbsoluteScaleKeyframe(
	anim: Pick<
		PptxNativeAnimation,
		'scaleByX' | 'scaleByY' | 'scaleFromX' | 'scaleFromY' | 'scaleToX' | 'scaleToY'
	>,
	namePrefix: string,
	uid: number,
): { keyframeName: string; css: string } | undefined {
	if (anim.scaleByX !== undefined || anim.scaleByY !== undefined) {
		return undefined;
	}
	if (
		anim.scaleFromX === undefined &&
		anim.scaleFromY === undefined &&
		anim.scaleToX === undefined &&
		anim.scaleToY === undefined
	) {
		return undefined;
	}
	const fromX = anim.scaleFromX ?? 1;
	const fromY = anim.scaleFromY ?? 1;
	const toX = anim.scaleToX ?? fromX;
	const toY = anim.scaleToY ?? fromY;
	const name = `${namePrefix}-${uid}`;
	return {
		keyframeName: name,
		css: `@keyframes ${name} {\n\tfrom { transform: scale(${fromX}, ${fromY}); }\n\tto { transform: scale(${toX}, ${toY}); }\n}`,
	};
}

/** Clamp a value into the closed unit interval. */
function clamp01(value: number): number {
	return Math.max(0, Math.min(1, value));
}

/**
 * Expand SORTED stops into a "hold, then snap" sequence so a `p:anim/@_calcmode
 * ="discrete"` ramp (ECMA-376 S19.5.2 ST_TLAnimateBehaviorCalcMode) snaps to
 * each stop's value with no interpolation, instead of the CSS default of
 * linearly tweening between adjacent stops.
 *
 * For each pair of adjacent stops, an extra entry is inserted a hair (0.01
 * percentage points) before the next stop's own percentage, carrying the
 * PREVIOUS stop's value: the value then holds flat across the whole interval
 * and snaps to the new value only in that last sliver, which reads as
 * instantaneous at normal playback speeds without requiring a `steps()`
 * timing function (which divides the animation's total duration evenly and
 * cannot reproduce irregularly-spaced `p:tav/@_tm` stops).
 */
function toDiscreteStops<T extends { pct: number }>(stops: readonly T[]): T[] {
	if (stops.length === 0) {
		return [];
	}
	const out: T[] = [stops[0]];
	for (let i = 1; i < stops.length; i++) {
		const previous = stops[i - 1];
		const holdPct = Math.max(previous.pct, stops[i].pct - 0.01);
		out.push({ ...previous, pct: holdPct });
		out.push(stops[i]);
	}
	return out;
}

/** `p:attrName` values known to name an opacity attribute. */
const KNOWN_OPACITY_ATTR_NAMES: ReadonlySet<string> = new Set(['style.opacity', 'opacity']);

/**
 * Build a multi-stop opacity `@keyframes` block from a `p:tavLst` keyframe
 * list (parsed onto {@link PptxNativeAnimation.keyframes}), or `undefined`
 * when the list is missing, has fewer than two usable stops, names an
 * attribute other than opacity, or carries a value shape this can't
 * confidently interpret as opacity.
 *
 * `p:tavLst` is schema-generic (ECMA-376 S19.5.30 CT_TLAnimVariantList): a
 * `p:anim` node can drive any numeric/string/color/bool attribute its
 * `p:attrNameLst` names. When the parser DID surface that name
 * ({@link PptxNativeAnimation.attrName}), it is trusted outright: anything
 * other than a known opacity name bails immediately, so e.g. a `ppt_w`
 * size ramp that happens to fall in `[0, 1]` is never misread as opacity.
 * When the name is absent (older parses, or a deck whose `p:cBhvr` omitted
 * `p:attrNameLst` entirely), this falls back to the original heuristic:
 * numeric (`flt`/`int`) stops in the `[0, 1]` fractional range on an
 * EMPHASIS effect, which is exactly what PowerPoint's own "Transparency"
 * effect (and any custom multi-stage fade) writes. Outside that shape the
 * caller keeps its existing (2-stop, canned) behaviour, so nothing regresses.
 */
export function buildOpacityTavKeyframe(
	anim: Pick<PptxNativeAnimation, 'keyframes' | 'presetClass' | 'attrName' | 'calcMode'>,
	namePrefix: string,
	uid: number,
): { keyframeName: string; css: string } | undefined {
	if (anim.presetClass !== 'emph') {
		return undefined;
	}
	if (anim.attrName !== undefined && !KNOWN_OPACITY_ATTR_NAMES.has(anim.attrName)) {
		return undefined;
	}
	const frames = anim.keyframes;
	if (!frames || frames.length < 2) {
		return undefined;
	}

	const stops: Array<{ pct: number; opacity: number }> = [];
	for (const kf of frames as readonly PptxAnimationKeyframe[]) {
		if (typeof kf.tm !== 'number' || !Number.isFinite(kf.tm)) {
			return undefined;
		}
		if (kf.valueType !== 'flt' && kf.valueType !== 'int') {
			return undefined;
		}
		const opacity = Number(kf.value);
		if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
			return undefined;
		}
		// `tm` is in 1000ths of a percent of the effect's own duration (100000 = 100%).
		stops.push({ pct: clamp01(kf.tm / 100000) * 100, opacity });
	}
	stops.sort((a, b) => a.pct - b.pct);
	const renderedStops = anim.calcMode === 'discrete' ? toDiscreteStops(stops) : stops;

	const name = `${namePrefix}-${uid}`;
	const lines = renderedStops.map(
		(s) => `\t${Number(s.pct.toFixed(2))}% { opacity: ${s.opacity}; }`,
	);
	return { keyframeName: name, css: `@keyframes ${name} {\n${lines.join('\n')}\n}` };
}

/** `p:attrName` values known to name a colour attribute with a CSS mapping. */
const KNOWN_COLOR_ATTR_NAMES: ReadonlySet<string> = new Set([
	'fillcolor',
	'fill.color',
	'style.color',
	'stroke.color',
]);

/** Matches a resolved `#rrggbb` hex colour (what the core parser's `decodeKeyframeValue` emits for `a:srgbClr`). */
const HEX_COLOR_RE = /^#[0-9a-f]{6}$/iu;

/**
 * Build a multi-stop colour `@keyframes` block from a `p:tavLst` keyframe
 * list whose `p:attrName` names a known colour attribute (`fillcolor`,
 * `fill.color`, `style.color`, `stroke.color`), or `undefined` when the
 * attribute is unrecognised, there are fewer than two usable stops, or any
 * stop isn't a resolved `#rrggbb` hex colour.
 *
 * This is the sibling of {@link buildOpacityTavKeyframe} for the OTHER shape
 * `p:tavLst` playback can now place with confidence: a full multi-stop colour
 * ramp authored on a generic `p:anim` node, as opposed to the two/three-stop
 * `from`/`to`/`by` model the dedicated `p:animClr` behaviour uses (already
 * handled via {@link PptxNativeAnimation.colorAnimation}, which this
 * function defers to when present so an incidental `p:tavLst` on that same
 * node never overrides it). A scheme-colour token (`a:schemeClr`, e.g.
 * `"accent1"`) cannot be resolved to a CSS colour without theme context this
 * pure function doesn't have, so any non-hex stop also bails to the caller's
 * canned fallback rather than emitting invalid CSS.
 *
 * Reuses {@link resolveCssProperties} (`animation-color.ts`) for the
 * attribute -> CSS-property mapping, the same one `p:animClr` keyframes use,
 * so a `fillcolor` ramp painting an SVG shape's fill behaves identically
 * whichever OOXML behaviour authored it.
 */
export function buildColorTavKeyframe(
	anim: Pick<PptxNativeAnimation, 'keyframes' | 'attrName' | 'colorAnimation' | 'calcMode'>,
	namePrefix: string,
	uid: number,
): { keyframeName: string; css: string } | undefined {
	if (anim.colorAnimation) {
		return undefined;
	}
	if (!anim.attrName || !KNOWN_COLOR_ATTR_NAMES.has(anim.attrName)) {
		return undefined;
	}
	const frames = anim.keyframes;
	if (!frames || frames.length < 2) {
		return undefined;
	}

	const stops: Array<{ pct: number; color: string }> = [];
	for (const kf of frames as readonly PptxAnimationKeyframe[]) {
		if (typeof kf.tm !== 'number' || !Number.isFinite(kf.tm)) {
			return undefined;
		}
		if (kf.valueType !== 'clr') {
			return undefined;
		}
		const color = String(kf.value);
		if (!HEX_COLOR_RE.test(color)) {
			return undefined;
		}
		stops.push({ pct: clamp01(kf.tm / 100000) * 100, color: color.toLowerCase() });
	}
	stops.sort((a, b) => a.pct - b.pct);
	const renderedStops = anim.calcMode === 'discrete' ? toDiscreteStops(stops) : stops;

	const cssProperties = resolveCssProperties(anim.attrName);
	const name = `${namePrefix}-${uid}`;
	const lines = renderedStops.map((s) => {
		const decls = cssProperties.map((prop) => `${prop}: ${s.color};`).join(' ');
		return `\t${Number(s.pct.toFixed(2))}% { ${decls} }`;
	});
	return { keyframeName: name, css: `@keyframes ${name} {\n${lines.join('\n')}\n}` };
}
