/**
 * CSS keyframe generation for shape-geometry morphing.
 *
 * Produces a `clip-path` keyframe animation that interpolates between two
 * elements' resolved outlines across the transition. Because CSS cannot tween
 * arbitrary `path()` shapes on its own, the animation is baked: it samples the
 * interpolated outline at a series of percentage stops and emits each as an
 * explicit `clip-path: path('...')` keyframe.
 *
 * @module render/morph-geometry-keyframes
 */
import type { PptxElement } from 'pptx-viewer-core';

import { resolveElementOutline } from './morph-geometry';
import { interpolateOutline, normalizeOutlinePair } from './morph-geometry-interp';
import type { MorphAnimationStyle, MorphPair } from './morph-types';
import { MORPH_EASING } from './morph-types';

/** Number of intermediate keyframe stops baked into a geometry morph. */
export const GEOMETRY_MORPH_STEPS = 8;

/**
 * Decide whether a matched pair warrants geometry morphing rather than a plain
 * crossfade. True when both elements carry a shape type and those types differ
 * (or their adjustment outlines differ), since same-type same-adjustment shapes
 * already morph correctly via the transform/scale animation.
 *
 * @param pair The matched element pair.
 * @returns True when geometry interpolation should be applied.
 */
export function shouldGeometryMorph(pair: MorphPair): boolean {
	const fromType = (pair.fromElement as { shapeType?: string }).shapeType;
	const toType = (pair.toElement as { shapeType?: string }).shapeType;
	if (!fromType || !toType) {
		return false;
	}
	if (fromType.toLowerCase() !== toType.toLowerCase()) {
		return true;
	}
	const fromAdj = JSON.stringify(
		(pair.fromElement as { shapeAdjustments?: Record<string, number> }).shapeAdjustments ?? {},
	);
	const toAdj = JSON.stringify(
		(pair.toElement as { shapeAdjustments?: Record<string, number> }).shapeAdjustments ?? {},
	);
	return fromAdj !== toAdj;
}

/** Build the per-stop `clip-path` keyframe body for an outline morph. */
function buildClipKeyframeBody(from: PptxElement, to: PptxElement, steps: number): string | null {
	const [fromRing, toRing] = normalizeOutlinePair(
		resolveElementOutline(from),
		resolveElementOutline(to),
	);
	if (fromRing.length === 0 || toRing.length === 0) {
		return null;
	}
	const lines: string[] = [];
	for (let s = 0; s <= steps; s++) {
		const t = s / steps;
		const d = interpolateOutline(fromRing, toRing, t);
		if (!d) {
			return null;
		}
		const pct = Number(((s / steps) * 100).toFixed(2));
		lines.push(`\t${pct}% {\n\t\tclip-path: path('${d}');\n\t}`);
	}
	return lines.join('\n');
}

/**
 * Generate a `clip-path` geometry-morph animation for a matched pair whose
 * shape outline changes. Returns null when the pair does not need geometry
 * morphing or its outlines cannot be resolved.
 *
 * The emitted animation targets the incoming element id and is intended to run
 * alongside the pair's transform/opacity animation, replacing the crossfade for
 * shape-type changes with a true outline tween.
 *
 * @param pair       The matched element pair.
 * @param durationMs Animation duration in milliseconds.
 * @param pairIndex  Index of the pair for unique keyframe naming.
 * @param steps      Number of baked stops (defaults to {@link GEOMETRY_MORPH_STEPS}).
 * @returns A geometry-morph animation style, or null.
 */
export function generateGeometryMorphAnimation(
	pair: MorphPair,
	durationMs: number,
	pairIndex: number,
	steps: number = GEOMETRY_MORPH_STEPS,
): MorphAnimationStyle | null {
	if (!shouldGeometryMorph(pair)) {
		return null;
	}
	const body = buildClipKeyframeBody(pair.fromElement, pair.toElement, steps);
	if (!body) {
		return null;
	}
	const safeName = `pptx-morph-geo-${pairIndex}-${pair.toElement.id.replace(/[^a-zA-Z0-9]/gu, '')}`;
	const keyframes = `\n@keyframes ${safeName} {\n${body}\n}`;
	return {
		elementId: pair.toElement.id,
		animation: `${safeName} ${durationMs}ms ${MORPH_EASING} forwards`,
		keyframes,
	};
}
