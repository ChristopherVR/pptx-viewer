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

/**
 * Set an own property whose key comes from untrusted XML tag names (which may
 * legally be `__proto__`). `Object.defineProperty` always creates a literal
 * own property; unlike `node[key] = value`, it never walks the prototype
 * chain and so can't be abused to overwrite `Object.prototype`.
 */
function setOwnProperty(node: XmlObject, key: string, value: XmlObject[string]): void {
	Object.defineProperty(node, key, { value, writable: true, enumerable: true, configurable: true });
}

function localName(name: string): string {
	const colon = name.indexOf(':');
	return colon >= 0 ? name.slice(colon + 1) : name;
}

/** Matches an XML tag's name (open or close) at an exact position. */
const TAG_NAME_RE = /<(\/)?([A-Za-z_][\w.:-]*)/uy;

/**
 * Index just past the `>` that closes the tag starting at `xml[start]`
 * (`'<'`), skipping over `>` characters inside quoted attribute values.
 * Scans linearly (no regex backtracking) so it stays safe on adversarial,
 * untrusted OOXML input.
 */
function findTagClose(xml: string, start: number): number {
	let index = start;
	while (index < xml.length) {
		const char = xml[index];
		if (char === '"' || char === "'") {
			const closingQuote = xml.indexOf(char, index + 1);
			index = closingQuote === -1 ? xml.length : closingQuote + 1;
			continue;
		}
		if (char === '>') {
			return index + 1;
		}
		index++;
	}
	return xml.length;
}

interface ScannedTag {
	/** True for a closing tag (`</name>`). */
	closing: boolean;
	/** True for a self-closing tag (`<name/>`). */
	selfClosing: boolean;
	/** Full prefixed tag name. */
	name: string;
	/** Index of the tag's opening `<`. */
	start: number;
	/** Index just past the tag's closing `>`. */
	end: number;
}

/** Scan forward from `from` for the next open/close/self-closing tag. */
function nextTag(xml: string, from: number): ScannedTag | null {
	let open = xml.indexOf('<', from);
	while (open !== -1) {
		TAG_NAME_RE.lastIndex = open;
		const nameMatch = TAG_NAME_RE.exec(xml);
		if (nameMatch) {
			const end = findTagClose(xml, open);
			const selfClosing = xml[end - 2] === '/';
			return { closing: Boolean(nameMatch[1]), selfClosing, name: nameMatch[2]!, start: open, end };
		}
		open = xml.indexOf('<', open + 1);
	}
	return null;
}

/** Inner XML of every oMath element in document order ('' for empty ones). */
function extractOmathInnerXml(xml: string): string[] {
	const fragments: string[] = [];
	let cursor = 0;
	let tag = nextTag(xml, cursor);
	while (tag) {
		if (!tag.closing && localName(tag.name) === 'oMath') {
			if (tag.selfClosing) {
				fragments.push('');
				cursor = tag.end;
			} else {
				const innerStart = tag.end;
				let depth = 1;
				let inner = xml.slice(innerStart);
				let scanCursor = innerStart;
				let nested = nextTag(xml, scanCursor);
				while (nested) {
					if (localName(nested.name) === 'oMath') {
						depth += nested.closing ? -1 : nested.selfClosing ? 0 : 1;
						if (depth === 0) {
							inner = xml.slice(innerStart, nested.start);
							break;
						}
					}
					scanCursor = nested.end;
					nested = nextTag(xml, scanCursor);
				}
				fragments.push(inner);
				cursor = nested ? nested.end : xml.length;
			}
		} else {
			cursor = tag.end;
		}
		tag = nextTag(xml, cursor);
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
	let cursor = 0;
	let tag = nextTag(inner, cursor);
	while (tag) {
		if (tag.closing) {
			depth = Math.max(0, depth - 1);
			if (depth === 0 && open) {
				children.push({ tag: open.tag, inner: inner.slice(open.innerStart, tag.start) });
				open = null;
			}
		} else if (tag.selfClosing) {
			if (depth === 0) {
				children.push({ tag: tag.name, inner: '' });
			}
		} else {
			if (depth === 0) {
				open = { tag: tag.name, innerStart: tag.end };
			}
			depth++;
		}
		cursor = tag.end;
		tag = nextTag(inner, cursor);
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
