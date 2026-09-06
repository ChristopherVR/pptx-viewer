/**
 * Resolve `ppt_x`/`ppt_y`/`ppt_w`/`ppt_h` geometry formulas (a `p:anim`
 * targeting one of those four attributes, see `animation-ppt-formula.ts`)
 * into CSS-ready transform deltas/ratios, WITHOUT knowing the animated
 * shape's real rendered box.
 *
 * Split out of `animation-attribute-transform.ts` to keep that file under the
 * repo's 300-LOC guideline; see `animation-ppt-formula-ground-truth.md` for
 * the real-PowerPoint samples this logic was derived from.
 *
 * @module render/animation-attribute-geometry
 */
import type { PptxAnimationKeyframe, PptxAttributeAnimation } from 'pptx-viewer-core';

import { evaluatePptFormula, PPT_FORMULA_GEOMETRY_VARS } from './animation-ppt-formula';
import type { PptFormulaGeometryVar, PptFormulaVars } from './animation-ppt-formula';
import type { AnimationElementBox } from './animation-render-context';

export type GeometryKind = 'scaleX' | 'scaleY' | 'translateX' | 'translateY';

/**
 * Each geometry kind's own `#ppt_*` variable (ECMA-376 S19.5's
 * `ppt_x`/`ppt_y`/`ppt_w`/`ppt_h`). See `animation-ppt-formula-ground-truth.md`
 * for how these were confirmed against real PowerPoint output: `ppt_x`/`ppt_y`
 * are the shape's own CENTRE (not top-left) as a fraction of the slide, and
 * `ppt_w`/`ppt_h` its size as a fraction; all four are the shape's STATIC,
 * authored geometry, not a "value so far in this animation" quantity.
 */
const GEOMETRY_KIND_SELF_VAR: Readonly<Record<GeometryKind, PptFormulaGeometryVar>> = {
	scaleX: 'ppt_w',
	scaleY: 'ppt_h',
	translateX: 'ppt_x',
	translateY: 'ppt_y',
};

/** Tolerance for the affine/dependency probes below: exact for the clean rational formulas PowerPoint authors. */
const PROBE_EPSILON = 1e-9;

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, value));
}

function geometryVars(
	dollar: number,
	overrides: Partial<Record<PptFormulaGeometryVar, number>>,
): PptFormulaVars {
	return { $: dollar, ppt_h: 0, ppt_w: 0, ppt_x: 0, ppt_y: 0, ...overrides };
}

/** The shape's own authored geometry as `#ppt_x/y/w/h` values (centre-based x/y, per the ground truth doc). */
function realGeometryVars(box: AnimationElementBox, dollar: number): PptFormulaVars {
	return {
		$: dollar,
		ppt_h: box.height,
		ppt_w: box.width,
		ppt_x: box.x + box.width / 2,
		ppt_y: box.y + box.height / 2,
	};
}

/**
 * Resolve a geometry formula against the shape's REAL rendered box: no
 * probing needed, since every `#ppt_x`/`#ppt_y`/`#ppt_w`/`#ppt_h` reference
 * (including ones on a DIFFERENT axis than {@link kind}, e.g. Grow And
 * Turn's `-#ppt_w/2` fly-in on a `ppt_x` node) has a real value to plug in.
 * The absolute result is converted to the same CSS-ready convention the
 * probe-based path below returns: a `translate` DELTA from the shape's own
 * authored position for `translateX`/`translateY`, a `scale` RATIO for
 * `scaleX`/`scaleY`.
 */
function resolveGeometryFormulaWithBox(
	kind: GeometryKind,
	formula: string,
	dollar: number,
	box: AnimationElementBox,
): number | undefined {
	const value = evaluatePptFormula(formula, realGeometryVars(box, dollar));
	if (value === undefined) {
		return undefined;
	}
	if (kind === 'translateX') {
		return value - (box.x + box.width / 2);
	}
	if (kind === 'translateY') {
		return value - (box.y + box.height / 2);
	}
	const selfSize = kind === 'scaleX' ? box.width : box.height;
	return selfSize === 0 ? undefined : value / selfSize;
}

