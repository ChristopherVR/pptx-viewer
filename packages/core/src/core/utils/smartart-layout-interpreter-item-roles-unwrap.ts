/**
 * SmartArt DiagramML interpreter - non-text wrapper drilling + parity-
 * alternating wrapper resolution.
 *
 * Split out of `smartart-layout-interpreter-item-roles.ts` (the repo's
 * per-file line budget): this half handles reaching THROUGH a non-text
 * wrapper layoutNode to its real text roles, and the "two or more wrappers
 * alternate by forEach parity, but declare content-compatible roles" case.
 * Pure TypeScript - no framework code, no DOM.
 */

import type { PptxSmartArtLayoutNode } from '../types';
import { isTransitionOnlyChild } from './smartart-layout-interpreter-composite-detect';
import { isTextRole, TRANSITION_ROLE_NAMES } from './smartart-layout-interpreter-item-role-shared';

/**
 * Every text-role DESCENDANT of `node` reachable by drilling through
 * non-text wrapper layoutNodes (composite item templates, nested composites
 * inside composites), depth-first document order. Stops descending as soon
 * as it reaches a node that is itself a text role (nothing further to
 * unwrap) or a reserved TRANSITION role name (`sibTrans`/`parTrans`, e.g.
 * Multidirectional Cycle's `sibTrans` wrapping a `connectorText` label) -
 * its "self" means the transition point's own text, not the arranged node's,
 * so its children must never surface as one of the arranged node's own
 * roles. `CaptionedPictures`' shape needs the recursion: `composite` wraps
 * `ChildComposite`, which is itself the ONLY node with the real `Child`
 * (`des`)/`Parent` (`self`) text roles - two wrapper levels deep.
 */
export function unwrapTextRoles(node: PptxSmartArtLayoutNode): PptxSmartArtLayoutNode[] {
	if (isTextRole(node) || TRANSITION_ROLE_NAMES.has(node.name ?? '')) {
		return [];
	}
	const out: PptxSmartArtLayoutNode[] = [];
	for (const child of node.children ?? []) {
		if (isTextRole(child)) {
			out.push(child);
		} else {
			out.push(...unwrapTextRoles(child));
		}
	}
	return out;
}

/**
 * True when `node` was reached through a forEach that covers only PART of
 * the point set - either a transition-only iterator ({@link
 * isTransitionOnlyChild}) or a genuine `axis="ch"` iterator with `step > 1`
 * (`Alternating Flow`'s `composite1`, `step="2"`, every OTHER point). A
 * wrapper reached this way is one of several PARITY-ALTERNATING templates,
 * never a role that applies to every arranged point on its own.
 */
export function isPartialForEachOrigin(node: PptxSmartArtLayoutNode): boolean {
	return isTransitionOnlyChild(node) || (node.forEachOrigin?.step?.[0] ?? 1) > 1;
}

/** A wrapper's own unwrapped roles, reduced to their axis kinds (order-independent). */
function roleAxisSignature(wrapper: PptxSmartArtLayoutNode): string {
	return unwrapTextRoles(wrapper)
		.map((role) => role.presentationOf?.axis?.[0] ?? '')
		.sort()
		.join(',');
}

/**
 * Resolve `resolveItemTextRoles`'s decision when 2+ contributing wrappers
 * exist and at least one is reached through a {@link isPartialForEachOrigin}
 * iterator - `Alternating Flow`'s `composite1`/`composite2` (parity-
 * alternating). `smartart-layout-interpreter-flow.ts`'s `selectArrangedNodes`
 * resolves the UNION of both iterators (every point, not just one parity
 * half), so every point renders through the SAME base geometry
 * (`itemNode(arranger)`, the FIRST wrapper's) regardless of which template
 * its own position would visually pick - only the TEXT CONTENT split still
 * needs a role list. When every wrapper resolves the SAME SET of role axis
 * kinds ({@link roleAxisSignature} - both `composite1`/`composite2` are a
 * `self`+`des` pair here, just styled/positioned differently for the
 * alternating visual), the wrappers are content-INTERCHANGEABLE: use the one
 * reached through the diagram's OWN primary iterator (not partial) for every
 * point, since `self`/`des` resolve identically against ANY point regardless
 * of which wrapper's name happened to declare them. Only when the axis SETS
 * genuinely differ (a real ambiguity, not just a styling alternative -
 * unmeasured against any gallery fixture so far, but plausible for a
 * hypothetical arranger whose two templates' roles do not correspond) does
 * this decline entirely (`undefined`), like `hasAmbiguousTopLevelRoles`.
 */
export function resolvePartialForEachRoles(
	contributingWrappers: PptxSmartArtLayoutNode[],
): PptxSmartArtLayoutNode[] | undefined {
	const signatures = new Set(contributingWrappers.map(roleAxisSignature));
	if (signatures.size > 1) {
		return undefined;
	}
	const primary =
		contributingWrappers.find((wrapper) => !isPartialForEachOrigin(wrapper)) ??
		contributingWrappers[0];
	const primaryRoles = unwrapTextRoles(primary);
	return primaryRoles.length > 1 ? primaryRoles : undefined;
}
