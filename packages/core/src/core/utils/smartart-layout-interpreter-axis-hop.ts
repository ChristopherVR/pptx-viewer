/**
 * SmartArt DiagramML interpreter - ECMA-376 21.4.7.5 single-hop `@axis`
 * navigation.
 *
 * Split out of `smartart-layout-interpreter-axis-count.ts` (the repo's
 * per-file line budget): {@link navigateAxisHop} is the tree-walk primitive
 * one `@axis` hop uses; `resolveAxisNodes` there chains it hop by hop, from
 * either the diagram's own top-level points (the pre-existing, root-relative
 * default) or an explicit ANCHOR point set (a node's own `forEachOrigin`,
 * for content genuinely scoped to one specific point rather than the whole
 * diagram - see that function's own doc comment). Pure tree navigation; no
 * framework code.
 */

import type { PptxSmartArtNode } from '../types';

/** Every descendant of `node` (children, grandchildren, ...), document order. */
function descendantsOf(
	node: PptxSmartArtNode,
	childrenOf: Map<string, PptxSmartArtNode[]>,
): PptxSmartArtNode[] {
	const out: PptxSmartArtNode[] = [];
	const stack = [...(childrenOf.get(node.id) ?? [])];
	while (stack.length > 0) {
		const next = stack.shift();
		if (!next) {
			continue;
		}
		out.push(next);
		stack.push(...(childrenOf.get(next.id) ?? []));
	}
	return out;
}

/** Every ancestor of `node` (parent, grandparent, ...), nearest first. */
function ancestorsOf(
	node: PptxSmartArtNode,
	parentOf: Map<string, PptxSmartArtNode>,
): PptxSmartArtNode[] {
	const out: PptxSmartArtNode[] = [];
	let current = parentOf.get(node.id);
	while (current) {
		out.push(current);
		current = parentOf.get(current.id);
	}
	return out;
}

/** `node`'s siblings (same parent, or the top-level `roots` when it has none), in document order, INCLUDING `node` itself. */
function siblingGroupOf(
	node: PptxSmartArtNode,
	parentOf: Map<string, PptxSmartArtNode>,
	childrenOf: Map<string, PptxSmartArtNode[]>,
	roots: PptxSmartArtNode[],
): PptxSmartArtNode[] {
	const parent = parentOf.get(node.id);
	return parent ? (childrenOf.get(parent.id) ?? []) : roots;
}

/**
 * One `@axis` hop (ECMA-376 21.4.7.5's `ST_AxisType`) from every point in
 * `current`, unioned in DOCUMENT order with duplicates dropped (several
 * `current` points can share an ancestor/descendant/sibling). Implements
 * every single-hop axis token the spec defines: `self`/`ch`/`des`/
 * `desOrSelf`/`par`/`ancst`/`ancstOrSelf`/`followSib`/`precedSib`/`follow`/
 * `preced`/`root`/`none`. The `...OrSelf` pair is the standard XPath UNION
 * reading ECMA-376's axis vocabulary is modelled on - `desOrSelf` is the
 * point ITSELF plus every descendant (self always first, so a caller that
 * treats the first entry as "primary" and the rest as folded-in extras gets
 * the right shape), `ancstOrSelf` is the point plus every ancestor - NOT
 * "descendants, falling back to self when there are none" (a reading this
 * function used, briefly, and reverted: it dropped the anchor's OWN text
 * whenever it had a descendant). COM-verified via `basic-venn--hier5.pptx`'s
 * `circ1Tx` (`presOf axis="desOrSelf"`, anchored one hop up by its own
 * `forEachOrigin`): a point WITH a child folds BOTH its own text and the
 * child's into one shape (`"Node One\nNode Two has a longer label"`), a
 * childless point renders just its own text (`desOrSelf` degenerates to
 * `self` exactly when there is nothing to union in) - never the child's text
 * ALONE.
 * `follow`/`preced` use `nodes`' own declaration order (`dgm:ptLst` order) as
 * document order, excluding a point's own descendants (for `follow`) or
 * ancestors (for `preced`) the way ECMA-376's XPath-derived axes do. `root`
 * resolves to the TOPMOST ancestor of each `current` point (walking
 * `parentOf` all the way up), or the point itself when it has none - the
 * diagram's own document root is not itself a member of `nodes` in this
 * codebase's data model, so there is no literal doc-typed point to return
 * for a bare top-level `root` hop; this is a reasonable, spec-consistent
 * approximation for the ONE shape actually reachable (`root` used deeper
 * than hop 0, from a real anchored point). `none` is always empty (ECMA's
 * own explicit "no navigation" token).
 */
export function navigateAxisHop(
	current: PptxSmartArtNode[],
	axis: string,
	nodes: PptxSmartArtNode[],
	childrenOf: Map<string, PptxSmartArtNode[]>,
	parentOf: Map<string, PptxSmartArtNode>,
	roots: PptxSmartArtNode[],
): PptxSmartArtNode[] {
	const out: PptxSmartArtNode[] = [];
	const seen = new Set<string>();
	const add = (node: PptxSmartArtNode): void => {
		if (!seen.has(node.id)) {
			seen.add(node.id);
			out.push(node);
		}
	};
	const addAll = (list: PptxSmartArtNode[]): void => {
		for (const node of list) {
			add(node);
		}
	};
	for (const node of current) {
		switch (axis) {
			case 'self':
				add(node);
				break;
			case 'ch':
				addAll(childrenOf.get(node.id) ?? []);
				break;
			case 'des':
				addAll(descendantsOf(node, childrenOf));
				break;
			case 'desOrSelf':
				add(node);
				addAll(descendantsOf(node, childrenOf));
				break;
			case 'par': {
				const parent = parentOf.get(node.id);
				if (parent) {
					add(parent);
				}
				break;
			}
			case 'ancst':
				addAll(ancestorsOf(node, parentOf));
				break;
			case 'ancstOrSelf':
				add(node);
				addAll(ancestorsOf(node, parentOf));
				break;
			case 'followSib':
			case 'precedSib': {
				const siblings = siblingGroupOf(node, parentOf, childrenOf, roots);
				const index = siblings.findIndex((sibling) => sibling.id === node.id);
				addAll(axis === 'followSib' ? siblings.slice(index + 1) : siblings.slice(0, index));
				break;
			}
			case 'follow':
			case 'preced': {
				const docIndex = nodes.indexOf(node);
				if (docIndex === -1) {
					break;
				}
				const excluded = new Set(
					(axis === 'follow' ? descendantsOf(node, childrenOf) : ancestorsOf(node, parentOf)).map(
						(n) => n.id,
					),
				);
				const range = axis === 'follow' ? nodes.slice(docIndex + 1) : nodes.slice(0, docIndex);
				addAll(range.filter((n) => !excluded.has(n.id)));
				break;
			}
			case 'root': {
				const ancestors = ancestorsOf(node, parentOf);
				add(ancestors.length > 0 ? ancestors[ancestors.length - 1] : node);
				break;
			}
			case 'none':
				break;
			default:
				break;
		}
	}
	return out;
}
