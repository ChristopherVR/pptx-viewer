/**
 * SmartArt DiagramML interpreter - `tailed` (org-chart family) hierarchy
 * transposition detection.
 *
 * Split out of `smartart-hierarchy-orientation.ts` (the file-size budget):
 * this module answers ONE narrow question - does `algorithmNode`'s own
 * TOP-LEVEL `hierChild` algorithm (the arranger governing the tree ROOT's
 * direct-children fan, always live regardless of `hierBranch`/`dir` - see
 * `smartart-layout-interpreter-hierarchy.ts`'s own module doc comment)
 * declare a `chAlign` param.
 *
 * Why this can't just be `algorithmParam(algorithmNode, 'chAlign')`: a
 * genuine org-chart-family layoutDef wraps its ROOT `hierChild` algorithm in
 * a `dgm:choose` (mirroring `dir="norm"`/`"rtl"`), and `discoverArrangement`
 * (`smartart-layout-interpreter-model.ts`) deliberately keeps the ORIGINAL,
 * choose-wrapped node as `hierarchy` - never the param-carrying resolved
 * copy - because hierarchy code elsewhere compares nodes by REFERENCE
 * against the original tree (see that function's own comment). So
 * `algorithmNode.algorithm` is `undefined` for every real org-chart fixture,
 * and every `dgm:param` the ROOT's own choose declares needs its own reader,
 * same as `chooseAlgorithm` does for the winning branch's `linDir`/`grDir`/
 * etc - except this one does not need a winning branch: the `dir="norm"`/
 * `"rtl"` mirror pair always declares the SAME `chAlign` family (present in
 * both branches, or absent from both - COM-verified against `organization-
 * chart`/`half-circle-organization-chart`/`name-and-title-organization-
 * chart`/`horizontal-organization-chart`'s own `layout1.xml`: the first
 * three declare no `chAlign` at this level in EITHER branch, only a mirrored
 * `linDir` `fromL`/`fromR` pair; `horizontal-organization-chart` alone
 * declares `chAlign` `l`/`r` in both), so reading whichever branch is first
 * in document order (`when[0]`, or `otherwise` when there is no `if`) is
 * sufficient - unlike a `dgm:rule`/deeper-generation `chAlign` gated on
 * `hierBranch` (see `smartart-hierarchy-orientation.ts`'s own module doc
 * comment), this one is NOT decision-dependent.
 *
 * Pure XML/geometry reading; no framework code, no DOM.
 */

import type { PptxSmartArtLayoutNode, XmlObject } from '../types';
import { localName } from './smartart-layout-interpreter-choose-branch';

/** First `dgm:param[@type=paramType]/@val` found under a `dgm:alg`, searched blindly (see the module doc comment for why a blind, non-decidable search is safe here). */
function findAlgParamValue(raw: unknown, paramType: string): string | undefined {
	if (!raw || typeof raw !== 'object') {
		return undefined;
	}
	if (Array.isArray(raw)) {
		for (const entry of raw) {
			const found = findAlgParamValue(entry, paramType);
			if (found !== undefined) {
				return found;
			}
		}
		return undefined;
	}
	for (const [key, value] of Object.entries(raw as XmlObject)) {
		if (key.startsWith('@_')) {
			continue;
		}
		const name = localName(key);
		if (name === 'param') {
			const candidates = Array.isArray(value) ? value : [value];
			for (const candidate of candidates) {
				if (
					candidate &&
					typeof candidate === 'object' &&
					(candidate as XmlObject)['@_type'] === paramType
				) {
					const val = (candidate as XmlObject)['@_val'];
					return typeof val === 'string' ? val : undefined;
				}
			}
			continue;
		}
		const found = findAlgParamValue(value, paramType);
		if (found !== undefined) {
			return found;
		}
	}
	return undefined;
}

/**
 * `true` when `algorithmNode`'s own top-level `hierChild` algorithm (direct
 * or choose-wrapped) declares a `chAlign` param - the `tailed`-family
 * transposition signal ("Horizontal Organization Chart" and its siblings, if
 * any share this shape) distinct from the `std` "Hierarchy" family's `sibSp`
 * referencing `h` (see `smartart-hierarchy-orientation.ts`'s own module doc
 * comment). Only meaningful for `mode==='tailed'` callers; always `false`
 * for a `std`/`hanging` hierarchy, which never declares `chAlign` at this
 * level at all.
 */
export function tailedHierarchyDeclaresChAlign(
	algorithmNode: PptxSmartArtLayoutNode | undefined,
): boolean {
	if (!algorithmNode) {
		return false;
	}
	if (algorithmNode.algorithm?.type === 'hierChild') {
		const direct = algorithmNode.algorithm.parameters?.find((p) => p.type === 'chAlign');
		if (direct) {
			return true;
		}
	}
	for (const choose of algorithmNode.choose ?? []) {
		const branchRaw = choose.when[0]?.rawXml ?? choose.otherwise?.rawXml;
		if (findAlgParamValue(branchRaw, 'chAlign') !== undefined) {
			return true;
		}
	}
	return false;
}
