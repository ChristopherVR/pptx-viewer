/**
 * table-style-effect-parse.ts - pure parse of an `a:effectLst` (or the
 * top-level children of an `a:effectDag`) into a typed
 * {@link ParsedTableStyleEffect} chain.
 *
 * Used by `PptxTableDataParser` to decompose `a:tblPr`'s OWN effect list
 * (issue G6) instead of recording only a `tableEffects` presence boolean.
 * Deliberately shallow: each leaf keeps its raw XML for lossless re-emit
 * rather than this module re-deriving the full shadow/glow/reflection
 * taxonomy `ShapeStyle` already models for shapes, since a table's own
 * effect list is a rare, mostly non-PowerPoint-authored construct (real
 * PowerPoint decks route appearance through `tableStyleId`).
 *
 * @module table-style-effect-parse
 */
import type { ParsedTableStyleEffect, XmlObject } from '../../types';

/**
 * The `CT_EffectList` leaf element names (ECMA-376 §20.1.8.24). `a:effectDag`
 * also nests `a:effect` containers whose own children reuse this same leaf
 * vocabulary; this parser only walks the direct-child case (`a:effectLst`),
 * which is what `a:tblPr`/`a:tblBg` actually carry. Kept as a Set (not an
 * ordering source: see {@link parseTableEffectChain}) purely to reject
 * attribute keys and anything else that is not a real effect leaf.
 */
const EFFECT_LEAF_NAMES = new Set([
	'cont',
	'effect',
	'alphaBiLevel',
	'alphaCeiling',
	'alphaFloor',
	'alphaInv',
	'alphaMod',
	'alphaModFix',
	'alphaOutset',
	'alphaRepl',
	'biLevel',
	'blend',
	'blur',
	'clrChange',
	'clrRepl',
	'duotone',
	'fill',
	'fillOverlay',
	'glow',
	'grayscl',
	'hsl',
	'innerShdw',
	'lum',
	'outerShdw',
	'prstShdw',
	'reflection',
	'relOff',
	'softEdge',
	'tint',
	'xfrm',
]);

/**
 * Parse an `a:effectLst` XML node into an ordered list of typed effect
 * leaves. Order follows the SOURCE document (fast-xml-parser preserves
 * object-key insertion order), not a fixed schema order, since effect
 * application order is meaningful and a round-trip must not silently
 * reshuffle it. Returns `undefined` for an absent/empty node so callers can
 * `...(chain ? { tableEffects: chain } : {})` the same way every other
 * optional field on the table model is assembled.
 */
export function parseTableEffectChain(
	effectLst: XmlObject | undefined,
): ParsedTableStyleEffect[] | undefined {
	if (!effectLst) {
		return undefined;
	}
	const chain: ParsedTableStyleEffect[] = [];
	for (const key of Object.keys(effectLst)) {
		if (key.startsWith('@_')) {
			continue;
		}
		const kind = key.startsWith('a:') ? key.slice('a:'.length) : key;
		if (!EFFECT_LEAF_NAMES.has(kind)) {
			continue;
		}
		const raw = effectLst[key];
		if (raw === undefined || raw === null) {
			continue;
		}
		const nodes = Array.isArray(raw) ? raw : [raw];
		for (const node of nodes) {
			chain.push({ kind, xml: (node ?? {}) as XmlObject });
		}
	}
	return chain.length > 0 ? chain : undefined;
}

/**
 * Rebuild an `a:effectLst` XML node from a typed effect chain, for lossless
 * re-emit of what {@link parseTableEffectChain} read. Multiple leaves of the
 * same kind (rare, but legal) are collapsed back into an array under that
 * key, matching fast-xml-parser's own repeated-element convention.
 */
export function writeTableEffectChain(chain: ParsedTableStyleEffect[]): XmlObject {
	const effectLst: XmlObject = {};
	for (const { kind, xml } of chain) {
		const key = `a:${kind}`;
		const existing = effectLst[key];
		if (existing === undefined) {
			effectLst[key] = xml;
		} else if (Array.isArray(existing)) {
			existing.push(xml);
		} else {
			effectLst[key] = [existing as XmlObject, xml];
		}
	}
	return effectLst;
}
