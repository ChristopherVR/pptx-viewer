import type { PptxAttributeAnimation, XmlObject } from '../types';
import { extractAttrNameFromCBhvr } from './native-animation-attr-name';
import { normalizeCalcMode } from './native-animation-cbhvr-attrs';
import { extractStartConditionDelayMs, readTimingAttr } from './native-animation-extended-helpers';
import { ensureArray, extractKeyframes } from './native-animation-helpers';

/**
 * Preserve every generic `p:anim` sibling in one effect wrapper.
 *
 * PowerPoint composes these behaviours. A Grow and Turn entrance, for
 * example, commonly stores width, height, and rotation in three adjacent
 * `p:anim` nodes. Keeping only the first node loses two thirds of the authored
 * transform and forces playback onto an approximate preset.
 */
export function extractAttributeAnimations(
	childTnList: XmlObject | undefined,
): PptxAttributeAnimation[] | undefined {
	if (!childTnList) {
		return undefined;
	}

	const components: PptxAttributeAnimation[] = [];
	for (const node of ensureArray(childTnList['p:anim'])) {
		const attrName = extractAttrNameFromCBhvr(node['p:cBhvr'] as XmlObject | undefined);
		const keyframes = extractKeyframes(node);
		if (!attrName || !keyframes || keyframes.length === 0) {
			continue;
		}

		const behavior = node['p:cBhvr'] as XmlObject | undefined;
		const cTn = behavior?.['p:cTn'] as XmlObject | undefined;
		const calcMode = normalizeCalcMode(node['@_calcmode']);
		components.push({
			attrName,
			keyframes,
			durationMs: readTimingAttr(cTn?.['@_dur']),
			delayMs: cTn ? extractStartConditionDelayMs(cTn) : undefined,
			...(calcMode ? { calcMode } : {}),
		});
	}

	return components.length > 0 ? components : undefined;
}
