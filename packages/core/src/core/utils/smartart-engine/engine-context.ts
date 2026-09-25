/**
 * What the layout needs to know about a diagram's TEXT while it lays the
 * presentation tree out: the paragraphs each node shows and the font metrics
 * to measure them with. Only text-driven sizing (`font-search.ts`,
 * `text-grow.ts`) reads it; a tree laid out without a context behaves
 * exactly as a purely geometric layout.
 */

import type { EngineNode } from './engine-node';
import type { NodeText, TextMetrics } from './text-measure';

export interface EngineLayoutContext {
	/** The paragraphs `node` shows, if any. */
	textOf(node: EngineNode): NodeText | undefined;
	metrics: TextMetrics;
	/** Nesting depth of running font searches (only the outermost one searches). */
	searchDepth: number;
}

const contexts = new WeakMap<EngineNode, EngineLayoutContext>();

/** Attach `context` to the tree rooted at `root`. */
export function setLayoutContext(root: EngineNode, context: EngineLayoutContext): void {
	contexts.set(root, context);
}

/** The context of the tree `node` belongs to. */
export function layoutContextOf(node: EngineNode): EngineLayoutContext | undefined {
	let top = node;
	while (top.parent) {
		top = top.parent;
	}
	return contexts.get(top);
}
