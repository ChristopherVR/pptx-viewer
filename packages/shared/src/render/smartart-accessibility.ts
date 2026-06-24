/**
 * smartart-accessibility.ts: framework-agnostic accessibility metadata for the
 * SmartArt renderer, shared across the React, Vue, and Angular bindings.
 *
 * The generated SmartArt SVG is otherwise opaque to assistive technology. These
 * pure helpers derive a screen-reader description of the whole diagram, a label
 * for each node, and a small `SmartArtA11y` view-model that a binding maps onto
 * `role="img"` + `aria-label` on the container and a `<title>` / `aria-label`
 * per node. No DOM, no framework imports.
 */

import type { PptxSmartArtData, PptxSmartArtNode, SmartArtLayoutType } from 'pptx-viewer-core';

/** Maximum number of node texts listed inline in a diagram description. */
const MAX_LISTED_NODES = 8;

/** Friendly, screen-reader-facing labels for each resolved layout family. */
const LAYOUT_LABELS: Record<SmartArtLayoutType, string> = {
	list: 'List',
	process: 'Process',
	cycle: 'Cycle',
	hierarchy: 'Hierarchy',
	relationship: 'Relationship',
	matrix: 'Matrix',
	pyramid: 'Pyramid',
	funnel: 'Funnel',
	gear: 'Gear',
	target: 'Target',
	timeline: 'Timeline',
	venn: 'Venn',
	chevron: 'Chevron',
	bending: 'Bending',
	unknown: 'Diagram',
};

/** Resolve a SmartArt diagram's layout family to a friendly label. */
export function smartArtLayoutLabel(type: SmartArtLayoutType | undefined): string {
	return LAYOUT_LABELS[type ?? 'unknown'] ?? LAYOUT_LABELS.unknown;
}

/** Recursively flatten a (possibly nested) SmartArt node forest, depth-first. */
function flattenSmartArtNodes(nodes: PptxSmartArtNode[]): PptxSmartArtNode[] {
	const out: PptxSmartArtNode[] = [];
	const walk = (n: PptxSmartArtNode): void => {
		out.push(n);
		for (const child of n.children ?? []) {
			walk(child);
		}
	};
	for (const n of nodes) {
		walk(n);
	}
	return out;
}

/** Trimmed node texts that carry content (empty / whitespace nodes dropped). */
function nodeTexts(nodes: PptxSmartArtNode[]): string[] {
	return flattenSmartArtNodes(nodes)
		.map((n) => (n.text ?? '').trim())
		.filter((t) => t.length > 0);
}

/**
 * Build a concise screen-reader description of an entire SmartArt diagram, e.g.
 * `"Hierarchy SmartArt diagram with 5 nodes: CEO; VP Marketing; ..."`.
 *
 * Node texts are listed up to {@link MAX_LISTED_NODES}; the remainder is
 * summarised as `"and N more"`. An empty diagram yields a node-free sentence.
 */
export function describeSmartArtDiagram(data: PptxSmartArtData): string {
	const label = smartArtLayoutLabel(data.resolvedLayoutType);
	const texts = nodeTexts(data.nodes ?? []);
	const count = texts.length;
	const head = `${label} SmartArt diagram`;

	if (count === 0) {
		return `${head} with no nodes`;
	}

	const noun = count === 1 ? 'node' : 'nodes';
	const listed = texts.slice(0, MAX_LISTED_NODES);
	const remainder = count - listed.length;
	const tail = remainder > 0 ? `${listed.join('; ')}; and ${remainder} more` : listed.join('; ');
	return `${head} with ${count} ${noun}: ${tail}`;
}

/**
 * Build the ARIA label for a single SmartArt node, e.g.
 * `"Node 2 of 5: VP Marketing"`. `index` is zero-based; `total` is the node
 * count. An empty node text yields `"Node 2 of 5"` (no trailing colon).
 */
export function smartArtNodeAriaLabel(text: string, index: number, total: number): string {
	const position = `Node ${index + 1} of ${total}`;
	const trimmed = (text ?? '').trim();
	return trimmed.length > 0 ? `${position}: ${trimmed}` : position;
}

/** Accessibility view-model for one SmartArt node. */
export interface SmartArtNodeA11y {
	/** Stable node id (for keying). */
	id: string;
	/** `aria-label` / `<title>` text for the node. */
	label: string;
}

/**
 * Accessibility view-model for a whole SmartArt diagram. A binding maps this
 * onto `role="img"` + `aria-label` on the container and a per-node label.
 */
export interface SmartArtA11y {
	/** ARIA role for the container element. Always `"img"`. */
	role: 'img';
	/** Container `aria-label` (the full diagram description). */
	label: string;
	/** Per-node labels in flattened, depth-first order. */
	nodes: SmartArtNodeA11y[];
}

/**
 * Build the complete {@link SmartArtA11y} view-model for a diagram: the
 * container description plus a per-node label for every content node.
 */
export function buildSmartArtA11y(data: PptxSmartArtData): SmartArtA11y {
	const flat = flattenSmartArtNodes(data.nodes ?? []);
	const total = flat.length;
	const nodes: SmartArtNodeA11y[] = flat.map((node, index) => ({
		id: node.id,
		label: smartArtNodeAriaLabel(node.text, index, total),
	}));
	return {
		role: 'img',
		label: describeSmartArtDiagram(data),
		nodes,
	};
}
