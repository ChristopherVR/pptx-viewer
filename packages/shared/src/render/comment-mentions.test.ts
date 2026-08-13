import type { PptxCommentMention, PptxModernCommentAuthor } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	COMMENT_MENTION_ATTRIBUTE,
	commentMentionQuery,
	commentTextSegments,
	hasCommentMentions,
	insertCommentMention,
	matchCommentMentionAuthors,
} from './comment-mentions';

const BOB = '{2CB2E9D0-D392-EB21-5D46-FBA34C1295E6}';
const ANN = '{12219ED4-AB40-1676-B632-B1C0CC6115FF}';

function author(id: string, name: string, initials?: string): PptxModernCommentAuthor {
	return { id, name, initials, userId: `${name.toLowerCase()}@example.com`, providerId: 'AD' };
}

function mention(
	startIndex: number,
	length: number,
	extra: Partial<PptxCommentMention> = {},
): PptxCommentMention {
	return { personId: BOB, startIndex, length, authorName: 'Bob Example', ...extra };
}

describe('commentTextSegments', () => {
	it('splits a body into text and mention runs', () => {
		expect(
			commentTextSegments('Hi Bob Example can you check this', [mention(3, 11)]),
		).toStrictEqual([
			{ kind: 'text', text: 'Hi ' },
			{ kind: 'mention', text: 'Bob Example', authorName: 'Bob Example', personId: BOB },
			{ kind: 'text', text: ' can you check this' },
		]);
	});

	it('handles a mention at the very start and end', () => {
		expect(commentTextSegments('@Bob', [mention(0, 4)])).toStrictEqual([
			{ kind: 'mention', text: '@Bob', authorName: 'Bob Example', personId: BOB },
		]);
	});

	it('renders two mentions in one body', () => {
		const segments = commentTextSegments('@Ann and @Bob', [
			mention(0, 4, { personId: ANN, authorName: 'Ann' }),
			mention(9, 4),
		]);
		expect(segments.map((segment) => segment.kind)).toStrictEqual(['mention', 'text', 'mention']);
	});

	it('ignores an out-of-range span rather than garbling the text', () => {
		expect(commentTextSegments('Short', [mention(2, 99)])).toStrictEqual([
			{ kind: 'text', text: 'Short' },
		]);
	});

	it('ignores an overlapping second mention', () => {
		const segments = commentTextSegments('Bob Example', [mention(0, 11), mention(4, 7)]);
		expect(segments).toHaveLength(1);
		expect(segments[0].kind).toBe('mention');
	});

	it('returns plain text when there are no mentions', () => {
		expect(commentTextSegments('Just text')).toStrictEqual([{ kind: 'text', text: 'Just text' }]);
		expect(hasCommentMentions('Just text')).toBeFalsy();
		expect(hasCommentMentions('Hi Bob Example', [mention(3, 11)])).toBeTruthy();
	});

	it('stamps a stable e2e attribute name', () => {
		expect(COMMENT_MENTION_ATTRIBUTE).toBe('data-pptx-comment-mention');
	});
});

describe('commentMentionQuery', () => {
	it('finds the @-token left of the caret', () => {
		expect(commentMentionQuery('Hi @bo', 6)).toStrictEqual({ query: 'bo', start: 3 });
	});

	it('finds a bare @ at the start of the body', () => {
		expect(commentMentionQuery('@', 1)).toStrictEqual({ query: '', start: 0 });
	});

	it('does not fire inside an email address', () => {
		expect(commentMentionQuery('mail bob@example', 16)).toBeNull();
	});

	it('does not fire after the token is closed by a space', () => {
		expect(commentMentionQuery('Hi @bob ', 8)).toBeNull();
	});
});

describe('matchCommentMentionAuthors', () => {
	const authors = [author(BOB, 'Bob Example', 'BE'), author(ANN, 'Ann Other', 'AO')];

	it('prefers a prefix match', () => {
		expect(matchCommentMentionAuthors(authors, 'a')[0].name).toBe('Ann Other');
	});

	it('matches on initials', () => {
		expect(matchCommentMentionAuthors(authors, 'be')[0].name).toBe('Bob Example');
	});

	it('returns everyone for an empty query', () => {
		expect(matchCommentMentionAuthors(authors, '')).toHaveLength(2);
	});

	it('returns nothing when nothing matches', () => {
		expect(matchCommentMentionAuthors(authors, 'zzz')).toHaveLength(0);
	});
});

describe('insertCommentMention', () => {
	const bob = author(BOB, 'Bob Example', 'BE');

	it('replaces the @-token and records the span', () => {
		const result = insertCommentMention('Hi @bo', undefined, 6, bob, () => '{ID}');
		expect(result.text).toBe('Hi @Bob Example ');
		expect(result.caret).toBe(16);
		expect(result.mentions).toStrictEqual([
			{ id: '{ID}', personId: BOB, authorName: 'Bob Example', startIndex: 3, length: 12 },
		]);
		expect(result.text.slice(3, 15)).toBe('@Bob Example');
	});

	it('shifts an existing later mention by the length delta', () => {
		const existing = [mention(11, 4, { personId: ANN, authorName: 'Ann' })];
		const result = insertCommentMention('Hi @bo and @Ann', existing, 6, bob, () => '{ID}');
		expect(result.text).toBe('Hi @Bob Example  and @Ann');
		const ann = result.mentions.find((entry) => entry.personId === ANN)!;
		expect(result.text.slice(ann.startIndex, ann.startIndex + ann.length)).toBe('@Ann');
	});

	it('inserts at the caret when no @-token is open', () => {
		const result = insertCommentMention('Hi ', undefined, 3, bob, () => '{ID}');
		expect(result.text).toBe('Hi @Bob Example ');
		expect(result.mentions[0].startIndex).toBe(3);
	});
});
