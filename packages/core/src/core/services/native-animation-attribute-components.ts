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
		// PowerPoint writes some built-in presets ("Grow And Turn"'s `ppt_x`
		// fly-in) as a bare `p:anim from="..." to="..."` / `p:anim by="..."`
		// with NO `p:tavLst` child at all (ECMA-376 S19.5.4). Without this
		// fallback those behaviours had no keyframes to extract and were
		// silently dropped, not merely left unhandled downstream.
		const from = node['@_from'] !== undefined ? String(node['@_from']) : undefined;
		const to = node['@_to'] !== undefined ? String(node['@_to']) : undefined;
		const by = node['@_by'] !== undefined ? String(node['@_by']) : undefined;
		const hasKeyframes = Boolean(keyframes && keyframes.length > 0);
		if (
			!attrName ||
			(!hasKeyframes && from === undefined && to === undefined && by === undefined)
		) {
			continue;
		}

		const behavior = node['p:cBhvr'] as XmlObject | undefined;
		const cTn = behavior?.['p:cTn'] as XmlObject | undefined;
		const calcMode = normalizeCalcMode(node['@_calcmode']);
		components.push({
			attrName,
			keyframes: keyframes ?? [],
			durationMs: readTimingAttr(cTn?.['@_dur']),
			delayMs: cTn ? extractStartConditionDelayMs(cTn) : undefined,
			...(calcMode ? { calcMode } : {}),
			...(from !== undefined ? { from } : {}),
			...(to !== undefined ? { to } : {}),
			...(by !== undefined ? { by } : {}),
		});
	}

	return components.length > 0 ? components : undefined;
}
