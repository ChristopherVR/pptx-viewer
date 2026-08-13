/**
 * Which effect nodes in a slide's `p:timing` tree this editor authored.
 *
 * The editor's animation list (`PptxSlide.animations`) and the deck's native
 * timing tree are two different populations: the list is parsed only from this
 * app's own `pptx:editorMeta` extension, so a PowerPoint-authored deck loads
 * with an EMPTY list next to a fully populated `p:timing`. That makes "the list
 * no longer mentions this shape" useless as a delete signal - it is equally the
 * normal state of every effect PowerPoint wrote. Deleting on that signal would
 * wipe the deck's own animations.
 *
 * So the save path records what it authored, keyed by `spid:presetClass`, in a
 * `p:ext` under `p:timing` (`CT_SlideTiming` ends with an optional `p:extLst`,
 * which is exactly the sanctioned place for producer data). The registry rides
 * back in on `PptxSlide.rawTiming` at the next load, so a later save can tell
 * "the user deleted the effect I added" from "this effect was always here".
 * PowerPoint ignores extensions whose URI it does not recognise.
 *
 * The namespace is declared on the payload element itself rather than on the
 * slide root: the root declaration is written only when the editor extension
 * has animations to store, and the registry must stay well-formed after the
 * user deletes the last one.
 *
 * @module services/animation-timing-ownership
 */
import type { XmlObject } from '../types';
import { ensureArray, isXmlObject } from './native-animation-helpers';

/** Extension URI carrying the authored-effect registry. */
export const EDITOR_TIMING_EXT_URI = '{4F2D8E71-9C3A-4B16-A5D8-7E0B2C6F91A3}';

/** Namespace the registry element is declared in. */
export const EDITOR_TIMING_NAMESPACE_URI = 'http://schemas.pptx.ai/pptx/editor-meta';

/** Local name of the registry element inside the extension. */
const REGISTRY_LOCAL_NAME = 'editorTiming';

/** Stable key for one authored effect: its shape target plus its preset class. */
export function effectOwnershipKey(spid: string, presetClass: string): string {
	return `${spid}:${presetClass}`;
}

function isRegistryKey(key: string): boolean {
	if (key.startsWith('@_')) {
		return false;
	}
	const colon = key.lastIndexOf(':');
	return (colon === -1 ? key : key.slice(colon + 1)) === REGISTRY_LOCAL_NAME;
}

function extensionEntries(rawTiming: XmlObject): XmlObject[] {
	const extLst = rawTiming['p:extLst'];
	return isXmlObject(extLst) ? ensureArray(extLst['p:ext']) : [];
}

/** Read the set of `spid:presetClass` keys a previous save recorded. */
export function readOwnedEffectKeys(rawTiming: XmlObject): Set<string> {
	const owned = new Set<string>();
	for (const ext of extensionEntries(rawTiming)) {
		if (String(ext['@_uri'] ?? '').trim() !== EDITOR_TIMING_EXT_URI) {
			continue;
		}
		for (const key of Object.keys(ext)) {
			if (!isRegistryKey(key)) {
				continue;
			}
			const registry = ext[key];
			if (!isXmlObject(registry)) {
				continue;
			}
			for (const entry of String(registry['@_owned'] ?? '').split(/\s+/)) {
				if (entry.length > 0) {
					owned.add(entry);
				}
			}
		}
	}
	return owned;
}

/**
 * Replace the registry with `keys`, removing the extension entirely when the
 * editor no longer owns anything (so a deck edited back to its original state
 * carries no trace of this app).
 */
export function writeOwnedEffectKeys(rawTiming: XmlObject, keys: ReadonlySet<string>): void {
	const retained = extensionEntries(rawTiming).filter(
		(ext) => String(ext['@_uri'] ?? '').trim() !== EDITOR_TIMING_EXT_URI,
	);

	if (keys.size > 0) {
		retained.push({
			'@_uri': EDITOR_TIMING_EXT_URI,
			[`pptx:${REGISTRY_LOCAL_NAME}`]: {
				'@_xmlns:pptx': EDITOR_TIMING_NAMESPACE_URI,
				'@_owned': [...keys].sort().join(' '),
			},
		} as unknown as XmlObject);
	}

	if (retained.length === 0) {
		delete rawTiming['p:extLst'];
		return;
	}
	// `CT_SlideTiming` sequences `tnLst, bldLst, extLst`; deleting first keeps
	// the rebuilt extension list at the end of the element in key order.
	delete rawTiming['p:extLst'];
	rawTiming['p:extLst'] = { 'p:ext': retained.length === 1 ? retained[0]! : retained };
}
