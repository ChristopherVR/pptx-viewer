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

/** A `layoutNode` found while walking through forEach/choose wrappers, plus the
 * iterator attributes of the nearest ENCLOSING `dgm:forEach` it was reached
 * through (`undefined` for a direct child, or one reached only via a
 * `dgm:choose` - see `PptxSmartArtLayoutNode.forEachOrigin`'s doc comment)
 * and the CHAIN of every enclosing `dgm:if`'s own condition, outermost
 * first (empty for a direct child, a `dgm:forEach`-only path, or a
 * `dgm:else` branch contributing nothing of its own - see
 * `PptxSmartArtLayoutNode.chooseGuard`'s doc comment for why this is a
 * chain, not a single "nearest one" condition). */
export interface FoundLayoutNode {
	xml: XmlObject;
	origin: PptxSmartArtIteratorAttributes | undefined;
	guard: PptxSmartArtWhen[];
}

/** Find the next generation of layout nodes through forEach/choose wrappers,
 * tagging each with the enclosing forEach it was iterated by and the FULL
 * chain of enclosing `dgm:if` conditions it was gated by, if any. */
export function nestedLayoutNodes(node: XmlObject, localName: LocalName): FoundLayoutNode[] {
	const found: FoundLayoutNode[] = [];
	const visit = (
		value: unknown,
		origin: PptxSmartArtIteratorAttributes | undefined,
		guard: PptxSmartArtWhen[],
	): void => {
		if (!value || typeof value !== 'object') {
			return;
		}
		if (Array.isArray(value)) {
			value.forEach((entry) => visit(entry, origin, guard));
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
						found.push({ xml: layoutNode as XmlObject, origin, guard });
					}
				}
			} else if (name === 'forEach') {
				for (const forEach of Array.isArray(entry) ? entry : [entry]) {
					if (forEach && typeof forEach === 'object') {
						visit(forEach, parseIterator(forEach as XmlObject), guard);
					}
				}
			} else if (name === 'if') {
				// EVERY enclosing if's own condition is APPENDED to the chain for
				// everything inside it - see `PptxSmartArtLayoutNode.chooseGuard`'s
				// doc comment (`sub-step-process`'s `chLin1..7`, each needing BOTH
				// an outer `pos` guard AND an inner `cnt` one). A nested choose
				// inside an already-active branch keeps the OUTER condition(s) too,
				// unlike `forEachOrigin`'s deliberate "nearest one" precedent.
				for (const ifNode of Array.isArray(entry) ? entry : [entry]) {
					if (ifNode && typeof ifNode === 'object') {
						const when = parseWhen(ifNode as XmlObject);
						visit(ifNode, origin, when ? [...guard, when] : guard);
					}
				}
			} else if (name === 'else') {
				// ECMA-376's else has no condition of its own (see the type's doc
				// comment on why this is left unconditional rather than the
				// negated-OR of every sibling if) - but any OUTER ancestor
				// guard(s) already accumulated before this choose still apply, so
				// the chain passes through UNCHANGED, not reset.
				for (const elseNode of Array.isArray(entry) ? entry : [entry]) {
					if (elseNode && typeof elseNode === 'object') {
						visit(elseNode, origin, guard);
					}
				}
			} else {
				visit(entry, origin, guard);
			}
		}
	};
	for (const [key, value] of Object.entries(node)) {
		if (!key.startsWith('@_') && localName(key) !== 'extLst') {
			visit({ [key]: value }, undefined, []);
		}
	}
	return found;
}
