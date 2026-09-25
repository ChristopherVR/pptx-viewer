/**
 * p14 (Office 2010) markup inside a `p:timing` tree: detecting it, and deriving
 * the `mc:Fallback` copy PowerPoint writes beside it.
 *
 * COM-verified against PowerPoint's own SaveAs: the Fallback timing is the
 * Choice timing minus every interactive sequence triggered by a media
 * bookmark (their start condition has nothing to point at without
 * `p14:bmkTgt`) and minus the `p:bldLst`/`p:bldP` entries only those
 * sequences used.
 *
 * @module core/runtime/slide-timing-p14
 */
import type { XmlObject } from '../../types';

/** Any value a parsed XML object can hold under a key. */
type XmlValue = XmlObject[string];

function isXmlObject(value: unknown): value is XmlObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isP14Key(key: string): boolean {
	return (key.startsWith('@_') ? key.slice(2) : key).startsWith('p14:');
}

/** Whether any element or attribute in the tree is p14-qualified. */
export function timingUsesP14(node: unknown): boolean {
	if (Array.isArray(node)) {
		return node.some((item) => timingUsesP14(item));
	}
	if (!isXmlObject(node)) {
		return false;
	}
	return Object.entries(node).some(([key, value]) => isP14Key(key) || timingUsesP14(value));
}

/** Whether a `p:seq` is started by a media bookmark (`p14:bmkTgt`). */
function isBookmarkSequence(seq: XmlObject): boolean {
	const cTn = seq['p:cTn'];
	const stCondLst = isXmlObject(cTn) ? cTn['p:stCondLst'] : undefined;
	const conds = isXmlObject(stCondLst) ? stCondLst['p:cond'] : undefined;
	const list = Array.isArray(conds) ? conds : [conds];
	return list.some((cond) => isXmlObject(cond) && cond['@_evt'] === 'onMediaBookmark');
}

/** Deep copy without p14 markup and without bookmark-triggered sequences. */
function strip(node: unknown): unknown {
	if (Array.isArray(node)) {
		return node.map((item) => strip(item));
	}
	if (!isXmlObject(node)) {
		return node;
	}
	const out: XmlObject = {};
	for (const [key, value] of Object.entries(node)) {
		if (isP14Key(key)) {
			continue;
		}
		if (key === 'p:seq') {
			const kept = (Array.isArray(value) ? value : [value]).filter(
				(seq) => !(isXmlObject(seq) && isBookmarkSequence(seq)),
			);
			if (kept.length === 0) {
				continue;
			}
			out[key] = strip(kept.length === 1 ? kept[0] : kept) as XmlValue;
			continue;
		}
		out[key] = strip(value) as XmlValue;
	}
	return out;
}

/** Every `p:spTgt/@spid` still referenced anywhere in the tree. */
function targetedShapeIds(node: unknown, found: Set<string>): Set<string> {
	if (Array.isArray(node)) {
		node.forEach((item) => targetedShapeIds(item, found));
	} else if (isXmlObject(node)) {
		for (const [key, value] of Object.entries(node)) {
			if (key === 'p:spTgt' && isXmlObject(value) && value['@_spid'] !== undefined) {
				found.add(String(value['@_spid']));
			}
			targetedShapeIds(value, found);
		}
	}
	return found;
}

/** The `mc:Fallback` copy of a p14 timing tree. */
export function stripP14FromTiming(timing: XmlObject): XmlObject {
	const fallback = strip(timing) as XmlObject;
	const bldLst = fallback['p:bldLst'];
	if (!isXmlObject(bldLst)) {
		return fallback;
	}
	const targeted = targetedShapeIds(fallback['p:tnLst'], new Set());
	for (const key of Object.keys(bldLst)) {
		if (key.startsWith('@_')) {
			continue;
		}
		const entries = (Array.isArray(bldLst[key]) ? bldLst[key] : [bldLst[key]]) as unknown[];
		const kept = entries.filter(
			(entry) => !isXmlObject(entry) || targeted.has(String(entry['@_spid'] ?? '')),
		);
		if (kept.length === 0) {
			delete bldLst[key];
		} else {
			bldLst[key] = (kept.length === 1 ? kept[0] : kept) as XmlValue;
		}
	}
	if (!Object.keys(bldLst).some((key) => !key.startsWith('@_'))) {
		delete fallback['p:bldLst'];
	}
	return fallback;
}
