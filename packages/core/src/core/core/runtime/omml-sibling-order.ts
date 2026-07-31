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
 * key names, so - unlike the WeakMap side-channels used for custom geometry,
 * SmartArt text and paragraph content - the order survives the cloning that
 * `equationXml` undergoes in editor state, undo history, and collaboration
 * codecs. The save-side XMLBuilder strips `#pptx-order-N` from emitted tag
 * names, so the serialized OOXML regains the original interleaved form.
 * Grouped-by-tag containers (the overwhelmingly common case) are left
 * untouched.
 *
 * The raw-XML scanning primitives live in `xml-child-scan`, shared with the
 * other order-restoring annotators.
 */

import { orderedXmlKey } from '../../geometry';
import type { XmlObject } from '../../types';
import {
	ensureItems,
	extractElementInnerXml,
	isGroupedByTag,
	isXmlObject,
	localName,
	scanDirectChildren,
} from './xml-child-scan';

/**
 * Set an own property whose key comes from untrusted XML tag names (which may
 * legally be `__proto__`). `Object.defineProperty` always creates a literal
 * own property; unlike `node[key] = value`, it never walks the prototype
 * chain and so can't be abused to overwrite `Object.prototype`.
 */
function setOwnProperty(node: XmlObject, key: string, value: XmlObject[string]): void {
	Object.defineProperty(node, key, { value, writable: true, enumerable: true, configurable: true });
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
		Reflect.deleteProperty(node, key);
	}
	for (const [key, value] of preserved) {
		setOwnProperty(node, key, value as XmlObject[string]);
	}
	for (const [position, { tag, value }] of resolved.entries()) {
		const key = (occurrence.get(tag) ?? 0) > 1 ? orderedXmlKey(tag, position) : tag;
		setOwnProperty(node, key, value as XmlObject[string]);
	}
}

/** Rewrite every parsed oMath subtree so sibling order survives collapse. */
export function annotateOmmlSiblingOrder(xml: string, parsed: unknown): void {
	const fragments = extractElementInnerXml(xml, 'oMath');
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
