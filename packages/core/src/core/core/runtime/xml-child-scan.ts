/**
 * xml-child-scan: minimal, backtracking-free scanning of raw OOXML for the
 * DOCUMENT ORDER of an element's direct children.
 *
 * fast-xml-parser's collapsed shape stores same-tag siblings as an array under
 * one key, so the parsed object alone can never tell you whether
 * `<a:r/><a:fld/><a:r/>` was interleaved or grouped. Every order-restoring
 * annotator (custom geometry, SmartArt text, OMML, paragraph content) therefore
 * has to re-read the source XML for that one fact. These helpers are that
 * re-read, factored out so the annotators share one implementation instead of
 * each carrying its own tag scanner.
 *
 * The scan is deliberately linear (`indexOf` plus a sticky, anchored name
 * match) rather than a general regex: the input is untrusted OOXML from an
 * arbitrary upload, and a backtracking pattern over a multi-megabyte part is a
 * denial-of-service waiting to happen.
 *
 * @module xml-child-scan
 */

import type { XmlObject } from '../../types';

/** Narrow an unknown parsed value to a plain (non-array) XML node. */
export function isXmlObject(value: unknown): value is XmlObject {
	return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

/** Normalise a parsed value to the array form fast-xml-parser may or may not use. */
export function ensureItems(value: unknown): unknown[] {
	if (value === undefined || value === null) {
		return [];
	}
	return Array.isArray(value) ? value : [value];
}

/** Strip an XML name's namespace prefix (`a:fld` -> `fld`). */
export function localName(name: string): string {
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

/** One tag occurrence located by {@link nextTag}. */
export interface ScannedTag {
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
export function nextTag(xml: string, from: number): ScannedTag | null {
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

/** A direct child located by {@link scanDirectChildren}. */
export interface RawChild {
	/** Full prefixed tag name as written in the source. */
	tag: string;
	/** The child's inner XML ('' for self-closing/empty elements). */
	inner: string;
}

/** Scan a container's inner XML for its direct children (tag + inner XML). */
export function scanDirectChildren(inner: string): RawChild[] {
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

/**
 * Inner XML of every element with the given LOCAL name, in document order
 * (`''` for empty or self-closing ones).
 *
 * Prefix-agnostic on purpose: the same element is spelled `a:p` on a slide and
 * `p` in a namespace-defaulted fragment, and the annotators only ever care
 * about the local name.
 */
export function extractElementInnerXml(xml: string, wanted: string): string[] {
	const fragments: string[] = [];
	let cursor = 0;
	let tag = nextTag(xml, cursor);
	while (tag) {
		if (tag.closing || localName(tag.name) !== wanted) {
			cursor = tag.end;
			tag = nextTag(xml, cursor);
			continue;
		}
		if (tag.selfClosing) {
			fragments.push('');
			cursor = tag.end;
			tag = nextTag(xml, cursor);
			continue;
		}
		const innerStart = tag.end;
		let depth = 1;
		let inner = xml.slice(innerStart);
		let nested = nextTag(xml, innerStart);
		while (nested) {
			if (localName(nested.name) === wanted) {
				depth += nested.closing ? -1 : nested.selfClosing ? 0 : 1;
				if (depth === 0) {
					inner = xml.slice(innerStart, nested.start);
					break;
				}
			}
			nested = nextTag(xml, nested.end);
		}
		fragments.push(inner);
		cursor = nested ? nested.end : xml.length;
		tag = nextTag(xml, cursor);
	}
	return fragments;
}

/** True while every tag's occurrences are contiguous (order-safe to collapse). */
export function isGroupedByTag(tags: readonly string[]): boolean {
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
