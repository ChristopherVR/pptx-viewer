/**
 * `dgm:constr` reachable through `dgm:choose`/`dgm:if`/`dgm:else` wrapping a
 * SAME layoutNode's `constrLst`, each tagged with the FULL chain of enclosing
 * `dgm:if` conditions that selects it - the SAME shape
 * `smartart-layout-definition-constraints.ts`'s `presentationOfCandidates`/
 * `ruleCandidates` use for `dgm:presOf`/`dgm:rule`, applied to `dgm:constr`
 * instead. Split into its own file (round 39) to keep
 * `smartart-layout-definition-constraints.ts` under the repo's per-file line
 * budget.
 *
 * `PptxSmartArtLayoutNode.allConstraints` (the pre-existing consumer of
 * `nestedConstraints`) already collects every reachable `dgm:constr`, but
 * BLINDLY UNIONS every branch with no guard information at all -
 * `smartart-constraint-solver.ts`'s `buildConstraintIndex` can only ever pick
 * the FIRST candidate in raw-XML document order for a (role, type) pair,
 * regardless of which branch is actually live for the current diagram
 * (`basic-venn--flat3.pptx`'s `circ1`/`circ1Tx` slots are declared once PER
 * data-point-count branch under `Name9`'s `dgm:choose` - the `cnt="3"`
 * branch's own `ctrX` fact differs from the `cnt="2"` branch's, and the old
 * blind union always resolved to whichever branch happened to sit first in
 * the XML). `smartart-constraint-branch-index.ts`'s `selectConstraints` is
 * the choose-aware alternative this field feeds.
 */

import type { PptxSmartArtWhen, XmlObject } from '../types';
import { parseWhen } from './smartart-layout-control-flow';

type LocalName = (key: string) => string;

function children(node: XmlObject, name: string, localName: LocalName): XmlObject[] {
	const key = Object.keys(node).find((candidate) => localName(candidate) === name);
	const value = key ? node[key] : undefined;
	if (Array.isArray(value)) {
		return value as XmlObject[];
	}
	return value && typeof value === 'object' ? [value as XmlObject] : [];
}

/** One `dgm:constr` reachable from a node's own level, plus the guard chain
 * that selects it - see {@link nestedConstraintCandidates}. */
export interface ConstraintCandidate {
	constr: XmlObject;
	guard: PptxSmartArtWhen[];
}

/**
 * Every `dgm:constr` reachable from `node` through `dgm:choose`/`dgm:if`/
 * `dgm:else` wrapping THIS SAME layoutNode's `constrLst`, each tagged with
 * the FULL chain of enclosing `dgm:if` conditions that selects it, in
 * document order (every `dgm:if` then `dgm:else` last) - the SAME traversal
 * `nestedConstraints` (`smartart-layout-definition-constraints.ts`) already
 * does, plus guard tracking (mirrors `nestedRuleCandidates`'s shape exactly).
 * Stops at a nested `dgm:layoutNode` boundary, same convention as
 * `nestedConstraints`.
 */
function nestedConstraintCandidates(node: XmlObject, localName: LocalName): ConstraintCandidate[] {
	const found: ConstraintCandidate[] = [];
	const visit = (value: unknown, guard: PptxSmartArtWhen[]): void => {
		if (!value || typeof value !== 'object') {
			return;
		}
		if (Array.isArray(value)) {
			value.forEach((entry) => visit(entry, guard));
			return;
		}
		for (const [key, entry] of Object.entries(value as XmlObject)) {
			if (key.startsWith('@_')) {
				continue;
			}
			const name = localName(key);
			if (name === 'layoutNode') {
				continue;
			}
			if (name === 'constrLst') {
				for (const list of Array.isArray(entry) ? entry : [entry]) {
					if (list && typeof list === 'object') {
						for (const constr of children(list as XmlObject, 'constr', localName)) {
							found.push({ constr, guard });
						}
					}
				}
				continue;
			}
			if (name === 'if') {
				for (const ifNode of Array.isArray(entry) ? entry : [entry]) {
					if (ifNode && typeof ifNode === 'object') {
						const when = parseWhen(ifNode as XmlObject);
						visit(ifNode, when ? [...guard, when] : guard);
					}
				}
				continue;
			}
			if (name === 'else') {
				// ECMA-376's else has no condition of its own (see `chooseGuard`'s own
				// doc comment for why); any OUTER ancestor guard already accumulated
				// still applies, so the chain passes through unchanged.
				for (const elseNode of Array.isArray(entry) ? entry : [entry]) {
					if (elseNode && typeof elseNode === 'object') {
						visit(elseNode, guard);
					}
				}
				continue;
			}
			visit(entry, guard);
		}
	};
	for (const [key, value] of Object.entries(node)) {
		if (!key.startsWith('@_') && localName(key) !== 'extLst') {
			visit({ [key]: value }, []);
		}
	}
	return found;
}

/**
 * Every `dgm:constr` candidate reachable from `node`, each tagged with the
 * FULL chain of enclosing `dgm:if` conditions that selects it - the
 * choose-aware alternative to `allConstraints` (every branch, blindly
 * unioned). `undefined` when `node` has zero or exactly one reachable
 * `dgm:constr` (the overwhelmingly common case: nothing to choose between),
 * so a caller can treat "no candidates" as "use `allConstraints`/`constraints`
 * directly" without a separate branch.
 */
export function constraintCandidates(
	node: XmlObject,
	localName: LocalName,
): ConstraintCandidate[] | undefined {
	const candidates = nestedConstraintCandidates(node, localName);
	return candidates.length > 1 ? candidates : undefined;
}
