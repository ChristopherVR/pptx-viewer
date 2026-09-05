/**
 * Parse `p:set` discrete (non-interpolated) attribute assignments
 * (ECMA-376 S19.5.79 CT_TLSetBehavior) composed alongside an authored
 * effect, into {@link PptxSetAnimation} entries.
 *
 * PowerPoint authors several font-style emphasis effects this way rather
 * than as a `p:anim` keyframe ramp, since there is nothing to interpolate:
 * Bold Reveal / Underline / Bold Flash / Change Font Size all snap a value
 * on at a moment in time via `<p:set><p:cBhvr>.../p:attrNameLst</p:cBhvr>
 * <p:to>...</p:to></p:set>`. `p:to` carries the same CT_TLAnimVariant value
 * wrapper a `p:tav/p:val` does, so this reuses `decodeKeyframeValue`.
 *
 * @module services/native-animation-set-components
 */
import type { PptxSetAnimation, XmlObject } from '../types';
import { extractAttrNameFromCBhvr } from './native-animation-attr-name';
import { extractStartConditionDelayMs, readTimingAttr } from './native-animation-extended-helpers';
import { decodeKeyframeValue, ensureArray } from './native-animation-helpers';

/**
 * Extract every `p:set` sibling behaviour composed inside one effect
 * wrapper's `p:childTnLst`, mirroring `extractAttributeAnimations`'s
 * handling of `p:anim` siblings.
 */
export function extractSetAnimations(
	childTnList: XmlObject | undefined,
): PptxSetAnimation[] | undefined {
	if (!childTnList) {
		return undefined;
	}

	const components: PptxSetAnimation[] = [];
	for (const node of ensureArray(childTnList['p:set'])) {
		const attrName = extractAttrNameFromCBhvr(node['p:cBhvr'] as XmlObject | undefined);
		const toNode = node['p:to'] as XmlObject | undefined;
		if (!attrName || !toNode) {
			continue;
		}
		const decoded = decodeKeyframeValue(toNode);
		if (!decoded) {
			continue;
		}

		const behavior = node['p:cBhvr'] as XmlObject | undefined;
		const cTn = behavior?.['p:cTn'] as XmlObject | undefined;
		components.push({
			attrName,
			value: decoded.value,
			valueType: decoded.valueType,
			durationMs: readTimingAttr(cTn?.['@_dur']),
			delayMs: cTn ? extractStartConditionDelayMs(cTn) : undefined,
		});
	}

	return components.length > 0 ? components : undefined;
}
