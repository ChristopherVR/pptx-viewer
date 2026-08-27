/**
 * Shared helpers for reading `p:cBhvr/p:attrNameLst/p:attrName` (ECMA-376
 * S19.5.4 CT_TLCommonBehaviorData), the OOXML element that names WHICH
 * attribute a behaviour node (`p:anim`, `p:animClr`, `p:animRot`,
 * `p:animScale`, `p:animMotion`, ...) actually drives.
 *
 * `p:attrName` is a free-form string (`"style.opacity"`, `"fillcolor"`,
 * `"ppt_x"`, ...), not an OOXML enum, so this only normalises the raw text;
 * interpreting it into a CSS mapping is the playback layer's job
 * (`pptx-viewer-shared`).
 */
import type { XmlObject } from '../types';
import { ensureArray } from './native-animation-helpers';

/**
 * Extract the first `p:attrName` from a `p:cBhvr` node's `p:attrNameLst`.
 *
 * `p:attrName` is a TEXT element ("fillcolor" / "style.opacity" / "ppt_x"),
 * so it parses to a plain string (or `{ '#text': ... }` under some XML
 * parsers), NOT an XmlObject - it must NOT go through `ensureArray`, which
 * filters to objects and would silently drop it, leaving every real
 * behaviour with no target attribute.
 *
 * A behaviour can name more than one attribute (e.g. a combined `ppt_x,ppt_y`
 * motion, or a `p:animMotion` with two separate `p:attrName` children); only
 * the first is returned, since a `p:tavLst` keyframe list drives a single
 * value and the callers here only need to classify that one value's target.
 */
export function extractAttrNameFromCBhvr(cBhvr: XmlObject | undefined): string | undefined {
	const attrNameLst = cBhvr?.['p:attrNameLst'] as XmlObject | undefined;
	const rawAttrName = attrNameLst?.['p:attrName'];
	const firstAttrName = Array.isArray(rawAttrName) ? rawAttrName[0] : rawAttrName;
	if (firstAttrName === undefined || firstAttrName === null) {
		return undefined;
	}
	const name = (
		typeof firstAttrName === 'object'
			? String((firstAttrName as XmlObject)['#text'] ?? '')
			: String(firstAttrName)
	)
		.toLowerCase()
		.trim();
	return name !== '' ? name : undefined;
}

/**
 * Find the `p:attrName` belonging to the SAME `p:anim`-style node that
 * {@link extractChildKeyframes} (`native-animation-helpers.ts`) pulls its
 * `p:tavLst` keyframes from, i.e. which attribute a generic keyframe list
 * actually drives. Scans the identical candidate keys in the identical
 * priority order so the two functions always describe the same winning node.
 *
 * Without this, `p:tavLst` keyframes were schema-generic and unattributed:
 * playback could see a numeric ramp but not know whether it drove opacity,
 * position, or something with no sane CSS mapping, so everything but a
 * heuristically-detected opacity ramp fell back to canned timing (see
 * `docs/guide/limitations.md`).
 */
export function extractChildKeyframeAttrName(
	childTnList: XmlObject | undefined,
): string | undefined {
	if (!childTnList) {
		return undefined;
	}
	const candidateKeys = ['p:anim', 'p:animRot', 'p:animScale', 'p:animClr'] as const;
	for (const key of candidateKeys) {
		for (const node of ensureArray(childTnList[key])) {
			if (!node['p:tavLst']) {
				continue;
			}
			const attrName = extractAttrNameFromCBhvr(node['p:cBhvr'] as XmlObject | undefined);
			if (attrName) {
				return attrName;
			}
		}
	}
	return undefined;
}
