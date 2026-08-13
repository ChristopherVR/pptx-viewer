/**
 * Re-basing and re-emitting the `@`-mentions on a modern (`p188`) comment.
 *
 * The markup itself, and where in the comment it can legally live, is
 * documented on `modern-comment-mention-read.ts`. This module owns the two
 * write-side problems.
 *
 * ## Re-basing
 *
 * `startIndex`/`length` index the FLATTENED plain text of the body, so any
 * edit to the text moves them. `rebaseCommentMentions` diffs old against new
 * (common prefix/suffix), shifts the spans that survive, relocates a span the
 * shift missed, and DROPS a mention whose text no longer exists. An
 * equal-length edit is NOT assumed safe: the span's characters are verified.
 *
 * ## Re-emitting
 *
 * `applyCommentMentions` writes each mention back into the container it was
 * read from and strips every stale list, so a dropped mention cannot survive
 * by being copied through as an unknown child.
 */

import type { PptxCommentMention, XmlObject } from '../types';
import {
	MENTION_LENGTH_KEYS,
	MENTION_PERSON_KEYS,
	mentionLocalName,
	mentionNodesOf,
} from './modern-comment-mention-read';

export * from './modern-comment-mention-read';

const commonPrefixLength = (a: string, b: string): number => {
	const max = Math.min(a.length, b.length);
	let index = 0;
	while (index < max && a[index] === b[index]) {
		index += 1;
	}
	return index;
};

const commonSuffixLength = (a: string, b: string, limit: number): number => {
	let index = 0;
	while (index < limit && a[a.length - 1 - index] === b[b.length - 1 - index]) {
		index += 1;
	}
	return index;
};

/** The occurrence of `span` in `text` closest to `hint`, or -1. */
const nearestOccurrence = (text: string, span: string, hint: number): number => {
	let best = -1;
	let bestDistance = Number.POSITIVE_INFINITY;
	let at = text.indexOf(span);
	while (at !== -1) {
		const distance = Math.abs(at - hint);
		if (distance < bestDistance) {
			best = at;
			bestDistance = distance;
		}
		at = text.indexOf(span, at + 1);
	}
	return best;
};

/**
 * Move every mention's `startIndex` from `oldText` onto `newText`.
 *
 * A mention entirely before the edit keeps its offset; one entirely after it
 * shifts by the length delta; one the edit overlapped is relocated by looking
 * its own text up again, and dropped when that text is gone.
 */
export function rebaseCommentMentions(
	mentions: PptxCommentMention[] | undefined,
	oldText: string,
	newText: string,
): PptxCommentMention[] | undefined {
	if (!mentions || mentions.length === 0) {
		return undefined;
	}
	if (oldText === newText) {
		return mentions;
	}
	const prefix = commonPrefixLength(oldText, newText);
	const suffix = commonSuffixLength(
		oldText,
		newText,
		Math.min(oldText.length, newText.length) - prefix,
	);
	const changeEnd = oldText.length - suffix;
	const delta = newText.length - oldText.length;

	const result: PptxCommentMention[] = [];
	for (const mention of mentions) {
		const start = mention.startIndex;
		const end = start + mention.length;
		const span = oldText.slice(start, end);
		if (span.length !== mention.length) {
			// The recorded span ran past the old text: it was already stale.
			continue;
		}
		let next = -1;
		if (end <= prefix) {
			next = start;
		} else if (start >= changeEnd) {
			next = start + delta;
		}
		if (next >= 0 && newText.slice(next, next + mention.length) === span) {
			result.push(next === start ? mention : { ...mention, startIndex: next });
			continue;
		}
		const relocated = nearestOccurrence(newText, span, next >= 0 ? next : start);
		if (relocated >= 0) {
			result.push({ ...mention, startIndex: relocated });
		}
	}
	return result.length > 0 ? result : undefined;
}

const buildMention = (mention: PptxCommentMention): XmlObject => {
	const node: XmlObject = {};
	for (const [key, value] of Object.entries(mention.rawXml || {})) {
		if (key.startsWith('@_')) {
			node[key] = value;
		}
	}
	// Overwrite whichever alias the source used, so the re-based offset wins.
	const personKey =
		MENTION_PERSON_KEYS.find((key) => node[key] !== undefined) || '@_mentionpersonId';
	const lengthKey = MENTION_LENGTH_KEYS.find((key) => node[key] !== undefined) || '@_length';
	node[personKey] = mention.personId;
	node[lengthKey] = String(mention.length);
	node['@_startIndex'] = String(mention.startIndex);
	if (mention.id) {
		const idKey =
			node['@_id'] !== undefined && node['@_mentionId'] === undefined ? '@_id' : '@_mentionId';
		node[idKey] = mention.id;
	}
	return node;
};

/** The `p188:mentionLst` node for `mentions`, or `undefined` when there are none. */
export function buildMentionListNode(
	mentions: PptxCommentMention[] | undefined,
): XmlObject | undefined {
	if (!mentions || mentions.length === 0) {
		return undefined;
	}
	return { 'p188:mention': mentions.map(buildMention) };
}

const stripMentionLists = (node: XmlObject): XmlObject => {
	const result: XmlObject = {};
	for (const [key, value] of Object.entries(node)) {
		if (key.startsWith('@_') || mentionLocalName(key) !== 'mentionLst') {
			result[key] = value;
		}
	}
	return result;
};

const groupByContainer = (
	mentions: PptxCommentMention[] | undefined,
): { direct: PptxCommentMention[]; byUri: Map<string, PptxCommentMention[]> } => {
	const direct: PptxCommentMention[] = [];
	const byUri = new Map<string, PptxCommentMention[]>();
	for (const mention of mentions || []) {
		if (!mention.containerUri) {
			direct.push(mention);
			continue;
		}
		const bucket = byUri.get(mention.containerUri);
		if (bucket) {
			bucket.push(mention);
		} else {
			byUri.set(mention.containerUri, [mention]);
		}
	}
	return { direct, byUri };
};

/**
 * Write `mentions` back onto a comment node, into whichever container each was
 * read from, and return the rewritten `extLst` (or `undefined` when empty).
 *
 * `replace` is false when the model never carried mentions for this comment
 * (the reader understood none of them), in which case the raw list is left
 * exactly where it was rather than being rewritten from an empty model.
 */
export function applyCommentMentions(
	node: XmlObject,
	mentions: PptxCommentMention[] | undefined,
	extension: XmlObject | undefined,
	replace: boolean,
): XmlObject | undefined {
	if (!replace) {
		return extension;
	}
	const { direct, byUri } = groupByContainer(mentions);
	const directList = buildMentionListNode(direct);
	if (directList) {
		node['p188:mentionLst'] = directList;
	}
	if (!extension) {
		return undefined;
	}
	const rebuilt: XmlObject = stripMentionLists(extension);
	const extensionKey =
		Object.keys(rebuilt).find((key) => mentionLocalName(key) === 'ext') || 'p188:ext';
	const entries = mentionNodesOf(rebuilt[extensionKey]).map((entry) => {
		const list = buildMentionListNode(byUri.get(String(entry['@_uri'] || '')));
		const next = stripMentionLists(entry);
		if (list) {
			next['p188:mentionLst'] = list;
		}
		return next;
	});
	if (entries.length > 0) {
		rebuilt[extensionKey] = entries.length === 1 ? entries[0] : entries;
	}
	return rebuilt;
}
