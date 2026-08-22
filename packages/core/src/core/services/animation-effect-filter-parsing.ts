/**
 * Parser for `p:animEffect/@filter` and `@transition`: the SMIL-style
 * transition-filter grammar ECMA-376 uses for animation effects (ISO/IEC
 * 29500-1 S19.5.3 `CT_TLAnimateEffectBehavior`). The value is a filter
 * family name with an optional parenthesised subtype, e.g. `wipe(up)`,
 * `barn(inVertical)`, `checkerboard(across)`, `slide(fromLeft)`, `fade`.
 * ECMA-376 additionally allows `;`-separated fallback candidates (a viewer
 * uses the first family it recognises); only the first candidate is parsed,
 * matching that "first supported filter wins" rule.
 *
 * `presetId`/`presetClass` remain the primary effect selector; this filter
 * descriptor becomes the fallback used when a preset-table lookup misses
 * (see `resolveEffect` in `pptx-viewer-shared`).
 *
 * @module core/services/animation-effect-filter-parsing
 */
import type { PptxAnimationEffectFilter, XmlObject } from '../types';

/** Match a single `family(subtype)` or bare `family` filter token. */
const FILTER_TOKEN_RE = /^([A-Za-z]+)(?:\(([^)]*)\))?$/;

/**
 * Parse one filter token (already split off any `;`-separated fallback
 * list) into a family name (lowercased) and an optional verbatim-case
 * subtype. Returns `undefined` when the token does not match the expected
 * `name` or `name(subtype)` shape.
 */
export function parseFilterToken(raw: string): { family: string; subtype?: string } | undefined {
	const trimmed = raw.trim();
	if (!trimmed) {
		return undefined;
	}
	const match = FILTER_TOKEN_RE.exec(trimmed);
	if (!match) {
		return undefined;
	}
	const family = match[1].toLowerCase();
	const subtypeToken = match[2];
	const subtype = subtypeToken !== undefined && subtypeToken !== '' ? subtypeToken : undefined;
	return { family, subtype };
}

/**
 * Parse the `p:animEffect` child of a `p:childTnLst` XML object into a
 * {@link PptxAnimationEffectFilter}. Returns `undefined` when there is no
 * `p:animEffect` node, or it carries no `@filter` attribute (an `@filter`-
 * less `p:animEffect` describes no recognisable transition family, so there
 * is nothing useful to fall back to).
 */
export function parseAnimEffectFilter(
	childTnList: XmlObject | undefined,
): PptxAnimationEffectFilter | undefined {
	if (!childTnList) {
		return undefined;
	}
	const rawAnimEffect = childTnList['p:animEffect'];
	const animEffect = Array.isArray(rawAnimEffect) ? rawAnimEffect[0] : rawAnimEffect;
	if (!animEffect || typeof animEffect !== 'object') {
		return undefined;
	}
	const node = animEffect as XmlObject;
	const filterAttr = node['@_filter'];
	if (filterAttr === undefined || filterAttr === null) {
		return undefined;
	}
	const raw = String(filterAttr);
	const firstToken = raw.split(';')[0] ?? '';
	const parsed = parseFilterToken(firstToken);
	if (!parsed) {
		return undefined;
	}
	const transitionAttr = node['@_transition'];
	const transition =
		transitionAttr === 'in' || transitionAttr === 'out' || transitionAttr === 'none'
			? transitionAttr
			: undefined;
	return {
		family: parsed.family,
		subtype: parsed.subtype,
		transition,
		raw,
	};
}
