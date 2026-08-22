/**
 * Derive a SmartArt quick-style's effect intensity from its `styleLbl`
 * structure, not its name.
 *
 * The previous implementation substring-matched `styleLbl/@name` for
 * "intense"/"3d"/"moderate"/"semi"/"subtle"/"flat". Real PowerPoint quick
 * styles never encode intensity in the name: every genuine
 * `ppt/diagrams/quickStyle*.xml` fixture in this repo names its node labels
 * structurally (`node0`, `node1`, ... `asst0`, ...), so that heuristic never
 * fires. PowerPoint instead varies each "node*" label's actual `dgm:sp3d`
 * bevel content and `a:lnRef`/`a:fillRef`/`a:effectRef` style-matrix indices
 * between its "Subtle Effect", "Moderate Effect", and "Intense Effect"
 * variants; this reads those directly.
 *
 * @module smartart-effect-intensity
 */

import type { XmlObject } from '../types';

type LocalName = (key: string) => string;

function child(
	node: XmlObject | undefined,
	name: string,
	localName: LocalName,
): XmlObject | undefined {
	if (!node) {
		return undefined;
	}
	const key = Object.keys(node).find((candidate) => localName(candidate) === name);
	const value = key ? node[key] : undefined;
	return Array.isArray(value)
		? (value[0] as XmlObject | undefined)
		: (value as XmlObject | undefined);
}

/** Read an `a:*Ref/@idx` style-matrix index from a styleLbl's `dgm:style`. */
function refIndex(
	styleLbl: XmlObject | undefined,
	refName: string,
	localName: LocalName,
): number | undefined {
	const style = child(styleLbl, 'style', localName);
	const ref = child(style, refName, localName);
	const parsed = Number.parseInt(String(ref?.['@_idx'] ?? ''), 10);
	return Number.isFinite(parsed) ? parsed : undefined;
}

/** True when `dgm:sp3d` carries real bevel/contour/material content, not just an empty marker tag. */
function hasBevelGeometry(styleLbl: XmlObject | undefined, localName: LocalName): boolean {
	const sp3d = child(styleLbl, 'sp3d', localName);
	if (!sp3d) {
		return false;
	}
	return Object.keys(sp3d).some((key) => !key.startsWith('@_'));
}

/**
 * Find the `styleLbl` a quick style's overall intensity is judged from: the
 * primary content-node shape. PowerPoint always names it `node<N>`; `node1`
 * is preferred when several are present (org-chart quick styles carry
 * `node0`..`node4` for different position roles, but they share one
 * intensity), falling back to the first `node<N>` label found.
 */
function primaryNodeStyleLbl(styleLbls: XmlObject[]): XmlObject | undefined {
	const named = (name: string): XmlObject | undefined =>
		styleLbls.find((lbl) => String(lbl['@_name'] ?? '') === name);
	return named('node1') ?? styleLbls.find((lbl) => /^node\d+$/u.test(String(lbl['@_name'] ?? '')));
}

/** Resolved effect-intensity levels, matching {@link SmartArtStyle}. */
export type SmartArtEffectIntensity = 'intense' | 'moderate' | 'subtle';

/**
 * Derive the quick style's effect intensity from its primary node
 * `styleLbl`'s actual `dgm:sp3d` / `a:lnRef` / `a:fillRef` / `a:effectRef`
 * content, or `undefined` when no recognisable node label is present.
 */
export function resolveSmartArtEffectIntensity(
	styleLbls: XmlObject[],
	localName: LocalName,
): SmartArtEffectIntensity | undefined {
	const primary = primaryNodeStyleLbl(styleLbls);
	if (!primary) {
		return undefined;
	}
	if (hasBevelGeometry(primary, localName)) {
		return 'intense';
	}
	const effectIdx = refIndex(primary, 'effectRef', localName) ?? 0;
	const fillIdx = refIndex(primary, 'fillRef', localName) ?? 0;
	if (effectIdx >= 2 || fillIdx >= 3) {
		return 'intense';
	}
	if (effectIdx >= 1 || fillIdx >= 2) {
		return 'moderate';
	}
	return 'subtle';
}
