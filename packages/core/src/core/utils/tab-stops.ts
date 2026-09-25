/**
 * Parse and serialize `a:tabLst/a:tab` tab stops.
 *
 * One implementation for every reader (slide paragraphs, placeholder level
 * styles, SmartArt text) and every writer (the paragraph writer and the
 * placeholder level-style serializer), so the default-value rules cannot
 * drift between them.
 *
 * @module tab-stops
 */

import type { TextStyle, XmlObject } from '../types';

const EMU_PER_PX = 9525;

type TabStop = NonNullable<TextStyle['tabStops']>[number];

/**
 * Parse tab stops from `a:pPr > a:tabLst > a:tab`.
 *
 * Each tab has `@_pos` (EMU), `@_algn`, and optional `@_leader`. Returns
 * `undefined` when there is no `a:tabLst` or it holds no `a:tab`.
 */
export function parseTabStops(pPr: XmlObject | undefined): TextStyle['tabStops'] | undefined {
	if (!pPr) {
		return undefined;
	}
	const tabLst = pPr['a:tabLst'] as XmlObject | undefined;
	if (!tabLst) {
		return undefined;
	}

	const tabNodes: XmlObject[] = Array.isArray(tabLst['a:tab'])
		? (tabLst['a:tab'] as XmlObject[])
		: tabLst['a:tab']
			? [tabLst['a:tab'] as XmlObject]
			: [];

	if (tabNodes.length === 0) {
		return undefined;
	}

	return tabNodes.filter((t) => t?.['@_pos'] !== undefined).map(parseTabStop);
}

function parseTabStop(t: XmlObject): TabStop {
	const posRaw = Number.parseInt(String(t['@_pos']), 10);
	const position = Number.isFinite(posRaw) ? posRaw / EMU_PER_PX : 0;
	const rawAlign = String(t['@_algn'] ?? '').trim();
	const align =
		rawAlign === 'ctr' || rawAlign === 'r' || rawAlign === 'dec' ? rawAlign : ('l' as const);
	const leaderVal = String(t['@_leader'] ?? '').trim();
	const leader =
		leaderVal === 'dot' || leaderVal === 'hyphen' || leaderVal === 'underscore'
			? leaderVal
			: undefined;
	// The schema defaults (`algn="l"`, `leader="none"`) are omitted by the
	// writer unless the source spelled them out; remember when it did.
	const alignAuthored = rawAlign === 'l';
	const leaderAuthored = leaderVal === 'none';
	return {
		position,
		align,
		...(leader ? { leader } : {}),
		...(alignAuthored ? { alignAuthored } : {}),
		...(leaderAuthored ? { leaderAuthored } : {}),
	};
}

/**
 * Serialize one typed tab stop to an `a:tab` node (positions px -> EMU).
 * Schema defaults (`algn="l"`, `leader="none"`) are written only when the
 * source authored them, so an unedited `a:tabLst` round-trips exactly.
 */
export function serializeTabStop(tab: TabStop): XmlObject {
	const node: XmlObject = { '@_pos': String(Math.round(tab.position * EMU_PER_PX)) };
	if (tab.align && (tab.align !== 'l' || tab.alignAuthored)) {
		node['@_algn'] = tab.align;
	}
	if (tab.leader && tab.leader !== 'none') {
		node['@_leader'] = tab.leader;
	} else if (!tab.leader && tab.leaderAuthored) {
		node['@_leader'] = 'none';
	}
	return node;
}
