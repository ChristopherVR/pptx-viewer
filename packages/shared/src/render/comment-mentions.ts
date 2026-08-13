/**
 * Pure, framework-agnostic `@`-mention logic for comment bodies.
 *
 * A comment's text is a flat string; its mentions are offset spans into that
 * string (see `PptxCommentMention`). Every binding needs the same two answers:
 *
 * - DISPLAY: "which slices of this string are mentions?" -> `commentTextSegments`
 *   returns a framework-neutral `CommentTextSegment[]` that a template maps
 *   straight onto spans.
 * - AUTHORING: "the user picked an author from the `@` typeahead"
 *   -> `insertCommentMention` returns the new text, the new mention list, and
 *   where the caret should land.
 *
 * No framework imports.
 */

import type { PptxCommentMention, PptxModernCommentAuthor } from 'pptx-viewer-core';

/** DOM attribute every binding stamps on a rendered mention, for e2e. */
export const COMMENT_MENTION_ATTRIBUTE = 'data-pptx-comment-mention';

/** CSS class every binding puts on a rendered mention span. */
export const COMMENT_MENTION_CLASS = 'pptx-comment-mention';

/** One run of a comment body: either inert text or an `@`-mention. */
export interface CommentTextSegment {
	kind: 'text' | 'mention';
	text: string;
	/** Display name of the mentioned author, when it resolved. */
	authorName?: string;
	/** `p188:author` id of the mentioned person. */
	personId?: string;
}

const usableMentions = (body: string, mentions?: PptxCommentMention[]): PptxCommentMention[] =>
	(mentions ?? [])
		.filter(
			(mention) =>
				Number.isFinite(mention.startIndex) &&
				Number.isFinite(mention.length) &&
				mention.length > 0 &&
				mention.startIndex >= 0 &&
				mention.startIndex + mention.length <= body.length,
		)
		.sort((a, b) => a.startIndex - b.startIndex);

/**
 * Split a comment body into plain-text and mention segments.
 *
 * Overlapping, out-of-range and zero-length spans are ignored rather than
 * producing garbled output, because the offsets come from a foreign file and
 * an edit made outside this library can invalidate them.
 */
export function commentTextSegments(
	text: string,
	mentions?: PptxCommentMention[],
): CommentTextSegment[] {
	const body = String(text ?? '');
	if (body.length === 0) {
		return [];
	}
	const segments: CommentTextSegment[] = [];
	let cursor = 0;
	for (const mention of usableMentions(body, mentions)) {
		if (mention.startIndex < cursor) {
			continue; // Overlaps the previous mention; the first one wins.
		}
		if (mention.startIndex > cursor) {
			segments.push({ kind: 'text', text: body.slice(cursor, mention.startIndex) });
		}
		segments.push({
			kind: 'mention',
			text: body.slice(mention.startIndex, mention.startIndex + mention.length),
			authorName: mention.authorName,
			personId: mention.personId,
		});
		cursor = mention.startIndex + mention.length;
	}
	if (cursor < body.length) {
		segments.push({ kind: 'text', text: body.slice(cursor) });
	}
	return segments;
}

/** Whether this body has at least one renderable mention. */
export function hasCommentMentions(text: string, mentions?: PptxCommentMention[]): boolean {
	return commentTextSegments(text, mentions).some((segment) => segment.kind === 'mention');
}

/** An in-progress `@` token the author is typing, for the mention typeahead. */
export interface CommentMentionQuery {
	/** Text typed after the `@`, lower-cased for matching. */
	query: string;
	/** Index of the `@` itself. */
	start: number;
}

/**
 * The `@`-token immediately left of `caret`, or `null` when there is none.
 *
 * The `@` must start the body or follow whitespace, and the token must not
 * contain whitespace, so an email address does not open the picker.
 */
export function commentMentionQuery(text: string, caret: number): CommentMentionQuery | null {
	const body = String(text ?? '');
	const position = Math.max(0, Math.min(caret, body.length));
	for (let index = position - 1; index >= 0; index -= 1) {
		const character = body[index];
		if (character === '@') {
			if (index > 0 && !/\s/u.test(body[index - 1])) {
				return null;
			}
			return { query: body.slice(index + 1, position).toLowerCase(), start: index };
		}
		if (/\s/u.test(character)) {
			return null;
		}
	}
	return null;
}

const mentionMatchScore = (author: PptxModernCommentAuthor, needle: string): number => {
	if (needle.length === 0) {
		return 1;
	}
	const name = author.name.toLowerCase();
	if (name.startsWith(needle)) {
		return 0;
	}
	if (name.includes(needle) || (author.initials || '').toLowerCase().startsWith(needle)) {
		return 2;
	}
	return -1;
};

/** Authors whose name or initials match a typeahead query, best-first. */
export function matchCommentMentionAuthors(
	authors: PptxModernCommentAuthor[],
	query: string,
	limit = 6,
): PptxModernCommentAuthor[] {
	const needle = String(query ?? '')
		.trim()
		.toLowerCase();
	const scored = authors
		.filter((author) => author.id && author.name)
		.map((author) => ({ author, score: mentionMatchScore(author, needle) }))
		.filter((entry) => entry.score >= 0);
	scored.sort((a, b) => a.score - b.score || a.author.name.localeCompare(b.author.name));
	return scored.slice(0, limit).map((entry) => entry.author);
}

/** Result of accepting an author from the mention typeahead. */
export interface CommentMentionInsertion {
	text: string;
	mentions: PptxCommentMention[];
	/** Where the caret belongs after the insertion. */
	caret: number;
}

/** A brace-wrapped GUID, the shape `mentionId` uses. */
export function defaultMentionId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return `{${crypto.randomUUID().toUpperCase()}}`;
	}
	const hex = (length: number): string =>
		Array.from({ length }, () =>
			Math.floor(Math.random() * 16)
				.toString(16)
				.toUpperCase(),
		).join('');
	return `{${hex(8)}-${hex(4)}-4${hex(3)}-8${hex(3)}-${hex(12)}}`;
}

/**
 * Replace the `@`-token at `caret` with `@<author name>` and record the mention.
 *
 * Existing mentions after the insertion point are shifted by the length delta,
 * so a body with several mentions stays consistent while it is being typed.
 * The inserted span INCLUDES the `@`, which is what Office records.
 */
export function insertCommentMention(
	text: string,
	mentions: PptxCommentMention[] | undefined,
	caret: number,
	author: PptxModernCommentAuthor,
	generateId: () => string = defaultMentionId,
): CommentMentionInsertion {
	const body = String(text ?? '');
	const active = commentMentionQuery(body, caret);
	const start = active ? active.start : Math.max(0, Math.min(caret, body.length));
	const end = active ? active.start + 1 + active.query.length : start;
	const label = `@${author.name}`;
	const nextText = `${body.slice(0, start)}${label} ${body.slice(end)}`;
	const delta = label.length + 1 - (end - start);

	const shifted = (mentions ?? []).map((mention) =>
		mention.startIndex >= end ? { ...mention, startIndex: mention.startIndex + delta } : mention,
	);
	shifted.push({
		id: generateId(),
		personId: author.id,
		authorName: author.name,
		startIndex: start,
		length: label.length,
	});
	shifted.sort((a, b) => a.startIndex - b.startIndex);
	return { text: nextText, mentions: shifted, caret: start + label.length + 1 };
}
