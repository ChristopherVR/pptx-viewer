/**
 * omml-to-latex-helpers: node-access and text helpers for the OMML -> LaTeX
 * reverse converter (`omml-to-latex.ts`).
 */
import { stripXmlOrderSuffix } from 'pptx-viewer-core';

import { REVERSE_ESCAPE, REVERSE_GREEK, REVERSE_OPERATOR } from './latex-omml-symbols';

export type XmlRecord = Record<string, unknown>;

export function ensureArr(val: unknown): XmlRecord[] {
	if (val === undefined || val === null) {
		return [];
	}
	if (Array.isArray(val)) {
		return val.filter((entry): entry is XmlRecord => Boolean(entry) && typeof entry === 'object');
	}
	if (typeof val === 'object') {
		return [val as XmlRecord];
	}
	return [];
}

export function childNode(node: XmlRecord | undefined, key: string): XmlRecord {
	if (!node) {
		return {};
	}
	const v = node[key];
	if (Array.isArray(v)) {
		return ensureArr(v)[0] ?? {};
	}
	if (v && typeof v === 'object') {
		return v as XmlRecord;
	}
	return {};
}

export function attrVal(node: XmlRecord | undefined): string {
	if (!node) {
		return '';
	}
	const v = node['@_val'];
	if (typeof v === 'string') {
		return v;
	}
	return v !== undefined && v !== null ? String(v) : '';
}

/** True when the property node exists (even with an empty `m:val`). */
export function hasAttr(node: XmlRecord | undefined): boolean {
	return Boolean(node) && node!['@_val'] !== undefined;
}

/** OMML boolean property: `1`, `on`, `true` (or a bare presence) are truthy. */
export function isOn(node: XmlRecord | undefined): boolean {
	const v = attrVal(node);
	return v === '1' || v === 'on' || v === 'true';
}

/** Read an `m:t` value (string / number / `{ '#text' }` object) as a string. */
export function readRunText(run: XmlRecord): string {
	const t = run['m:t'];
	if (typeof t === 'string') {
		return t;
	}
	if (typeof t === 'number' || typeof t === 'boolean') {
		return String(t);
	}
	if (Array.isArray(t)) {
		return t.map((entry) => readRunText({ 'm:t': entry })).join('');
	}
	if (t && typeof t === 'object') {
		const inner = (t as XmlRecord)['#text'];
		return typeof inner === 'string' || typeof inner === 'number' ? String(inner) : '';
	}
	return '';
}

/** Content keys of a container: everything but attributes and `*Pr` property nodes. */
export function contentKeys(node: XmlRecord): string[] {
	return Object.keys(node).filter((key) => {
		if (key.startsWith('@_') || key === '#text') {
			return false;
		}
		const tag = stripXmlOrderSuffix(key);
		return !tag.endsWith('Pr') && tag !== 'm:t';
	});
}

/**
 * When `container` holds exactly one child element, return its tag and node;
 * otherwise `null`. Used to recognise `m:d( m:m )` as `pmatrix`, etc.
 */
export function soleChild(
	container: XmlRecord | undefined,
): { tag: string; node: XmlRecord } | null {
	if (!container) {
		return null;
	}
	const keys = contentKeys(container);
	if (keys.length !== 1) {
		return null;
	}
	const items = ensureArr(container[keys[0]!]);
	if (items.length !== 1) {
		return null;
	}
	return { tag: stripXmlOrderSuffix(keys[0]!), node: items[0]! };
}

/** Escape one character of run text for the LaTeX tokenizer. */
export function escapeChar(ch: string): string {
	if (REVERSE_GREEK[ch]) {
		return `${REVERSE_GREEK[ch]} `;
	}
	if (REVERSE_OPERATOR[ch]) {
		return `${REVERSE_OPERATOR[ch]} `;
	}
	return REVERSE_ESCAPE[ch] ?? ch;
}

/** Escape a whole run of math text (symbols become commands, syntax is escaped). */
export function escapeMathText(text: string): string {
	return Array.from(text).map(escapeChar).join('');
}

/** Replacements for the characters that carry syntax inside a `\text{...}` argument. */
const TEXT_ARGUMENT_ESCAPES: Readonly<Record<string, string>> = {
	'\\': '\\backslash ',
	'{': '\\{',
	'}': '\\}',
};

/**
 * Escape text destined for a `\text{...}` argument: only the brace syntax
 * matters. One pass over a character class, so the backslash a brace escape
 * introduces is never itself re-escaped by a later pass.
 */
export function escapeTextArgument(text: string): string {
	return text.replace(/[\\{}]/gu, (ch) => TEXT_ARGUMENT_ESCAPES[ch] ?? ch);
}

/**
 * True when the LaTeX for `container` is a single atom that can take a script
 * directly (`x^{2}`); multi-atom bases need braces (`{10}^{2}`, `{ab}_{i}`).
 */
export function isSingleAtom(container: XmlRecord | undefined): boolean {
	const sole = soleChild(container);
	if (!sole) {
		return false;
	}
	if (sole.tag !== 'm:r') {
		return true;
	}
	const text = readRunText(sole.node);
	if (isOn(childNode(childNode(sole.node, 'm:rPr'), 'm:nor'))) {
		return true;
	}
	return Array.from(text).length === 1;
}

/**
 * Graceful fallback for constructs with no LaTeX spelling: collect every
 * `m:t` in document order so the user still sees (and keeps) the content.
 */
export function collectText(node: unknown): string {
	if (node === null || node === undefined) {
		return '';
	}
	if (typeof node === 'string' || typeof node === 'number') {
		return String(node);
	}
	if (Array.isArray(node)) {
		return node.map((entry) => collectText(entry)).join('');
	}
	if (typeof node !== 'object') {
		return '';
	}
	const record = node as XmlRecord;
	let out = '';
	for (const [key, value] of Object.entries(record)) {
		if (key.startsWith('@_')) {
			continue;
		}
		const tag = stripXmlOrderSuffix(key);
		if (tag === 'm:t') {
			out += escapeMathText(readRunText(record));
		} else if (tag === '#text') {
			out += escapeMathText(String(value));
		} else if (!tag.endsWith('Pr')) {
			out += collectText(value);
		}
	}
	return out;
}
