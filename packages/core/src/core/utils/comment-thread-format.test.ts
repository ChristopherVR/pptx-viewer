import { describe, expect, it } from 'vitest';

import type { PptxComment } from '../types';
import {
	commentRequiresModernFormat,
	promoteCommentToModern,
	toModernCommentId,
	usesModernCommentFormat,
} from './comment-thread-format';

const legacyComment = (overrides: Partial<PptxComment> = {}): PptxComment => ({
	id: '0',
	text: 'Please update this chart.',
	author: 'Alice',
	createdAt: '2024-06-01T10:00:00Z',
	x: 100,
	y: 120,
	rawXml: { '@_authorId': '0', '@_idx': '0', 'p:text': 'Please update this chart.' },
	...overrides,
});

describe('comment thread format selection', () => {
	it('routes a replied-to legacy comment to the modern part', () => {
		const withReply = legacyComment({
			replies: [{ id: 'r1', text: 'Done.', author: 'Bob', parentId: '0' }],
		});
		expect(commentRequiresModernFormat(withReply)).toBeTruthy();
		expect(usesModernCommentFormat(withReply)).toBeTruthy();

		expect(commentRequiresModernFormat(legacyComment())).toBeFalsy();
		expect(usesModernCommentFormat(legacyComment())).toBeFalsy();
	});

	it('keeps comments already in the modern format untouched', () => {
		const modern = legacyComment({ format: 'modern' });
		expect(usesModernCommentFormat(modern)).toBeTruthy();
		expect(promoteCommentToModern(modern)).toBe(modern);
	});

	it('drops the legacy raw subtree and derives a stable GUID id on promotion', () => {
		const promoted = promoteCommentToModern(
			legacyComment({ replies: [{ id: 'r1', text: 'Done.', author: 'Bob' }] }),
		);
		expect(promoted.format).toBe('modern');
		expect(promoted.rawXml).toBeUndefined();
		expect(promoted.id).toMatch(/^\{[0-9A-F]{8}(-[0-9A-F]{4}){3}-[0-9A-F]{12}\}$/u);
		expect(promoted.status).toBe('active');
		expect(promoted.text).toBe('Please update this chart.');
		expect(promoted.x).toBe(100);
		expect(promoted.replies?.[0]).toMatchObject({ text: 'Done.', format: 'modern' });

		// Deterministic: saving twice must not churn comment identity.
		expect(promoteCommentToModern(legacyComment({ replies: [] })).id).toBe(toModernCommentId('0'));
	});

	it('carries a resolved legacy comment across as a resolved modern one', () => {
		expect(promoteCommentToModern(legacyComment({ resolved: true })).status).toBe('resolved');
	});

	it('leaves an id that is already a GUID alone apart from casing', () => {
		expect(toModernCommentId('{2a6c5ff3-0000-4000-8000-000000000001}')).toBe(
			'{2A6C5FF3-0000-4000-8000-000000000001}',
		);
	});
});
