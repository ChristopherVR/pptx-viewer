/**
 * comments.service.test.ts — Unit tests for `CommentsService`.
 *
 * The service is a thin signal wrapper over the pure helpers, so these tests
 * exercise it by instantiating it directly (no Angular TestBed required — the
 * constructor has no DI dependencies).
 */

import type { PptxComment } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { CommentsService } from './comments.service';

function comment(overrides: Partial<PptxComment> & { id: string }): PptxComment {
	return {
		text: 'hello',
		author: 'Tester',
		createdAt: '2026-01-01T00:00:00.000Z',
		resolved: false,
		...overrides,
	};
}

describe('commentsService', () => {
	it('exposes empty comments by default', () => {
		const svc = new CommentsService();
		expect(svc.slideComments()).toStrictEqual([]);
		expect(svc.activeSlideIndex()).toBe(0);
		expect(svc.authorName()).toBe('You');
	});

	it('reflects the comments set via setComments', () => {
		const svc = new CommentsService();
		const list = [comment({ id: 'a' })];
		svc.setComments(list);
		expect(svc.slideComments()).toStrictEqual(list);
	});

	it('treats null/undefined comments as an empty array', () => {
		const svc = new CommentsService();
		svc.setComments(null);
		expect(svc.slideComments()).toStrictEqual([]);
		svc.setComments(undefined);
		expect(svc.slideComments()).toStrictEqual([]);
	});

	it('tracks active slide index and author name', () => {
		const svc = new CommentsService();
		svc.setActiveSlideIndex(3);
		svc.setAuthorName('Alice');
		expect(svc.activeSlideIndex()).toBe(3);
		expect(svc.authorName()).toBe('Alice');
	});

	// -- addComment ----------------------------------------------------------

	it('addComment returns the new full array with the author name applied', () => {
		const svc = new CommentsService();
		svc.setAuthorName('Alice');
		const next = svc.addComment('Hello there');
		expect(next).not.toBeNull();
		expect(next).toHaveLength(1);
		expect(next?.[0].text).toBe('Hello there');
		expect(next?.[0].author).toBe('Alice');
		expect(next?.[0].resolved).toBeFalsy();
	});

	it('addComment appends to existing comments', () => {
		const svc = new CommentsService();
		svc.setComments([comment({ id: 'a' })]);
		const next = svc.addComment('second');
		expect(next).toHaveLength(2);
		expect(next?.[1].text).toBe('second');
	});

	it('addComment trims and returns null for blank text', () => {
		const svc = new CommentsService();
		expect(svc.addComment('   ')).toBeNull();
		expect(svc.addComment('')).toBeNull();
	});

	it('addComment carries through x/y coordinates', () => {
		const svc = new CommentsService();
		const next = svc.addComment('pinned', 0.1, 0.2);
		expect(next?.[0].x).toBe(0.1);
		expect(next?.[0].y).toBe(0.2);
	});

	it('addComment does not mutate the active comments signal', () => {
		const svc = new CommentsService();
		svc.setComments([comment({ id: 'a' })]);
		svc.addComment('new one');
		// The service does not write back — the host owns that.
		expect(svc.slideComments()).toHaveLength(1);
	});

	// -- removeComment -------------------------------------------------------

	it('removeComment returns the new array without the comment', () => {
		const svc = new CommentsService();
		svc.setComments([comment({ id: 'a' }), comment({ id: 'b' })]);
		const next = svc.removeComment('a');
		expect(next?.map((c) => c.id)).toStrictEqual(['b']);
	});

	it('removeComment returns null when nothing matched', () => {
		const svc = new CommentsService();
		svc.setComments([comment({ id: 'a' })]);
		expect(svc.removeComment('missing')).toBeNull();
	});

	// -- resolveComment ------------------------------------------------------

	it('resolveComment toggles the resolved flag', () => {
		const svc = new CommentsService();
		svc.setComments([comment({ id: 'a', resolved: false })]);
		const next = svc.resolveComment('a');
		expect(next?.[0].resolved).toBeTruthy();
	});

	it('resolveComment toggles back to unresolved', () => {
		const svc = new CommentsService();
		svc.setComments([comment({ id: 'a', resolved: true })]);
		const next = svc.resolveComment('a');
		expect(next?.[0].resolved).toBeFalsy();
	});

	it('resolveComment returns null when nothing matched', () => {
		const svc = new CommentsService();
		svc.setComments([comment({ id: 'a' })]);
		expect(svc.resolveComment('missing')).toBeNull();
	});
});
