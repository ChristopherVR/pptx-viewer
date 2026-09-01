/**
 * latex-omml-siblings: the LaTeX tokenizer and the OMML sibling merger used by
 * `latex-to-omml.ts`.
 */
import { orderedXmlKey } from 'pptx-viewer-core';

import type { OmmlNode } from './omml-to-mathml';

// ── Tokenizer ────────────────────────────────────────────────────────────────

export interface Token {
	type:
		| 'command'
		| 'text'
		| 'group_start'
		| 'group_end'
		| 'superscript'
		| 'subscript'
		| 'whitespace';
	value: string;
}

const LETTER_RE = /[a-zA-Z]/u;
const WHITESPACE_RE = /\s/u;

export function tokenize(latex: string): Token[] {
	const tokens: Token[] = [];
	let i = 0;
	while (i < latex.length) {
		const ch = latex[i];
		if (ch === '{') {
			tokens.push({ type: 'group_start', value: '{' });
			i++;
		} else if (ch === '}') {
			tokens.push({ type: 'group_end', value: '}' });
			i++;
		} else if (ch === '^') {
			tokens.push({ type: 'superscript', value: '^' });
			i++;
		} else if (ch === '_') {
			tokens.push({ type: 'subscript', value: '_' });
			i++;
		} else if (ch === '\\') {
			let cmd = '\\';
			i++;
			if (i < latex.length && LETTER_RE.test(latex[i]!)) {
				while (i < latex.length && LETTER_RE.test(latex[i]!)) {
					cmd += latex[i];
					i++;
				}
				// `\begin{align*}` style starred environments are read by the
				// environment parser from the group; `\\` and `\{` are one-char
				// commands handled by the branch below.
			} else if (i < latex.length) {
				cmd += latex[i];
				i++;
			}
			tokens.push({ type: 'command', value: cmd });
		} else if (WHITESPACE_RE.test(ch!)) {
			i++;
			tokens.push({ type: 'whitespace', value: ' ' });
		} else {
			tokens.push({ type: 'text', value: ch! });
			i++;
		}
	}
	return tokens;
}

// ── Sibling merging ──────────────────────────────────────────────────────────

/**
 * True when merging the sibling entries into one tag-keyed object keeps their
 * visual order. fast-xml-parser's collapsed shape stores same-tag siblings as
 * an array under one key and distinct tags under separate keys, so a walker
 * iterating `Object.keys` re-emits the sequence grouped by tag in
 * first-appearance order. That equals the original order only while each
 * tag's occurrences are contiguous (e.g. `r r sSup` survives, `sSup r sSup`
 * does not: the runs would migrate to the end, turning a^2+b^2 into a2b2+).
 */
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
 * Merge parsed sibling nodes into a single OMML container object.
 *
 * When tags interleave (`m:sSup`, `m:r`, `m:sSup`, ... for a^2+b^2=c^2), the
 * collapsed tag-keyed shape cannot represent the sibling order under plain
 * keys, so repeated tags get position-marked keys (`m:r#pptx-order-1`, via
 * core's `orderedXmlKey`): object insertion order then carries the true
 * sequence. This is the same convention core's load pipeline applies to real
 * decks (`omml-sibling-order.ts`), and core's save-side XMLBuilder strips the
 * markers from emitted tag names, so the serialized OOXML is the natural
 * interleaved sequence PowerPoint itself writes. Grouped-by-tag sequences
 * keep the compact merged shape.
 */
export function mergeSiblings(nodes: OmmlNode[]): OmmlNode {
	const entries: Array<[string, OmmlNode[keyof OmmlNode]]> = [];
	for (const node of nodes) {
		for (const key of Object.keys(node)) {
			if (node[key] !== undefined) {
				entries.push([key, node[key]]);
			}
		}
	}

	if (!isGroupedByTag(entries.map(([key]) => key))) {
		const counts = new Map<string, number>();
		for (const [key] of entries) {
			counts.set(key, (counts.get(key) ?? 0) + 1);
		}
		const ordered: OmmlNode = {};
		for (const [position, [key, value]] of entries.entries()) {
			ordered[(counts.get(key) ?? 0) > 1 ? orderedXmlKey(key, position) : key] = value;
		}
		return ordered;
	}

	const result: OmmlNode = {};
	for (const [key, value] of entries) {
		if (result[key]) {
			const existing = result[key];
			if (Array.isArray(existing)) {
				(existing as OmmlNode[]).push(value as OmmlNode);
			} else {
				result[key] = [existing as OmmlNode, value as OmmlNode];
			}
		} else {
			result[key] = value;
		}
	}
	return result;
}
