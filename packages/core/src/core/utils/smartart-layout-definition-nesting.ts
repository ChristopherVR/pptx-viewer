/**
 * SmartArt DiagramML layout-definition parser - nested `layoutNode` discovery.
 *
 * Split out of `smartart-layout-definition.ts` (the repo's per-file line
 * budget): walks through `dgm:forEach`/`dgm:choose` wrappers to find the next
 * generation of `dgm:layoutNode`s, tagging each with the enclosing forEach's
 * iterator attributes ({@link PptxSmartArtLayoutNode.forEachOrigin}) and the
 * enclosing `dgm:if`'s condition ({@link PptxSmartArtLayoutNode.chooseGuard}),
 * when reached that way.
 */

import type { PptxSmartArtIteratorAttributes, PptxSmartArtWhen, XmlObject } from '../types';
import { parseIterator, parseWhen } from './smartart-layout-control-flow';

type LocalName = (key: string) => string;

/** One `dgm:choose` instance's own group identity, this node's 0-based
 * ordinal within it (every `dgm:if` in document order, then `dgm:else`
 * last), that branch's own condition (`undefined` for `dgm:else`), and the
 * forEach iterator that was ACTIVE at the point this branch's `dgm:if`/
 * `dgm:else` was encountered (`undefined` when none was) - see
 * `PptxSmartArtLayoutNode.chooseGroups`'s doc comment, and `origin`'s own
 * doc comment below for why this must be captured at declaration time
 * rather than reused from whatever descendant ends up carrying it. */
interface ChooseGroupEntry {
	id: string;
	ordinal: number;
	guard?: PptxSmartArtWhen;
	origin?: PptxSmartArtIteratorAttributes;
}

/** A `layoutNode` found while walking through forEach/choose wrappers, plus the
 * iterator attributes of the nearest ENCLOSING `dgm:forEach` it was reached
 * through (`undefined` for a direct child, or one reached only via a
 * `dgm:choose` - see `PptxSmartArtLayoutNode.forEachOrigin`'s doc comment),
 * the CHAIN of every enclosing `dgm:if`'s own condition, outermost first
 * (empty for a direct child, a `dgm:forEach`-only path, or a `dgm:else`
 * branch contributing nothing of its own - see
 * `PptxSmartArtLayoutNode.chooseGuard`'s doc comment for why this is a
 * chain, not a single "nearest one" condition), the INDEX-PARALLEL chain of
 * the forEach iterator active WHEN EACH of those conditions was encountered
 * (`undefined` per entry when none was active then - see
 * `PptxSmartArtLayoutNode.chooseGuardOrigins`'s doc comment: this is
 * DELIBERATELY not always `origin` above, since a `dgm:if` declared BEFORE a
 * `dgm:forEach` that this walk later descends through still needs its OWN,
 * shallower anchor, not the deeper one `origin` ends up holding once the
 * walk reaches the actual `layoutNode`), and the chain of enclosing
 * `dgm:choose` group identities (see
 * `PptxSmartArtLayoutNode.chooseGroups`'s doc comment - NOT index-parallel
 * with `guard`, since a `dgm:else` contributes a group entry but not a
 * guard one). */
export interface FoundLayoutNode {
	xml: XmlObject;
	origin: PptxSmartArtIteratorAttributes | undefined;
	guard: PptxSmartArtWhen[];
	guardOrigins: (PptxSmartArtIteratorAttributes | undefined)[];
	groups: ChooseGroupEntry[];
}

/** Find the next generation of layout nodes through forEach/choose wrappers,
 * tagging each with the enclosing forEach it was iterated by, the FULL
 * chain of enclosing `dgm:if` conditions it was gated by, and the FULL
 * chain of enclosing `dgm:choose` group identities, if any. */
