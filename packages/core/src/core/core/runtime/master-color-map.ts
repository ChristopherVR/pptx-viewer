import type { XmlObject } from '../../types';
import { COLOR_MAP_ALIAS_KEYS } from '../../utils/theme-override-utils';

/** Parse the 12 colour aliases shared by all PresentationML master parts. */
export function parseMasterColorMap(
	node: XmlObject | undefined,
): Record<string, string> | undefined {
	if (!node) {
		return undefined;
	}
	const result: Record<string, string> = {};
	for (const key of COLOR_MAP_ALIAS_KEYS) {
		const value = String(node[`@_${key}`] ?? '').trim();
		if (value) {
			result[key] = value;
		}
	}
	return Object.keys(result).length > 0 ? result : undefined;
}
