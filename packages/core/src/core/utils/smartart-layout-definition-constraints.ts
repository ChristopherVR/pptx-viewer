/**
 * `dgm:constrLst`/`dgm:presOf` reachable through `dgm:choose`/`dgm:if`/
 * `dgm:else` wrapping a SAME layoutNode (a genuinely conditional constrLst,
 * e.g. `gear`'s composite positions its slots this way exclusively; a
 * choose-guarded presOf, e.g. `SnapshotPictureList`'s `ChildText`, whose
 * `<dgm:presOf axis="des">` only exists in the `func="cnt" op="gte" val="1"`
 * branch, an ELSE branch declaring a bare `<dgm:presOf/>` for the "no
 * children" case). Split out of `smartart-layout-definition.ts` to keep that
 * file under the repo's per-file line budget; see
 * `PptxSmartArtLayoutNode.allConstraints`/`.presentationOf`, the two
 * consumers this feeds.
 */

import type { XmlObject } from '../types';

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

/**
 * Every `dgm:presOf` reachable from `node` at its own level: a DIRECT child,
 * or one reached through `dgm:choose`/`dgm:if`/`dgm:else` wrapping THIS SAME
 * layoutNode (stopping at a nested `dgm:layoutNode`, exactly like
 * {@link nestedConstraints}), in document order.
 */
function nestedPresOf(node: XmlObject, localName: LocalName): XmlObject[] {
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
			if (name === 'presOf') {
				for (const candidate of Array.isArray(entry) ? entry : [entry]) {
					found.push(candidate && typeof candidate === 'object' ? (candidate as XmlObject) : {});
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

/**
 * The `dgm:presOf` `parseSmartArtLayoutDefinition` should read for `node`:
 * its DIRECT `<dgm:presOf>` when it declares a real `@_axis`, or - when
 * absent or bare - the first one reachable through a wrapping
 * `dgm:choose`/`dgm:if`/`dgm:else` that DOES declare an axis (a choose
 * picking between a real axis and a bare "no content" alternative is
 * normally gated on exactly the condition that makes the real axis resolve
 * empty anyway - e.g. "has children" - so always preferring the populated
 * branch and letting axis resolution itself return nothing for a point that
 * fails the condition is behaviourally equivalent to evaluating the choose,
 * without needing to evaluate it). Falls back to the first bare one found
 * (preserving the pre-existing "no text of its own" behaviour) when no
 * branch declares an axis at all.
 */
export function choosePresentationOf(node: XmlObject, localName: LocalName): XmlObject | undefined {
	const candidates = nestedPresOf(node, localName);
	return candidates.find(hasAxis) ?? candidates[0];
}