/**
 * Resolve one geometry-formula stop (a `ppt_x`/`ppt_y`/`ppt_w`/`ppt_h`
 * ABSOLUTE value, e.g. `#ppt_x+.4`, `#ppt_w*.05`, a bare `0`) into a
 * transform-ready number.
 *
 * With the shape's real rendered `box` (see
 * {@link resolveGeometryFormulaWithBox}), the formula is evaluated directly
 * against its actual geometry, so a cross-axis reference (Grow And Turn's
 * `-#ppt_w/2` on a `ppt_x` node) resolves exactly instead of falling back.
 *
 * WITHOUT a box, the trick is to probe the formula at three values of its
 * OWN axis variable (0, 1, 2) with every other variable held at 0. If the
 * three probes are not consistent with an affine (straight-line) function of
 * that axis - or if substituting 1 for any OTHER geometry variable changes
 * the result at all - the formula genuinely needs the shape's real geometry
 * and this resolves to `undefined` rather than guess. Otherwise:
 *  - position (`translateX`/`translateY`): the formula must have slope 1 in
 *    its own axis (PowerPoint always writes "my own position plus/minus a
 *    constant", never a scaled position), and the result is the constant
 *    term - exactly the CSS `translate` delta from the shape's own authored
 *    position.
 *  - size (`scaleX`/`scaleY`): the formula must have NO constant term (a
 *    fixed-fraction addition would need the real size to turn into a ratio),
 *    and the result is the slope - exactly the CSS `scale` ratio.
 */
export function resolveGeometryFormula(
	kind: GeometryKind,
	formula: string,
	dollar: number,
	box?: AnimationElementBox,
): number | undefined {
	if (box) {
		return resolveGeometryFormulaWithBox(kind, formula, dollar, box);
	}
	const selfVar = GEOMETRY_KIND_SELF_VAR[kind];
	const at = (overrides: Partial<Record<PptFormulaGeometryVar, number>>): number | undefined =>
		evaluatePptFormula(formula, geometryVars(dollar, overrides));

	const atSelf0 = at({ [selfVar]: 0 });
	const atSelf1 = at({ [selfVar]: 1 });
	const atSelf2 = at({ [selfVar]: 2 });
	if (atSelf0 === undefined || atSelf1 === undefined || atSelf2 === undefined) {
		return undefined;
	}
	const slope = atSelf1 - atSelf0;
	if (Math.abs(atSelf2 - atSelf1 - slope) > PROBE_EPSILON) {
		return undefined; // not affine in its own axis
	}

	for (const otherVar of PPT_FORMULA_GEOMETRY_VARS) {
		if (otherVar === selfVar) {
			continue;
		}
		const atOther0 = at({ [selfVar]: 0, [otherVar]: 0 });
		const atOther1 = at({ [selfVar]: 0, [otherVar]: 1 });
		if (atOther0 === undefined || atOther1 === undefined) {
			return undefined;
		}
		if (Math.abs(atOther1 - atOther0) > PROBE_EPSILON) {
			return undefined; // depends on a geometry variable we have no real value for
		}
	}

	const intercept = atSelf0;
	if (kind === 'translateX' || kind === 'translateY') {
		return Math.abs(slope - 1) <= PROBE_EPSILON ? intercept : undefined;
	}
	return Math.abs(intercept) <= PROBE_EPSILON ? slope : undefined;
}

