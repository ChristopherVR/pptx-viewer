/**
 * `dgm:constrLst`/`dgm:presOf` reachable through `dgm:choose`/`dgm:if`/
 * `dgm:else` wrapping a SAME layoutNode (a genuinely conditional constrLst,
 * e.g. `gear`'s composite positions its slots this way exclusively; a
 * choose-guarded presOf, e.g. `SnapshotPictureList`'s `ChildText`, whose
 * `<dgm:presOf axis="des">` only exists in the `func="cnt" op="gte" val="1"`
 * branch, an ELSE branch declaring a bare `<dgm:presOf/>` for the "no
 * children" case). Split out of `smartart-layout-definition.ts` to keep that
 * file under the repo's per-file line budget; see
 * `PptxSmartArtLayoutNode.allConstraints`/`.presentationOf`/
 * `.presentationOfCandidates`, the three consumers this feeds.
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

/**
 * Every `dgm:constr` reachable from `node` through `dgm:choose`/`dgm:if`/
 * `dgm:else` wrapping THIS SAME layoutNode. Stops at a nested
 * `dgm:layoutNode`: a child's own constrLst is parsed separately when the
 * caller recurses into it.
 */
export function nestedConstraints(node: XmlObject, localName: LocalName): XmlObject[] {
	const found: XmlObject[] = [];
	const visit = (value: unknown): void => {
		if (!value || typeof value !== 'object') {
			return;
		}
		if (Array.isArray(value)) {
			value.forEach(visit);
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
						found.push(...children(list as XmlObject, 'constr', localName));
					}
				}
				continue;
			}
			visit(entry);
		}
	};
	for (const [key, value] of Object.entries(node)) {
		if (!key.startsWith('@_') && localName(key) !== 'extLst') {
			visit({ [key]: value });
		}
	}
	return found;
}

/** `true` when a raw `dgm:presOf` element declares a non-empty `@_axis`. */
function hasAxis(presOf: XmlObject): boolean {
	return typeof presOf['@_axis'] === 'string' && presOf['@_axis'].trim().length > 0;
}

/** One `dgm:presOf` reachable from a node's own level, plus the FULL chain of
 * every enclosing `dgm:if`'s own condition it was reached through (outermost
 * first, empty for a direct/unwrapped presOf or one reached only via a
 * `dgm:else`) - the same "chain, not nearest-one" shape
 * `PptxSmartArtLayoutNode.chooseGuard` uses for a layoutNode's own gating,
 * applied here to a presOf reached through a choose wrapping the SAME node's
 * content instead of the node's existence. */
export interface PresOfCandidate {
	presOf: XmlObject;
	guard: PptxSmartArtWhen[];
}

/**
 * Every `dgm:presOf` reachable from `node` at its own level: a DIRECT child,
 * or one reached through `dgm:choose`/`dgm:if`/`dgm:else` wrapping THIS SAME
 * layoutNode (stopping at a nested `dgm:layoutNode`, exactly like
 * {@link nestedConstraints}), in document order, each tagged with the guard
 * chain that selects it.
 */
