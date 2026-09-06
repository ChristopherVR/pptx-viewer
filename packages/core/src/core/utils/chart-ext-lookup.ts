/**
 * chart-ext-lookup.ts: shared low-level helper for finding one `c:ext` child
 * of a `c:extLst` by its `@_uri`, the pattern every Office chart extension
 * (`c15:*`, `c16:*`, `c16r3:*`) is addressed by. Used by both
 * `chart-series-identity.ts` (`c16:uniqueId`) and the chart-chrome parser
 * (`c16r3:dataDisplayOptions16`), so the "find my extension inside extLst"
 * lookup is written once.
 *
 * Dependency-light (a `getLocalName` resolver only, no `XmlLookupService`
 * dependency), matching the rest of the `chart-*` utils family so it stays
 * usable from both the parse side (which has an `XmlLookupService`) and the
 * mutate-in-place save side (which only has a `getLocalName` resolver).
 *
 * @module utils/chart-ext-lookup
 */
import type { XmlObject } from '../types';

export type LocalName = (key: string) => string;

/** Find a direct child of `node` whose local name matches. */
export function findChildByLocalName(
	node: XmlObject | undefined,
	name: string,
	localName: LocalName,
): XmlObject | undefined {
	if (!node) {
		return undefined;
	}
	const key = Object.keys(node).find((candidate) => localName(candidate) === name);
	return key ? (node[key] as XmlObject | undefined) : undefined;
}

/** Find every direct child of `node` whose local name matches, normalised to an array. */
export function findChildrenByLocalName(
	node: XmlObject | undefined,
	name: string,
	localName: LocalName,
): XmlObject[] {
	if (!node) {
		return [];
	}
	const key = Object.keys(node).find((candidate) => localName(candidate) === name);
	if (!key) {
		return [];
	}
	const value = node[key];
	return Array.isArray(value) ? (value as XmlObject[]) : [value as XmlObject];
}

/**
 * Find the `c:ext` child of `node`'s `c:extLst` whose `@_uri` matches, or
 * `undefined` when `node` has no `extLst` or no matching `c:ext`.
 */
export function findChartExtByUri(
	node: XmlObject | undefined,
	localName: LocalName,
	uri: string,
): XmlObject | undefined {
	const extLst = findChildByLocalName(node, 'extLst', localName);
	return findChildrenByLocalName(extLst, 'ext', localName).find((ext) => ext['@_uri'] === uri);
}
