import type { PptxCommentMention } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { createTranslator } from '../i18n';
import {
	attachCommentMentionTypeahead,
	combineCommentMentionAuthors,
} from './comment-mention-typeahead';

const t = createTranslator();

describe('comment mention typeahead', () => {
	it('lists a matching author when typing @<query>', () => {
		const field = document.createElement('textarea');
		document.body.appendChild(field);
		const typeahead = attachCommentMentionTypeahead({
			doc: document,
			t,
			field,
			getAuthors: () => [
				{ id: 'a1', name: 'Alice', userId: '', providerId: '' },
				{ id: 'a2', name: 'Bob', userId: '', providerId: '' },
			],
			getMentions: () => [],
			onChange: () => undefined,
		});

		field.value = '@al';
		field.selectionStart = 3;
		field.selectionEnd = 3;
		field.dispatchEvent(new Event('input'));

		const options = typeahead.el.querySelectorAll<HTMLButtonElement>(
			'[data-testid="pptx-comment-mention-option"]',
		);
		expect(typeahead.el.hidden).toBeFalsy();
		expect(Array.from(options).map((option) => option.textContent)).toStrictEqual(['Alice']);
		typeahead.destroy();
		field.remove();
	});

	it('inserts "@Alice " and records one mention with the right offsets on accept', () => {
		const field = document.createElement('textarea');
		document.body.appendChild(field);
		let mentions: PptxCommentMention[] = [];
		const typeahead = attachCommentMentionTypeahead({
			doc: document,
			t,
			field,
			getAuthors: () => [{ id: 'a1', name: 'Alice', userId: '', providerId: '' }],
			getMentions: () => mentions,
			onChange: (next) => {
				field.value = next.text;
				mentions = next.mentions;
			},
		});

		field.value = 'Hey @al';
		field.selectionStart = 7;
		field.selectionEnd = 7;
		field.dispatchEvent(new Event('input'));

		typeahead.el
			.querySelector<HTMLButtonElement>('[data-testid="pptx-comment-mention-option"]')!
			.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));

		expect(field.value).toBe('Hey @Alice ');
		expect(mentions).toHaveLength(1);
		expect(mentions[0]).toMatchObject({
			personId: 'a1',
			authorName: 'Alice',
			startIndex: 4,
			length: 6,
		});
		expect(typeahead.el.hidden).toBeTruthy();
		typeahead.destroy();
		field.remove();
	});

	it('closes without a match, and stays closed on a bare word (no @)', () => {
		const field = document.createElement('textarea');
		document.body.appendChild(field);
		const typeahead = attachCommentMentionTypeahead({
			doc: document,
			t,
			field,
			getAuthors: () => [{ id: 'a1', name: 'Alice', userId: '', providerId: '' }],
			getMentions: () => [],
			onChange: () => undefined,
		});

		field.value = 'no mention here';
		field.selectionStart = field.value.length;
		field.selectionEnd = field.value.length;
		field.dispatchEvent(new Event('input'));

		expect(typeahead.el.hidden).toBeTruthy();
		typeahead.destroy();
		field.remove();
	});
});

describe('combineCommentMentionAuthors', () => {
	it('maps legacy commentAuthors.xml authors into the modern shape', () => {
		const combined = combineCommentMentionAuthors(
			[{ id: 'p1', name: 'Modern Author', userId: 'u1', providerId: 'prov' }],
			[{ id: '0', name: 'Legacy Author', initials: 'LA', lastIdx: 1, clrIdx: 0 }],
		);
		expect(combined).toStrictEqual([
			{ id: 'p1', name: 'Modern Author', userId: 'u1', providerId: 'prov' },
			{ id: '0', name: 'Legacy Author', userId: '', providerId: '' },
		]);
	});

	it('does not duplicate an id present in both lists', () => {
		const combined = combineCommentMentionAuthors(
			[{ id: '0', name: 'Modern Wins', userId: 'u1', providerId: 'prov' }],
			[{ id: '0', name: 'Legacy Loses', initials: 'LL', lastIdx: 1, clrIdx: 0 }],
		);
		expect(combined).toHaveLength(1);
		expect(combined[0]?.name).toBe('Modern Wins');
	});
});
