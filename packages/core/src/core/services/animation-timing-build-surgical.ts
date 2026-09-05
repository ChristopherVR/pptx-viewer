/**
 * Re-derive `p:bldLst/p:bldP` entries on the SURGICAL timing write path.
 *
 * `surgicallyUpdateTimingTree` (`animation-timing-surgical.ts`) clones an
 * existing `p:timing` tree and patches individual effect nodes in place, but
 * never looked at `p:bldLst` at all: it just rode along verbatim on the
 * clone. That is correct for a build the editor never touched (the clone
 * already carries it byte-identically), but wrong the moment the editor
 * model's own build fields (`PptxElementAnimation.sequence`,
 * `.buildTemplates`) disagree with what is in the XML, whether because the
 * user changed the build type/level in the animation panel or because
 * `buildTemplates` was edited programmatically: the stale `p:bldP` survived
 * every surgical save.
 *
 * This module closes that gap by re-deriving, for every animation whose
 * `sequence` field is set (the field this editor actually authors), the
 * `p:bldP` entry that field controls, reusing the exact same
 * {@link buildBldPNode} builder the full-rebuild path uses. An animation
 * whose `sequence` was never touched (`undefined`) is left alone entirely,
 * so a deck the editor never edited stays byte-identical, and unmodelled
 * `p:bldLst` siblings (`p:bldDgm`, `p:bldOleChart`, `p:bldGraphic`) are never
 * read or written here: they live under their own keys next to `p:bldP` and
 * this module only ever touches the `p:bldP` key.
 *
 * @module services/animation-timing-build-surgical
 */
import type { PptxElementAnimation, XmlObject } from '../types';
import { buildBldPNode } from './animation-write-sequence-builders';
import { ensureArray, isXmlObject } from './native-animation-helpers';

/** Structural equality good enough to decide "nothing actually changed". */
function sameNode(a: XmlObject, b: XmlObject): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Reconcile `p:bldLst/p:bldP` entries into `rawTiming` from `animations`,
 * mutating the tree in place.
 *
 * Only animations with `sequence !== undefined` are considered "owned" by
 * the editor for this purpose: for those, the desired `p:bldP` (or its
 * absence, when `sequence` is `"asOne"`) is compared against what the XML
 * currently has for that shape id, and the entry is rewritten only when the
 * two differ. Every other animation's existing `p:bldP`, and every other
 * `p:bldLst` child kind, is left exactly as it was.
 */
export function reconcileBuildList(
	rawTiming: XmlObject,
	animations: readonly PptxElementAnimation[],
): void {
	const controlled = animations.filter((anim) => anim.sequence !== undefined);
	if (controlled.length === 0) {
		return;
	}

	const bldLst = isXmlObject(rawTiming['p:bldLst'])
		? (rawTiming['p:bldLst'] as XmlObject)
		: undefined;
	const existingNodes = bldLst ? ensureArray(bldLst['p:bldP']) : [];

	const bySpid = new Map<string, XmlObject>();
	for (const node of existingNodes) {
		const spid = node['@_spid'];
		if (spid !== undefined && !bySpid.has(String(spid))) {
			bySpid.set(String(spid), node);
		}
	}

	let changed = false;
	for (const anim of controlled) {
		const desired = buildBldPNode(anim);
		const current = bySpid.get(anim.elementId);

		if (!desired) {
			// `sequence === 'asOne'`: this editor is explicitly saying the shape
			// has no paragraph build. Drop any `p:bldP` it previously owned.
			if (current) {
				bySpid.delete(anim.elementId);
				changed = true;
			}
			continue;
		}

		// Preserve whatever this editor does not model on an existing entry
		// (`@_grpId`, `@_bldLvl`, `@_rev`, `@_advAuto`, ...); only the fields
		// `buildBldPNode` actually derives (`@_build`, `p:tmplLst`) are
		// overwritten.
		const merged: XmlObject = current ? { ...current } : {};
		merged['@_spid'] = anim.elementId;
		if (merged['@_grpId'] === undefined) {
			merged['@_grpId'] = '0';
		}
		merged['@_build'] = desired['@_build'];
		if (desired['p:tmplLst'] !== undefined) {
			merged['p:tmplLst'] = desired['p:tmplLst'];
		} else {
			delete merged['p:tmplLst'];
		}

		if (!current || !sameNode(current, merged)) {
			bySpid.set(anim.elementId, merged);
			changed = true;
		}
	}

	if (!changed) {
		return;
	}

	const nodes = [...bySpid.values()];
	if (nodes.length === 0) {
		if (bldLst) {
			delete bldLst['p:bldP'];
			if (Object.keys(bldLst).length === 0) {
				delete rawTiming['p:bldLst'];
			}
		}
		return;
	}

	const nextBldLst = bldLst ?? {};
	nextBldLst['p:bldP'] = nodes.length === 1 ? nodes[0] : nodes;
	rawTiming['p:bldLst'] = nextBldLst;
}
