/**
 * `animation-text-style-resolve` - resolves the discrete font-style / colour /
 * size override PowerPoint's font-style emphasis effects apply to their
 * target's text: Bold Flash, Bold Reveal, Underline, Brush On Underline,
 * Font Style / Change Font Style, Change Font Size, and the font-style `p:set`
 * siblings composed alongside Wave / Grow With Color / Teeter.
 *
 * PowerPoint authors these two ways, both already parsed by core:
 *  - A `p:set` discrete (non-interpolated) assignment
 *    ({@link PptxNativeAnimation.setAnimations}, ECMA-376 S19.5.79
 *    CT_TLSetBehavior): the value snaps on once and holds until the effect's
 *    `p:cTn/@fill` says otherwise (Bold Reveal, Underline / Brush On
 *    Underline).
 *  - A generic `p:anim` ramp ({@link PptxNativeAnimation.attributeAnimations},
 *    ECMA-376 S19.5.2 CT_TLAnimateBehavior) whose `p:tavLst` stops are not
 *    numerically interpolatable for a boolean attribute (Bold Flash): only the
 *    LAST stop's value is meaningful, the same "snap at the end" reading
 *    PowerPoint itself gives a discrete `calcMode` ramp.
 *
 * Ground truth (COM `AddEffect` + raw OOXML inspection, see
 * `animation-emphasis-ground-truth-early.ts`): `style.fontWeight` (bold),
 * `style.fontStyle` (italic), `style.textDecorationUnderline` (underline),
 * `style.fontSize` (a numeric ramp: this module reads its FIRST/LAST stop
 * ratio as {@link TextStyleAnimationDescriptor.fontScale}, a relative
 * multiplier rather than an absolute size, since a shape's runs may not all
 * share the authored effect's own reference size), and `style.color` (font
 * colour, distinct from `fillcolor`/`stroke.color`, which the existing
 * `p:animClr` colour-animation path already owns).
 *
 * Deliberately does NOT model a "during" vs "after" phase distinction: the
 * hold-vs-revert decision this effect's `p:cTn/@fill` makes is already
 * computed once, correctly, by `animation-fill-repeat.ts`'s
 * `shouldHoldEndState` (the exact same rule CSS-animation steps already use
 * to decide whether their final frame persists on cleanup) and surfaced on
 * {@link import('./animation-timeline-types').TimelineStep.holdEndState}.
 * `animation-text-style-state.ts` reuses that flag rather than recomputing
 * hold/revert semantics a second time here.
 *
 * @module render/animation-text-style-resolve
 */

import type {
	PptxAttributeAnimation,
	PptxNativeAnimation,
	PptxSetAnimation,
} from 'pptx-viewer-core';

/**
 * Framework-neutral text-style override a font-style emphasis effect applies
 * on top of its target's own authored per-run bold/italic/underline/size/
 * colour. Every binding maps this onto its own text container so it OVERRIDES
 * the runs' inline styles (the runs carry explicit inline styles of their
 * own, so plain CSS inheritance cannot reach them).
 */
export interface TextStyleAnimationDescriptor {
	bold?: boolean;
	italic?: boolean;
	underline?: boolean;
	/** Relative multiplier against each run's own authored font size. */
	fontScale?: number;
	color?: string;
}

/** The three boolean-valued style attrs a `p:set`/`p:anim` can drive. */
const BOOLEAN_ATTR_FIELD: Readonly<Record<string, 'bold' | 'italic' | 'underline'>> = {
	'style.fontweight': 'bold',
	'style.fontstyle': 'italic',
	'style.textdecorationunderline': 'underline',
	// Tolerate the shorter spelling some non-PowerPoint producers use.
	'style.underline': 'underline',
};

const RECOGNIZED_ATTRS: ReadonlySet<string> = new Set([
	...Object.keys(BOOLEAN_ATTR_FIELD),
	'style.fontsize',
	'style.color',
]);

