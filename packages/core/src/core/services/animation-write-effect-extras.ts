/**
 * Effect-`p:cTn` extras for the full-rebuild animation writer: the repeat
 * attributes, the "until next click" end condition, the `p:iterate` text
 * build and the `@grpId` link to `p:bldP`. Split out of
 * `animation-write-node-effect` (which builds the behaviour tree) so this
 * timing surface can evolve independently of the preset behaviour tables.
 *
 * Ground truth (PowerPoint 2016 via COM, `ConvertToTextUnitEffect` +
 * `SaveAs`): "Animate text: By word / By letter" is written as
 * `<p:iterate type="wd"|"lt"><p:tmPct val="10000"/></p:iterate>` on the
 * effect's own `p:cTn` (between `p:endCondLst` and `p:childTnLst`, per
 * CT_TLCommonTimeNodeData's sequence), and the shape's `p:bldP` carries NO
 * `@build` at all (`build="word"`/`"char"` are not ST_TLParaBuildType values;
 * the schema only allows `whole`, `p` and `cust`). Every effect `p:cTn`
 * carries the `@grpId` its `p:bldP` names.
 *
 * "Repeat: Until Next Click" is `repeatCount="indefinite"` plus an
 * `<p:endCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/>`
 * end condition: without it the repeat never ends ("Until End of Slide" is
 * the bare `repeatCount="indefinite"`).
 *
 * @module services/animation-write-effect-extras
 */
import type { PptxElementAnimation, XmlObject } from '../types';

/** The group id every editor-authored effect and its `p:bldP` share. */
export const EDITOR_BUILD_GROUP_ID = '0';

/** PowerPoint's default "delay between letters/words" (10% of the effect). */
export const DEFAULT_ITERATE_TM_PCT = 10000;

/**
 * Repeat attributes for an effect `p:cTn`: `@repeatCount` in 1000ths, or
 * `indefinite` for both "until next click" and "until end of slide" (the
 * former is told apart by {@link buildUntilNextClickEndCondition}).
 */
export function buildRepeatAttrs(anim: PptxElementAnimation): Record<string, string> {
	const attrs: Record<string, string> = {};
	if (anim.repeatMode === 'untilNextClick' || anim.repeatMode === 'untilEndOfSlide') {
		attrs['@_repeatCount'] = 'indefinite';
		return attrs;
	}
	if (anim.repeatCount && anim.repeatCount > 1) {
		attrs['@_repeatCount'] = String(Math.round(anim.repeatCount * 1000));
	}
	return attrs;
}

/** `p:endCondLst` ending an indefinitely repeating effect on the next click. */
export function buildUntilNextClickEndCondition(): XmlObject {
	return {
		'p:cond': {
			'@_evt': 'onNext',
			'@_delay': '0',
			'p:tgtEl': { 'p:sldTgt': {} },
		},
	};
}

/** `p:iterate` for a by-word / by-letter text build, or `undefined`. */
export function buildIterateNode(anim: PptxElementAnimation): XmlObject | undefined {
	if (anim.sequence !== 'byWord' && anim.sequence !== 'byLetter') {
		return undefined;
	}
	return {
		'@_type': anim.sequence === 'byWord' ? 'wd' : 'lt',
		'p:tmPct': { '@_val': String(DEFAULT_ITERATE_TM_PCT) },
	};
}

/** CT_TLCommonTimeNodeData child order (ECMA-376 §19.5.33). */
const CTN_CHILD_ORDER = [
	'p:stCondLst',
	'p:endCondLst',
	'p:endSync',
	'p:iterate',
	'p:childTnLst',
	'p:subTnLst',
] as const;

/**
 * Re-key `cTn` so its attributes come first and its element children follow
 * the schema sequence. The XML builder serialises keys in insertion order,
 * so an `p:iterate` or `p:endCondLst` added after `p:childTnLst` would
 * otherwise land out of order (a schema violation PowerPoint repairs).
 */
export function orderCTnChildren(cTn: XmlObject): void {
	const entries = Object.entries(cTn);
	const known = new Set<string>(CTN_CHILD_ORDER);
	const attrs = entries.filter(([key]) => !known.has(key));
	for (const key of Object.keys(cTn)) {
		delete cTn[key];
	}
	for (const [key, value] of attrs) {
		cTn[key] = value;
	}
	const byKey = new Map(entries);
	for (const key of CTN_CHILD_ORDER) {
		if (byKey.has(key)) {
			cTn[key] = byKey.get(key);
		}
	}
}

/**
 * Apply the end-condition, iterate and group-id extras to a freshly built
 * effect `p:cTn`, then restore schema child order. Idempotent.
 */
export function applyEffectCTnExtras(effectCTn: XmlObject, anim: PptxElementAnimation): void {
	if (effectCTn['@_grpId'] === undefined) {
		effectCTn['@_grpId'] = EDITOR_BUILD_GROUP_ID;
	}
	if (anim.repeatMode === 'untilNextClick') {
		effectCTn['p:endCondLst'] = buildUntilNextClickEndCondition();
	}
	const iterate = buildIterateNode(anim);
	if (iterate) {
		effectCTn['p:iterate'] = iterate;
	}
	orderCTnChildren(effectCTn);
}
