/**
 * Reading `@`-mentions off a modern (`p188`) comment node.
 *
 * ## What the real markup looks like
 *
 * PowerPoint's own `2018/8/main` schema (MS-PPTX section 5.14) publishes no
 * mention element: `CT_Comment` is a closed sequence of anchor, `pos`,
 * `replyLst`, `txBody`, `extLst`. The only mention vocabulary Office documents
 * anywhere is `CT_Mention` in the SpreadsheetML `2018/threadedcomments`
 * schema, whose four attributes are what a PowerPoint comment mention carries:
 *
 * ```xml
 * <p188:mentionLst>
 *   <p188:mention mentionpersonId="{author-guid}" mentionId="{guid}"
 *                 startIndex="3" length="11"/>
 * </p188:mentionLst>
 * ```
 *
 * Because the location is not standardised, the list is accepted as a direct
 * child of `p188:cm` AND nested inside `p188:extLst/p188:ext`, and which one it
 * came from is remembered (`containerUri`) so save puts it back there. Every
 * original attribute is carried on `rawXml` and re-emitted by
 * `modern-comment-mentions.ts`, so a producer that spells them differently
 * still round-trips.
 */

import type { PptxCommentMention, XmlObject } from '../types';

export const mentionLocalName = (key: string): string => key.split(':').pop() || key;

export const mentionNodesOf = (value: unknown): XmlObject[] => {
	if (Array.isArray(value)) {
		return value.filter((entry): entry is XmlObject => Boolean(entry) && typeof entry === 'object');
	}
	return value && typeof value === 'object' ? [value as XmlObject] : [];
};

export const mentionChildrenNamed = (node: XmlObject | undefined, name: string): XmlObject[] => {
	if (!node) {
		return [];
	}
	const result: XmlObject[] = [];
	for (const [key, value] of Object.entries(node)) {
		if (!key.startsWith('@_') && mentionLocalName(key) === name) {
			result.push(...mentionNodesOf(value));
		}
	}
	return result;
};

/** Attribute aliases seen in the wild, most-specific first. */
export const MENTION_PERSON_KEYS = [
	'@_mentionpersonId',
	'@_mentionPersonId',
	'@_personId',
	'@_authorId',
];

export const MENTION_LENGTH_KEYS = ['@_length', '@_mentionCharCount', '@_len'];

const attribute = (node: XmlObject, keys: string[]): string | undefined => {
	for (const key of keys) {
		const value = node[key];
		if (value !== undefined && value !== null && String(value).length > 0) {
			return String(value);
		}
	}
	return undefined;
};

const integer = (value: string | undefined): number | undefined => {
	if (value === undefined) {
		return undefined;
	}
	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
};

const readMention = (
	node: XmlObject,
	authorName: (id: string) => string | undefined,
	containerUri?: string,
): PptxCommentMention | undefined => {
	const personId = attribute(node, MENTION_PERSON_KEYS);
	const startIndex = integer(attribute(node, ['@_startIndex']));
	const length = integer(attribute(node, MENTION_LENGTH_KEYS));
	if (!personId || startIndex === undefined || length === undefined || length === 0) {
		return undefined;
	}
	return {
		personId,
		startIndex,
		length,
		id: attribute(node, ['@_mentionId', '@_id']),
		authorName: authorName(personId),
		containerUri,
		rawXml: node,
	};
};

/**
 * Collect every `p188:mention` on a `p188:cm`/`p188:reply` node, whether the
 * list sits directly on the comment or inside one of its extensions.
 */
export function readCommentMentions(
	node: XmlObject | undefined,
	authorName: (id: string) => string | undefined,
): PptxCommentMention[] | undefined {
	if (!node) {
		return undefined;
	}
	const found: PptxCommentMention[] = [];
	for (const list of mentionChildrenNamed(node, 'mentionLst')) {
		for (const entry of mentionChildrenNamed(list, 'mention')) {
			const mention = readMention(entry, authorName);
			if (mention) {
				found.push(mention);
			}
		}
	}
	for (const extension of mentionChildrenNamed(mentionChildrenNamed(node, 'extLst')[0], 'ext')) {
		const uri = String(extension['@_uri'] || '');
		for (const list of mentionChildrenNamed(extension, 'mentionLst')) {
			for (const entry of mentionChildrenNamed(list, 'mention')) {
				const mention = readMention(entry, authorName, uri);
				if (mention) {
					found.push(mention);
				}
			}
		}
	}
	found.sort((a, b) => a.startIndex - b.startIndex);
	return found.length > 0 ? found : undefined;
}
