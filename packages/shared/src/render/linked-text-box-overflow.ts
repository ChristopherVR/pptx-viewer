/**
 * Linked text box overflow utilities.
 *
 * Wraps the core `getLinkedTextBoxSegments` function and provides helpers for
 * computing which text segments should render in each box of a linked text box
 * chain. Framework-agnostic.
 */

import type { PptxElement, TextSegment } from 'pptx-viewer-core';
import { hasTextProperties, getLinkedTextBoxSegments } from 'pptx-viewer-core';

/**
 * Depth cap for the group walk below.
 *
 * Mirrors the loader's own `MAX_GROUP_DEPTH`: a deck can nest `p:grpSp` far
 * deeper than any human authors, and a cyclic tree assembled in memory (an
 * editor bug, a malformed collaboration patch) would otherwise recurse forever
 * during a render pass.
 */
const MAX_GROUP_DEPTH = 64;

/**
 * Determine whether an element participates in a linked text box chain.
 */
export function isLinkedTextBox(element: PptxElement): boolean {
	return hasTextProperties(element) && element.linkedTxbxId !== undefined;
}

/**
 * Flatten a slide's element list so a chain's members can be found wherever
 * they sit in the shape tree.
 *
 * `a:linkedTxbx` carries an `id` that is scoped to the SLIDE PART, not to a
 * branch of the shape tree: nothing in ECMA-376 ties a chain to a single
 * `p:grpSp`, and grouping is a manipulation construct with no bearing on how
 * text flows. So chain resolution walks the whole tree, in document order, and
 * a chain works identically whether its boxes are top level, inside one group,
 * inside a nested group, or split across a group boundary. Before this walk the
 * chain builder only ever saw the top-level list, so a chain authored inside a
 * group resolved to nothing and its head painted the whole chain's text.
 *
 * Coordinate space deliberately needs no correction here. A group's children
 * are parsed with the group scale (`a:ext / a:chExt`) ALREADY baked into their
 * `width`/`height`; only `x`/`y` are rebased to be group-relative, and the
 * capacity estimate that drives the split reads size alone. Passing children
 * through untouched therefore splits a grouped chain at the same character
 * PowerPoint does, and rebasing them into slide space here would be wrong.
 *
 * Returns the input array unchanged when the slide holds no group, so the
 * common case allocates nothing.
 */
function flattenForChainResolution(elements: readonly PptxElement[]): readonly PptxElement[] {
	if (!elements.some((el) => el.type === 'group')) {
		return elements;
	}
	const flat: PptxElement[] = [];
	// Visiting each group at most once makes a cyclic tree terminate exactly,
	// and keeps a member from being collected twice: the distribution map is
	// keyed by element ID, so a duplicate would overwrite that box's slice with
	// a later one and hand it the wrong text.
	const seen = new Set<PptxElement>();
	const walk = (list: readonly PptxElement[], depth: number): void => {
		for (const el of list) {
			if (el.type !== 'group') {
				flat.push(el);
				continue;
			}
			if (seen.has(el)) {
				continue;
			}
			seen.add(el);
			flat.push(el);
			if (depth < MAX_GROUP_DEPTH) {
				walk(el.children ?? [], depth + 1);
			}
		}
	};
	walk(elements, 0);
	return flat;
}

/**
 * Determine whether an element is the head (seq 0) of a linked text box chain.
 */
export function isLinkedTextBoxHead(element: PptxElement): boolean {
	return (
		hasTextProperties(element) &&
		element.linkedTxbxId !== undefined &&
		(element.linkedTxbxSeq ?? 0) === 0
	);
}

/**
 * Compute the distributed text segments for a given element in a linked text
 * box chain.
 *
 * Returns the segments that this element should display after overflow
 * distribution, or `undefined` if the element is not part of a chain, is the
 * only member, or the caller has no sibling list to resolve the chain against.
 *
 * `slideElements` is nullable so every binding can call this unconditionally at
 * its text-render site: a surface that does not (yet) thread the sibling list
 * down, or renders an element outside any slide, degrades to the element's own
 * authored segments instead of forcing a guard into each view layer.
 *
 * `slideElements` is the slide's TOP-LEVEL list in every binding, including at
 * a group child's render site, so the chain lookup flattens it first. The
 * not-a-chain guard runs before the flatten because this is a per-element,
 * per-render call and all but a handful of elements exit here.
 */
export function getOverflowSegments(
	element: PptxElement,
	slideElements: readonly PptxElement[] | undefined,
): TextSegment[] | undefined {
	if (!slideElements || slideElements.length === 0) {
		return undefined;
	}
	if (!isLinkedTextBox(element)) {
		return undefined;
	}
	return getLinkedTextBoxSegments(element, flattenForChainResolution(slideElements));
}

/**
 * Build a complete segment distribution map for all linked text box chains on a
 * slide.
 *
 * Returns a map from element ID to the text segments that element should
 * render. Elements not in any chain are not included. Group children are
 * included: the map is keyed by element ID, which is unique slide-wide, so a
 * caller can look up a nested box without knowing where it sits.
 */
export function buildSlideOverflowMap(
	slideElements: readonly PptxElement[],
): Map<string, TextSegment[]> {
	const result = new Map<string, TextSegment[]>();
	const flat = flattenForChainResolution(slideElements);

	if (!flat.some((el) => isLinkedTextBox(el))) {
		return result;
	}

	for (const el of flat) {
		if (!isLinkedTextBox(el)) {
			continue;
		}
		const segments = getLinkedTextBoxSegments(el, flat);
		if (segments !== undefined) {
			result.set(el.id, segments);
		}
	}

	return result;
}
