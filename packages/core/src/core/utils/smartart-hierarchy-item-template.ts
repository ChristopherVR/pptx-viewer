/**
 * SmartArt DiagramML interpreter - hierarchy item TEMPLATE selection when a
 * layoutDef declares more than one per-node `tx` (text) shape template.
 *
 * `findHierarchyItemShape`/`findHierarchyItemName` (`smartart-hierarchy-
 * shared.ts`) assume ONE item template for the whole tree: the first `tx`-alg
 * descendant with its own `dgm:shape`, found depth-first. That is correct for
 * every plain "Hierarchy"/"Organization Chart"-family layoutDef (exactly one
 * such descendant exists), but `horizontal-multi-level-hierarchy--hier5.pptx`
 * (`uniqueId=...HorizontalMultiLevelHierarchy`) declares TWO, cross-
 * referencing each other's own dimension:
 *
 *   - `LevelOneTextNode` (the diagram's own single root item, ROTATED 90/270
 *     degrees for a sideways "axis label" look - the rotation itself is not
 *     resolved here, see the module's own "not attempted" note in
 *     `smartart-track-r-successor.md`'s SESSION 29 section): `w for="des"
 *     forName="LevelOneTextNode" refType="h" refFor="des"
 *     refForName="LevelOneTextNode" fact="0.19"` - a plain SELF-referential
 *     aspect, found FIRST by `findHierarchyItemNode`'s depth-first walk (it
 *     sits directly under the root's own `hierRoot`, before the nested
 *     `hierChild` that leads to every deeper generation).
 *   - `LevelTwoTextNode` (every generation PAST the root - the SAME
 *     layoutNode is reused recursively for generation 3+ via `dgm:forEach
 *     ref="repeat"`, so it is the template for the VAST MAJORITY of rendered
 *     nodes in any real tree): `h for="des" forName="LevelTwoTextNode"
 *     refType="w" refFor="des" refForName="LevelOneTextNode"` (no `fact` -
 *     LevelTwo's own height literally EQUALS LevelOne's own width) + `w
 *     for="des" forName="LevelTwoTextNode" refType="h" refFor="des"
 *     refForName="LevelTwoTextNode" fact="3.28"` (its own, separately
 *     self-referential, aspect).
 *
 * `resolveHierarchyItemNode` generalises the selection: when TWO OR MORE
 * `tx`-alg+shape descendants exist and one's own `h`/`w` constraint (in the
 * arranger's top-level `hierChild` constrLst, `for="des"`) cross-references
 * ANOTHER one's name, the CROSS-REFERENCING node (the "deeper"/majority
 * template - `LevelTwoTextNode` here) is returned instead of the plain
 * first-found node, since `fitItemBox`'s single uniform box needs to match
 * the aspect the MAJORITY of generations actually use, not the one-off root.
 * Falls back to the existing first-found behaviour whenever this pattern is
 * absent (every other fixture in the 227-fixture gallery corpus - see the
 * module's own colocated test for the `name-and-title-organization-chart`/
 * `half-circle-organization-chart` negative case: their own composite
 * declares a second `tx`+shape descendant, `titleText1`, but ITS cross-
 * reference to `rootText1` is a `primFontSz` constraint, not `h`/`w`, and
 * lives in the COMPOSITE's own local `constrLst`, `for="ch"` - not the
 * `hierChild`-level, `for="des"` constraint this function reads - so the
 * gate never fires for them).
 *
 * Deliberately does NOT attempt the root's own distinct box size (its
 * `LevelOneTextNode` template still renders at the same uniform box every
 * other node gets) - see the SESSION 29 successor notes for the remaining
 * per-generation sizing and rotation-aware-bbox work.
 *
 * Pure geometry/constraint reading; no framework code.
 */

import type { PptxSmartArtLayoutNode } from '../types';

/** Depth-first collection of every `tx`-alg descendant with its own `dgm:shape`, in document order, deduplicated by name - mirrors `findHierarchyItemNode`'s own single-result walk in `smartart-hierarchy-shared.ts`. */
function collectTxShapeNodes(
	node: PptxSmartArtLayoutNode | undefined,
	out: PptxSmartArtLayoutNode[],
	seen: Set<string>,
): void {
	if (!node) {
		return;
	}
	if (node.algorithm?.type === 'tx' && node.shape) {
		const key = node.name ?? `#${out.length}`;
		if (!seen.has(key)) {
			seen.add(key);
			out.push(node);
		}
	}
	for (const child of node.children ?? []) {
		collectTxShapeNodes(child, out, seen);
	}
}

/**
 * True when `candidate`'s own `h`/`w` constraint (`for="des"`) in
 * `algorithmNode`'s top-level constrLst references ANOTHER candidate's name -
 * the structural signal this module's own doc comment describes.
 */
function crossReferencesAnotherCandidate(
	candidate: PptxSmartArtLayoutNode,
	otherNames: Set<string>,
	constraints: PptxSmartArtLayoutNode['constraints'],
): boolean {
	const candidateName = candidate.name;
	if (!candidateName) {
		return false;
	}
	return (constraints ?? []).some(
		(c) =>
			(c.type === 'h' || c.type === 'w') &&
			c.for === 'des' &&
			c.forName === candidateName &&
			c.referenceForName !== undefined &&
			c.referenceForName !== candidateName &&
			otherNames.has(c.referenceForName),
	);
}

/**
 * The item template's own layoutNode, preferring a cross-referencing
 * "majority" template over a plain first-found one - see the module doc
 * comment. `undefined` when `algorithmNode` declares no `tx`+shape descendant
 * at all (unchanged from the pre-existing behaviour).
 */
export function resolveHierarchyItemNode(
	algorithmNode: PptxSmartArtLayoutNode | undefined,
): PptxSmartArtLayoutNode | undefined {
	if (!algorithmNode) {
		return undefined;
	}
	const candidates: PptxSmartArtLayoutNode[] = [];
	collectTxShapeNodes(algorithmNode, candidates, new Set());
	if (candidates.length === 0) {
		return undefined;
	}
	const first = candidates[0];
	if (candidates.length < 2 || !first) {
		return first;
	}
	const allNames = new Set(
		candidates.map((c) => c.name).filter((n): n is string => n !== undefined),
	);
	const constraints = algorithmNode.allConstraints ?? algorithmNode.constraints ?? [];
	for (const candidate of candidates) {
		const otherNames = new Set(allNames);
		if (candidate.name) {
			otherNames.delete(candidate.name);
		}
		if (crossReferencesAnotherCandidate(candidate, otherNames, constraints)) {
			return candidate;
		}
	}
	return first;
}
