/**
 * Refresh the dimensions of an existing ChartEx `cx:data` node from a freshly
 * generated one, keeping any attributes (format codes, level names, extra
 * dimensions) the original carried that the model does not track.
 *
 * @module runtime/chart-cx-update-data
 */

import type { XmlObject } from '../../types';

type GetLocalName = (key: string) => string;

function findKey(node: XmlObject, localName: string, getLocalName: GetLocalName) {
	return Object.keys(node).find((key) => getLocalName(key) === localName);
}

function asArray(value: unknown): XmlObject[] {
	if (value === undefined || value === null) {
		return [];
	}
	return (Array.isArray(value) ? value : [value]).filter(
		(entry): entry is XmlObject => Boolean(entry) && typeof entry === 'object',
	);
}

function dimensionType(node: XmlObject): string {
	return String(node['@_type'] ?? '');
}

/**
 * Replace the `cx:lvl` list of `target` with `source`'s, carrying over the
 * attributes of each level the original already had (`formatCode`, `name`).
 */
function replaceLevels(target: XmlObject, source: XmlObject, getLocalName: GetLocalName): void {
	const targetKey = findKey(target, 'lvl', getLocalName) ?? 'cx:lvl';
	const sourceKey = findKey(source, 'lvl', getLocalName);
	const oldLevels = asArray(target[targetKey]);
	const newLevels = asArray(sourceKey ? source[sourceKey] : undefined).map((level, index) => {
		const old = oldLevels[index];
		if (!old) {
			return level;
		}
		const merged: XmlObject = {};
		for (const key of Object.keys(old)) {
			if (key.startsWith('@_') && key !== '@_ptCount') {
				merged[key] = old[key];
			}
		}
		return { ...level, ...merged };
	});
	target[targetKey] = newLevels.length === 1 ? newLevels[0] : newLevels;
}

/**
 * Replace the dimensions of `target` with the ones in `fresh`, matched by
 * `@type`. Dimensions `fresh` does not carry (extra string dimensions such as
 * `colorStr`) survive untouched. When the original has no dimension of the
 * requested type, the numeric one falls back onto its first numeric dimension
 * (a ChartEx part uses `val`, `size` or `colorVal` depending on layout) and
 * the string one is appended. Mutates `target` in place.
 */
export function replaceChartExDataDimensions(
	target: XmlObject,
	fresh: XmlObject,
	getLocalName: GetLocalName,
): void {
	for (const kind of ['strDim', 'numDim'] as const) {
		const targetKey = findKey(target, kind, getLocalName) ?? `cx:${kind}`;
		const freshKey = findKey(fresh, kind, getLocalName);
		const existing = asArray(target[targetKey]);
		const incoming = asArray(freshKey ? fresh[freshKey] : undefined);
		for (const dimension of incoming) {
			const wantedType = dimensionType(dimension);
			let match = existing.find((candidate) => dimensionType(candidate) === wantedType);
			if (!match && kind === 'numDim') {
				match = existing[0];
			}
			if (!match && kind === 'strDim' && wantedType === 'cat') {
				match = existing.find((candidate) => dimensionType(candidate) === '');
			}
			if (match) {
				replaceLevels(match, dimension, getLocalName);
			} else {
				existing.push(dimension);
			}
		}
		if (existing.length > 0) {
			target[targetKey] = existing.length === 1 ? existing[0] : existing;
		}
	}
}
