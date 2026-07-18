/**
 * omml-sibling-order: restore sibling order inside parsed `m:oMath` subtrees.
 *
 * fast-xml-parser's collapsed shape stores same-tag siblings as an array under
 * one key and distinct tags under separate keys, so an interleaved OMML
 * content sequence (`m:sSup`, `m:r`, `m:sSup`, ... for a^2+b^2) loses its
 * order: every walker that iterates `Object.keys` re-emits the children
 * grouped by tag, corrupting the equation both on screen and in the XML
 * written on save.
 *
 * `annotateOmmlSiblingOrder` runs right after parse (see
 * `PptxRuntimeDependencyFactory.createParser`) and rewrites, in place, every
 * oMath container whose raw child sequence is NOT grouped-by-tag: repeated
 * tags get position-marked keys (`m:r#pptx-order-3` via `orderedXmlKey`) so
 * object insertion order carries the true sequence. The markers live in the
 * key names, so - unlike the WeakMap side-channels used for custom geometry
 * and SmartArt text - the order survives the cloning that `equationXml`
 * undergoes in editor state, undo history, and collaboration codecs. The
 * save-side XMLBuilder strips `#pptx-order-N` from emitted tag names, so the
 * serialized OOXML regains the original interleaved form. Grouped-by-tag
 * containers (the overwhelmingly common case) are left untouched.
 */

import { orderedXmlKey } from '../../geometry';
import type { XmlObject } from '../../types';

function isXmlObject(value: unknown): value is XmlObject {
	return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function ensureItems(value: unknown): unknown[] {
	if (value === undefined || value === null) {
		return [];
	}
	return Array.isArray(value) ? value : [value];
}

function localName(name: string): string {
	const colon = name.indexOf(':');
	return colon >= 0 ? name.slice(colon + 1) : name;
}

/** Matches every `m:oMath` element (any prefix), capturing its inner XML. */
const OMATH_RE =
	/<([A-Za-z_][\w.-]*:)?oMath\b(?:"[^"]*"|'[^']*'|[^"'>])*?(?:\/>|>([\s\S]*?)<\/\1oMath\s*>)/gu;

/** Open/close/self-closing tag scanner (quote-aware for `>` in attributes). */
const TAG_RE = /<(\/)?([A-Za-z_][\w.:-]*)((?:"[^"]*"|'[^']*'|[^"'>])*?)(\/)?>/gu;

/** Inner XML of every oMath element in document order ('' for empty ones). */
function extractOmathInnerXml(xml: string): string[] {
	const fragments: string[] = [];
	for (const match of xml.matchAll(OMATH_RE)) {
		fragments.push(match[2] ?? '');
	}
	return fragments;
}

/** Parsed oMath container objects in document order. */
function collectParsedOmathNodes(root: unknown): XmlObject[] {
	const result: XmlObject[] = [];
	const stack: unknown[] = [root];
	while (stack.length > 0) {
		const current = stack.pop();
		if (!current || typeof current !== 'object') {
			continue;
		}
		if (Array.isArray(current)) {
			for (let index = current.length - 1; index >= 0; index--) {
				stack.push(current[index]);
			}
			continue;
		}
		for (const [key, value] of Object.entries(current as XmlObject).reverse()) {
			if (key.startsWith('@_')) {
				continue;
			}
			if (localName(key) === 'oMath') {
				for (const item of ensureItems(value)) {
					if (isXmlObject(item)) {
						result.push(item);
					}
				}
			} else {
				stack.push(value);
			}
		}
	}
	return result;
}

interface RawChild {
	/** Full prefixed tag name as written in the source. */
	tag: string;
	/** The child's inner XML ('' for self-closing/empty elements). */
	inner: string;
}

/** Scan a container's inner XML for its direct children (tag + inner XML). */
function scanDirectChildren(inner: string): RawChild[] {
	const children: RawChild[] = [];
	let depth = 0;
	let open: { tag: string; innerStart: number } | null = null;
	for (const match of inner.matchAll(TAG_RE)) {
		const closing = Boolean(match[1]);
		const selfClosing = Boolean(match[4]);
		if (closing) {
			depth = Math.max(0, depth - 1);
			if (depth === 0 && open) {
				children.push({ tag: open.tag, inner: inner.slice(open.innerStart, match.index) });
				open = null;
			}
			continue;
		}
		if (selfClosing) {
			if (depth === 0) {
				children.push({ tag: match[2]!, inner: '' });
			}
			continue;
		}
		if (depth === 0) {
			open = { tag: match[2]!, innerStart: match.index! + match[0].length };
		}
		depth++;
	}
	return children;
}

/** True while every tag's occurrences are contiguous (order-safe to collapse). */
function isGroupedByTag(tags: string[]): boolean {
	const seen = new Set<string>();
	let previous = '';
	for (const tag of tags) {
		if (tag !== previous && seen.has(tag)) {
			return false;
		}
		seen.add(tag);
		previous = tag;
	}
	return true;
}

/**
 * Recursively rewrite one parsed container so its keys follow the raw child
 * sequence, renaming repeated interleaved tags with `orderedXmlKey` markers.
 */
function reorderContainer(node: XmlObject, rawInner: string): void {
	const children = scanDirectChildren(rawInner);
	if (children.length === 0) {
		return;
	}

	// Pair each raw child occurrence with its parsed value, recursing first so
	// nested containers are rewritten even when this level stays grouped.
	const occurrence = new Map<string, number>();
	const resolved: Array<{ tag: string; value: unknown }> = [];
	for (const child of children) {
		const index = occurrence.get(child.tag) ?? 0;
		occurrence.set(child.tag, index + 1);
		const value = ensureItems(node[child.tag])[index];
		resolved.push({ tag: child.tag, value });
		if (isXmlObject(value) && child.inner) {
			reorderContainer(value, child.inner);
		}
	}

	if (isGroupedByTag(children.map((child) => child.tag))) {
		return;
	}
	// Safety: only rewrite when the raw scan matches the parsed shape exactly.
	for (const [tag, count] of occurrence) {
		if (ensureItems(node[tag]).length !== count) {
			return;
		}
	}

	const preserved = Object.entries(node).filter(([key]) => !occurrence.has(key));
	for (const key of Object.keys(node)) {
		delete node[key];
	}
	for (const [key, value] of preserved) {
		node[key] = value as XmlObject[string];
	}
	for (const [position, { tag, value }] of resolved.entries()) {
		const key = (occurrence.get(tag) ?? 0) > 1 ? orderedXmlKey(tag, position) : tag;
		node[key] = value as XmlObject[string];
	}
}

/** Rewrite every parsed oMath subtree so sibling order survives collapse. */
export function annotateOmmlSiblingOrder(xml: string, parsed: unknown): void {
	const fragments = extractOmathInnerXml(xml);
	if (fragments.length === 0) {
		return;
	}
	const nodes = collectParsedOmathNodes(parsed);
	const count = Math.min(fragments.length, nodes.length);
	for (let index = 0; index < count; index++) {
		if (fragments[index]) {
			reorderContainer(nodes[index]!, fragments[index]!);
		}
	}
}