export function nestedLayoutNodes(node: XmlObject, localName: LocalName): FoundLayoutNode[] {
	const found: FoundLayoutNode[] = [];
	// Monotonic per-call counter: a fresh id per `dgm:choose` INSTANCE
	// encountered while walking THIS root node, never reused (see
	// `PptxSmartArtLayoutNode.chooseGroups`'s doc comment on why a synthetic
	// counter is used instead of the choose's own `@_name`).
	let chooseCounter = 0;
	const visit = (
		value: unknown,
		origin: PptxSmartArtIteratorAttributes | undefined,
		guard: PptxSmartArtWhen[],
		guardOrigins: (PptxSmartArtIteratorAttributes | undefined)[],
		groups: ChooseGroupEntry[],
	): void => {
		if (!value || typeof value !== 'object') {
			return;
		}
		if (Array.isArray(value)) {
			value.forEach((entry) => visit(entry, origin, guard, guardOrigins, groups));
			return;
		}
		for (const [key, entry] of Object.entries(value as XmlObject)) {
			if (key.startsWith('@_')) {
				continue;
			}
			const name = localName(key);
			if (name === 'layoutNode') {
				for (const layoutNode of Array.isArray(entry) ? entry : [entry]) {
					if (layoutNode && typeof layoutNode === 'object') {
						found.push({ xml: layoutNode as XmlObject, origin, guard, guardOrigins, groups });
					}
				}
			} else if (name === 'forEach') {
				for (const forEach of Array.isArray(entry) ? entry : [entry]) {
					if (forEach && typeof forEach === 'object') {
						// Only `origin` (the NEAREST enclosing forEach) changes here -
						// `guardOrigins` is NOT rewritten to this new, deeper forEach:
						// every guard already accumulated was declared BEFORE this
						// forEach was entered, so its own anchor stays whatever was
						// active at ITS OWN declaration point (see `guardOrigins`'s own
						// doc comment above).
						visit(forEach, parseIterator(forEach as XmlObject), guard, guardOrigins, groups);
					}
				}
			} else if (name === 'choose') {
				// A NEW group per `dgm:choose` instance: every direct `dgm:if`
				// (in document order) then `dgm:else` (last, if present) gets the
				// SAME group id and an increasing ordinal, appended to the CHAIN
				// (nested chooses inside one branch get their OWN, deeper group) -
				// this intercepts what the `if`/`else` cases below would otherwise
				// handle generically (via the `else` fallback's plain recursion),
				// so those cases stay as a defensive fallback for an `if`/`else`
				// somehow reached WITHOUT a recognised enclosing `dgm:choose`.
				for (const chooseNode of Array.isArray(entry) ? entry : [entry]) {
					if (!chooseNode || typeof chooseNode !== 'object') {
						continue;
					}
					const groupId = `choose${chooseCounter++}`;
					let ordinal = 0;
					for (const [chooseKey, chooseEntry] of Object.entries(chooseNode as XmlObject)) {
						if (chooseKey.startsWith('@_')) {
							continue;
						}
						const chooseChildName = localName(chooseKey);
						if (chooseChildName === 'if') {
							for (const ifNode of Array.isArray(chooseEntry) ? chooseEntry : [chooseEntry]) {
								if (ifNode && typeof ifNode === 'object') {
									const when = parseWhen(ifNode as XmlObject);
									// `origin` here is whatever forEach is ACTIVE at this
									// exact point in the walk - i.e. the anchor this `dgm:if`
									// was genuinely declared under, captured once, per-entry,
									// rather than left to be overwritten by a deeper forEach
									// this branch may still descend through below.
									visit(
										ifNode,
										origin,
										when ? [...guard, when] : guard,
										when ? [...guardOrigins, origin] : guardOrigins,
										[...groups, { id: groupId, ordinal: ordinal++, guard: when, origin }],
									);
								}
							}
						} else if (chooseChildName === 'else') {
							for (const elseNode of Array.isArray(chooseEntry) ? chooseEntry : [chooseEntry]) {
								if (elseNode && typeof elseNode === 'object') {
									visit(elseNode, origin, guard, guardOrigins, [
										...groups,
										{ id: groupId, ordinal: ordinal++, origin },
									]);
								}
							}
						} else {
							// CT_Choose only contains `if`/`else` per ECMA-376, but visit
							// anything else defensively (no group entry: it is not an
							// if/else branch of this choose) rather than silently drop it.
							visit(chooseEntry, origin, guard, guardOrigins, groups);
						}
					}
				}
			} else if (name === 'if') {
				// EVERY enclosing if's own condition is APPENDED to the chain for
				// everything inside it - see `PptxSmartArtLayoutNode.chooseGuard`'s
				// doc comment (`sub-step-process`'s `chLin1..7`, each needing BOTH
				// an outer `pos` guard AND an inner `cnt` one). A nested choose
				// inside an already-active branch keeps the OUTER condition(s) too,
				// unlike `forEachOrigin`'s deliberate "nearest one" precedent.
				// (Defensive fallback only - the `choose` case above handles every
				// `if` reached through a recognised enclosing `dgm:choose`.)
				for (const ifNode of Array.isArray(entry) ? entry : [entry]) {
					if (ifNode && typeof ifNode === 'object') {
						const when = parseWhen(ifNode as XmlObject);
						visit(
							ifNode,
							origin,
							when ? [...guard, when] : guard,
							when ? [...guardOrigins, origin] : guardOrigins,
							groups,
						);
					}
				}
			} else if (name === 'else') {
				// ECMA-376's else has no condition of its own (see the type's doc
				// comment on why this is left unconditional rather than the
				// negated-OR of every sibling if) - but any OUTER ancestor
				// guard(s) already accumulated before this choose still apply, so
				// the chain passes through UNCHANGED, not reset. (Defensive
				// fallback only - see the `choose` case above.)
				for (const elseNode of Array.isArray(entry) ? entry : [entry]) {
					if (elseNode && typeof elseNode === 'object') {
						visit(elseNode, origin, guard, guardOrigins, groups);
					}
				}
			} else {
				visit(entry, origin, guard, guardOrigins, groups);
			}
		}
	};
	for (const [key, value] of Object.entries(node)) {
		if (!key.startsWith('@_') && localName(key) !== 'extLst') {
			visit({ [key]: value }, undefined, [], [], []);
		}
	}
	return found;
}