/**
 * Resolve a `p:anim/@by` DELTA formula (ECMA-376 S19.5.4): unlike `from`/`to`,
 * this is already a delta added to wherever the attribute stands.
 *
 * With `box`, the formula is evaluated directly against the shape's real
 * geometry: Grow And Turn's `(#ppt_h/3+#ppt_w*0.1)` wobble (on a `ppt_x`
 * node, `additive="sum"`) resolves to a real delta instead of falling back.
 * Without it, this needs no self-elimination - only a check that it does not
 * depend on any of the four geometry variables (which we have no real value
 * for) - and `(#ppt_h/3+#ppt_w*0.1)` correctly fails that and falls back.
 */
function resolveByDelta(
	formula: string,
	dollar: number,
	box?: AnimationElementBox,
): number | undefined {
	if (box) {
		return evaluatePptFormula(formula, realGeometryVars(box, dollar));
	}
	const base = evaluatePptFormula(formula, geometryVars(dollar, {}));
	if (base === undefined) {
		return undefined;
	}
	for (const geometryVar of PPT_FORMULA_GEOMETRY_VARS) {
		const probed = evaluatePptFormula(formula, geometryVars(dollar, { [geometryVar]: 1 }));
		if (probed === undefined || Math.abs(probed - base) > PROBE_EPSILON) {
			return undefined;
		}
	}
	return base;
}

/**
 * `$` for a `p:tav` stop under a component-level `fmla`: the stop's own
 * literal `p:val` number. Per the ground truth, PowerPoint writes `@_fmla`
 * once (on the first `p:tav`) for the whole behaviour, while every stop
 * (including later ones with no `@_fmla` of their own) carries its own raw
 * numeric `p:val` that the SAME formula's `$` refers to.
 */
function stopDollar(keyframe: PptxAnimationKeyframe, progress: number): number {
	const numeric = typeof keyframe.value === 'number' ? keyframe.value : Number(keyframe.value);
	return Number.isFinite(numeric) ? numeric : progress;
}

/**
 * Resolve a `ppt_x`/`ppt_y`/`ppt_w`/`ppt_h` component's `p:tavLst` (or
 * `from`/`to`/`by`) into `{progress, value}` stops. `box` is the animated
 * shape's real rendered geometry (slide-fraction units), when known; see
 * {@link resolveGeometryFormula}.
 */
export function resolveGeometryStops(
	kind: GeometryKind,
	component: PptxAttributeAnimation,
	box?: AnimationElementBox,
): Array<{ progress: number; value: number }> | undefined {
	if (component.keyframes.length > 0) {
		// A `p:tav/@_fmla` governs the WHOLE behaviour, not just the one stop
		// that happens to carry the attribute (see {@link stopDollar}).
		const componentFmla = component.keyframes.find((k) => k.fmla !== undefined)?.fmla;
		const stops: Array<{ progress: number; value: number }> = [];
		for (const keyframe of component.keyframes) {
			if (typeof keyframe.tm !== 'number' || !Number.isFinite(keyframe.tm)) {
				return undefined;
			}
			const progress = clamp01(keyframe.tm / 100000);
			const formula = componentFmla ?? String(keyframe.value);
			const dollar = componentFmla !== undefined ? stopDollar(keyframe, progress) : progress;
			const value = resolveGeometryFormula(kind, formula, dollar, box);
			if (value === undefined) {
				return undefined;
			}
			stops.push({ progress, value });
		}
		return stops.length >= 2 ? stops : undefined;
	}

	const selfToken = `#${GEOMETRY_KIND_SELF_VAR[kind]}`;
	if (component.from !== undefined || component.to !== undefined) {
		const from = resolveGeometryFormula(kind, component.from ?? selfToken, 0, box);
		const to = resolveGeometryFormula(kind, component.to ?? selfToken, 1, box);
		return from === undefined || to === undefined
			? undefined
			: [
					{ progress: 0, value: from },
					{ progress: 1, value: to },
				];
	}

	if (component.by !== undefined) {
		const delta = resolveByDelta(component.by, 1, box);
		return delta === undefined
			? undefined
			: [
					{ progress: 0, value: 0 },
					{ progress: 1, value: delta },
				];
	}

	return undefined;
}