function nestedPresOfCandidates(node: XmlObject, localName: LocalName): PresOfCandidate[] {
	const found: PresOfCandidate[] = [];
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
			if (name === 'presOf') {
				for (const candidate of Array.isArray(entry) ? entry : [entry]) {
					found.push({
						presOf: candidate && typeof candidate === 'object' ? (candidate as XmlObject) : {},
						guard,
					});
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
 * The STATIC `dgm:presOf` `parseSmartArtLayoutDefinition` reads for `node`
 * into `PptxSmartArtLayoutNode.presentationOf`: its DIRECT `<dgm:presOf>`
 * when it declares a real `@_axis`, or - when absent or bare - the first one
 * reachable through a wrapping `dgm:choose`/`dgm:if`/`dgm:else` that DOES
 * declare an axis. This is a GUESS, not a real evaluation: it is exactly
 * right when a choose picks between one real axis and a bare "no content"
 * alternative gated on the same condition that makes the real axis resolve
 * empty anyway (`SnapshotPictureList`'s `ChildText`, "has children"), but
 * WRONG when two OR MORE branches each declare a real, DIFFERENT axis for
 * different diagram shapes (`funnel--flat3.pptx`'s `item1`/`item2`/`item3`,
 * one literal axis per data-point count) - `choosePresentationOf` cannot
 * tell those apart since it never evaluates a condition. See
 * {@link presentationOfCandidates} for the full, guard-tagged candidate list
 * a caller with the actual diagram can resolve choose-aware instead (
 * `smartart-layout-interpreter-when.ts`'s `resolvePresentationOf`); this
 * function stays the fallback for every caller that only has
 * `presentationOf` to consult. Falls back to the first bare one found
 * (preserving the pre-existing "no text of its own" behaviour) when no
 * branch declares an axis at all.
 */
export function choosePresentationOf(node: XmlObject, localName: LocalName): XmlObject | undefined {
	const candidates = nestedPresOfCandidates(node, localName).map((entry) => entry.presOf);
	return candidates.find(hasAxis) ?? candidates[0];
}

/**
 * Every `dgm:presOf` candidate reachable from `node`, each tagged with the
 * FULL chain of enclosing `dgm:if` conditions that selects it (see
 * {@link PresOfCandidate}) - the real, choose-aware alternative to
 * {@link choosePresentationOf}'s single static guess. `undefined` when
 * `node` has zero or exactly one reachable presOf (the overwhelmingly common
 * case: nothing to choose between), so a caller can treat "no candidates"
 * as "use `presentationOf` directly" without a separate branch.
 */
export function presentationOfCandidates(
	node: XmlObject,
	localName: LocalName,
): PresOfCandidate[] | undefined {
	const candidates = nestedPresOfCandidates(node, localName);
	return candidates.length > 1 ? candidates : undefined;
}

/** One `dgm:rule` reachable from a node's own level, plus the guard chain that selects it - see {@link nestedRuleCandidates}. */
export interface RuleCandidate {
	rule: XmlObject;
	guard: PptxSmartArtWhen[];
}

/**
 * Every `dgm:rule` reachable from `node` through `dgm:choose`/`dgm:if`/
 * `dgm:else` wrapping THIS SAME layoutNode's `ruleLst` (a genuinely
 * count-gated rule set, e.g. `diverging-radial`'s own `w for="ch"
 * forName="node"` ceiling: 6 separate `dgm:if cnt<=N` branches, each with
 * its own `fact`), each tagged with the FULL chain of enclosing `dgm:if`
 * conditions that selects it, in document order - the SAME shape and
 * traversal as {@link nestedPresOfCandidates}, applied to `dgm:rule`
 * instead of `dgm:presOf`. Stops at a nested `dgm:layoutNode`, same
 * convention as {@link nestedConstraints}.
 */
function nestedRuleCandidates(node: XmlObject, localName: LocalName): RuleCandidate[] {
	const found: RuleCandidate[] = [];
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
			if (name === 'ruleLst') {
				for (const list of Array.isArray(entry) ? entry : [entry]) {
					if (list && typeof list === 'object') {
						for (const rule of children(list as XmlObject, 'rule', localName)) {
							found.push({ rule, guard });
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
 * Every `dgm:rule` candidate reachable from `node`, each tagged with the
 * FULL chain of enclosing `dgm:if` conditions that selects it - the
 * choose-aware alternative to `rules` (this node's own DIRECT `ruleLst`
 * only). `undefined` when `node` has zero or exactly one reachable rule
 * (the overwhelmingly common case), so a caller can treat "no candidates"
 * as "use `rules` directly" without a separate branch.
 */
export function ruleCandidates(node: XmlObject, localName: LocalName): RuleCandidate[] | undefined {
	const candidates = nestedRuleCandidates(node, localName);
	return candidates.length > 1 ? candidates : undefined;
}
