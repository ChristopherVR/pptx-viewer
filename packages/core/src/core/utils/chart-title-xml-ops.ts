/**
 * Generic XML-tree primitives used by `chart-title-serializer.ts` to locate,
 * reorder, and rewrite nodes inside a parsed chart's `c:chart` / `cx:chart`
 * root while preserving `fast-xml-parser`'s child-key ordering (which encodes
 * document order for this SDK's XML object model).
 *
 * Split out of `chart-title-serializer.ts` to keep that file under the
 * repo's 300-LOC limit; these helpers have no title-specific knowledge.
 *
 * @module utils/chart-title-xml-ops
 */

import type { XmlObject } from '../types';

export type GetLocalName = (key: string) => string;
export type XmlValue = XmlObject[string];

export function findKey(node: XmlObject, localName: string, getLocalName: GetLocalName) {
	return Object.keys(node).find((key) => getLocalName(key) === localName);
}

/** Rewrite `parent` with `entries` as its ordered children (keeps key order). */
export function replaceEntries(
	parent: XmlObject,
	entries: Array<readonly [string, XmlValue]>,
): void {
	for (const key of Object.keys(parent)) {
		delete parent[key];
	}
	for (const [key, value] of entries) {
		parent[key] = value;
	}
}

/** Insert `key: value` at `index` in `parent`'s child order. */
export function insertAt(parent: XmlObject, index: number, key: string, value: XmlValue): void {
	const entries = Object.keys(parent).map((k) => [k, parent[k]] as const);
	entries.splice(Math.max(0, Math.min(index, entries.length)), 0, [key, value] as const);
	replaceEntries(parent, entries);
}

/** Set (or insert, right after the title) the `c:autoTitleDeleted` flag. */
export function setAutoTitleDeleted(
	chartRoot: XmlObject,
	deleted: boolean,
	getLocalName: GetLocalName,
) {
	const value = { '@_val': deleted ? '1' : '0' };
	const existingKey = findKey(chartRoot, 'autoTitleDeleted', getLocalName);
	if (existingKey) {
		chartRoot[existingKey] = value;
		return;
	}
	const keys = Object.keys(chartRoot);
	const titleIndex = keys.findIndex((key) => getLocalName(key) === 'title');
	insertAt(chartRoot, titleIndex === -1 ? 0 : titleIndex + 1, 'c:autoTitleDeleted', value);
}

/** Collect every `a:t` text value under `node`, walking depth-first, in document order. */
export function collectAllText(node: XmlObject, getLocalName: GetLocalName, out: string[]): void {
	for (const key of Object.keys(node)) {
		if (key.startsWith('@_')) {
			continue;
		}
		const value = node[key];
		const children = Array.isArray(value) ? value : [value];
		if (getLocalName(key) === 't') {
			for (const child of children) {
				if (child === undefined || child === null) {
					continue;
				}
				out.push(
					typeof child === 'object' ? String((child as XmlObject)['#text'] ?? '') : String(child),
				);
			}
			continue;
		}
		for (const child of children) {
			if (child && typeof child === 'object') {
				collectAllText(child as XmlObject, getLocalName, out);
			}
		}
	}
}

/** Replace the first `a:t` text under `node`, walking depth-first. */
export function replaceFirstText(
	node: XmlObject,
	text: string,
	getLocalName: GetLocalName,
): boolean {
	for (const key of Object.keys(node)) {
		if (key.startsWith('@_')) {
			continue;
		}
		if (getLocalName(key) === 't') {
			const current = node[key];
			node[key] =
				current && typeof current === 'object' && !Array.isArray(current)
					? { ...(current as XmlObject), '#text': text }
					: text;
			return true;
		}
		const value = node[key];
		const children = Array.isArray(value) ? value : [value];
		for (const child of children) {
			if (
				child &&
				typeof child === 'object' &&
				replaceFirstText(child as XmlObject, text, getLocalName)
			) {
				return true;
			}
		}
	}
	return false;
}