/** Decode a `p:set`/`p:tav` value into the boolean a style attr expects. */
function decodeBooleanAttr(attrName: string, value: string | boolean | number): boolean {
	if (typeof value === 'boolean') {
		return value;
	}
	if (typeof value === 'number') {
		return value !== 0;
	}
	const normalized = value.trim().toLowerCase();
	if (normalized === 'true' || normalized === '1') {
		return true;
	}
	if (normalized === 'false' || normalized === '0' || normalized === '') {
		return false;
	}
	if (attrName === 'style.fontweight') {
		return normalized === 'bold' || normalized === '700';
	}
	if (attrName === 'style.fontstyle') {
		return normalized === 'italic';
	}
	return normalized === 'underline';
}

/** Apply one decoded (attrName, value) pair onto the descriptor being built. */
function applyDecodedValue(
	descriptor: TextStyleAnimationDescriptor,
	attrName: string,
	value: string | boolean | number,
): void {
	const boolField = BOOLEAN_ATTR_FIELD[attrName];
	if (boolField) {
		descriptor[boolField] = decodeBooleanAttr(attrName, value);
		return;
	}
	if (attrName === 'style.color' && typeof value === 'string' && value !== '') {
		descriptor.color = value;
	}
}

function applySetAnimation(
	descriptor: TextStyleAnimationDescriptor,
	entry: PptxSetAnimation,
): void {
	applyDecodedValue(descriptor, entry.attrName, entry.value);
}

/**
 * Apply one `p:anim` ramp component. `style.fontsize` is read as a
 * first-stop -> last-stop RATIO (see the module doc). A boolean attr (Bold
 * Flash's `style.fontweight`) is read as "true if ANY stop is true", not just
 * the last: PowerPoint composes the whole flash-and-revert pattern (e.g.
 * normal -> bold -> normal) inside the SAME ramp, so reading only the final
 * stop would resolve to "never bold" and the flash would never render at
 * all. `style.color`'s last stop is used as-is (there is no boolean
 * "any"-style reading for a colour).
 */
function applyAttributeRamp(
	descriptor: TextStyleAnimationDescriptor,
	component: PptxAttributeAnimation,
): void {
	const stops = component.keyframes;
	if (stops.length === 0) {
		return;
	}
	const last = stops[stops.length - 1];
	if (component.attrName === 'style.fontsize') {
		const firstNumeric = Number(stops[0].value);
		const lastNumeric = Number(last.value);
		if (Number.isFinite(firstNumeric) && firstNumeric !== 0 && Number.isFinite(lastNumeric)) {
			descriptor.fontScale = lastNumeric / firstNumeric;
		}
		return;
	}
	const boolField = BOOLEAN_ATTR_FIELD[component.attrName];
	if (boolField) {
		descriptor[boolField] = stops.some((stop) => decodeBooleanAttr(component.attrName, stop.value));
		return;
	}
	applyDecodedValue(descriptor, component.attrName, last.value);
}

/**
 * Resolve the text-style override an authored effect composes via `p:set`
 * siblings and/or a `style.fontsize`/boolean `p:anim` ramp. Returns
 * `undefined` when the effect carries none of the recognised attrs, so a
 * caller can fall back to the neutral emphasis animation exactly as before.
 */
export function resolveTextStyleAnimation(
	anim: Pick<PptxNativeAnimation, 'setAnimations' | 'attributeAnimations'>,
): TextStyleAnimationDescriptor | undefined {
	const descriptor: TextStyleAnimationDescriptor = {};
	for (const entry of anim.setAnimations ?? []) {
		applySetAnimation(descriptor, entry);
	}
	for (const component of anim.attributeAnimations ?? []) {
		if (RECOGNIZED_ATTRS.has(component.attrName)) {
			applyAttributeRamp(descriptor, component);
		}
	}
	return Object.keys(descriptor).length > 0 ? descriptor : undefined;
}
