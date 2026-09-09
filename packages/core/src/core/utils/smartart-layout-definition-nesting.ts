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
 * and the condition of the nearest enclosing `dgm:if` (`undefined` for a
 * direct child, a `dgm:forEach`-only path, or a `dgm:else` branch - see
 * `PptxSmartArtLayoutNode.chooseGuard`'s doc comment). */
export interface FoundLayoutNode {
	xml: XmlObject;
	origin: PptxSmartArtIteratorAttributes | undefined;
	guard: PptxSmartArtWhen | undefined;
}

/** Find the next generation of layout nodes through forEach/choose wrappers,
 * tagging each with the enclosing forEach it was iterated by and the
 * enclosing `dgm:if` condition it was gated by, if any. */
export function nestedLayoutNodes(node: XmlObject, localName: LocalName): FoundLayoutNode[] {
	const found: FoundLayoutNode[] = [];
	const visit = (
		value: unknown,
		origin: PptxSmartArtIteratorAttributes | undefined,
		guard: PptxSmartArtWhen | undefined,
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
				// The NEAREST enclosing if's own condition becomes the guard for
				// everything inside it - see `PptxSmartArtLayoutNode.chooseGuard`'s
				// doc comment. A nested choose inside an already-active branch
				// (rare in this corpus) overwrites with the INNER if's condition,
				// matching `forEachOrigin`'s "nearest one" precedent.
				for (const ifNode of Array.isArray(entry) ? entry : [entry]) {
					if (ifNode && typeof ifNode === 'object') {
						visit(ifNode, origin, parseWhen(ifNode as XmlObject));
					}
				}
			} else if (name === 'else') {
				// ECMA-376's else has no condition of its own (see the type's doc
				// comment on why this is left unconditional rather than the
				// negated-OR of every sibling if).
				for (const elseNode of Array.isArray(entry) ? entry : [entry]) {
					if (elseNode && typeof elseNode === 'object') {
						visit(elseNode, origin, undefined);
					}
				}
			} else {
				visit(entry, origin, guard);
			}
		}
	};
	for (const [key, value] of Object.entries(node)) {
		if (!key.startsWith('@_') && localName(key) !== 'extLst') {
			visit({ [key]: value }, undefined, undefined);
		}
	}
	return found;
}
