/**
 * `animation-timeline-absolute` — dynamic CSS `@keyframes` for the absolute
 * `from`/`to` form of `p:animRot` (ST_Angle) and `p:animScale`
 * (percentage), and for a `p:tavLst` opacity ramp attached to an emphasis
 * effect.
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
 * @module render/animation-timeline-absolute
 */

import type { PptxAnimationKeyframe, PptxNativeAnimation } from 'pptx-viewer-core';

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
 * Build a multi-stop opacity `@keyframes` block from a `p:tavLst` keyframe
 * list (parsed onto {@link PptxNativeAnimation.keyframes}), or `undefined`
 * when the list is missing, has fewer than two usable stops, or carries a
 * value shape this can't confidently interpret as opacity.
 *
 * `p:tavLst` is schema-generic (ECMA-376 S19.5.30 CT_TLAnimVariantList): it
 * can drive any numeric/string/color/bool attribute a `p:anim` node names via
 * `p:attrNameLst`, and the parser does not (yet) surface that attribute name.
 * Rather than guess at an arbitrary property, this only fires for the one
 * shape playback can already place with confidence: numeric (`flt`/`int`)
 * stops in the `[0, 1]` fractional range on an EMPHASIS effect, which is
 * exactly what PowerPoint's own "Transparency" effect (and any custom
 * multi-stage fade) writes. Outside that shape the caller keeps its existing
 * (2-stop, canned) behaviour, so nothing regresses.
 */
export function buildOpacityTavKeyframe(
	anim: Pick<PptxNativeAnimation, 'keyframes' | 'presetClass'>,
	namePrefix: string,
	uid: number,
): { keyframeName: string; css: string } | undefined {
	if (anim.presetClass !== 'emph') {
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

	const name = `${namePrefix}-${uid}`;
	const lines = stops.map((s) => `\t${Number(s.pct.toFixed(2))}% { opacity: ${s.opacity}; }`);
	return { keyframeName: name, css: `@keyframes ${name} {\n${lines.join('\n')}\n}` };
}
