/**
 * comments-helpers.test.ts: Unit tests for the pure comment-array transforms.
 *
 * Ports the Vue/React coverage (add / remove / resolve / id-generation /
 * blank-text edge cases). No Angular TestBed required.
 */

import type { PptxComment } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	addCommentToList,
	generateCommentId,
	removeCommentFromList,
	toggleCommentResolvedInList,
} from './comments-helpers';

function comment(overrides: Partial<PptxComment> & { id: string }): PptxComment {
	return {
		text: 'hello',
		author: 'Tester',
		createdAt: '2026-01-01T00:00:00.000Z',
		resolved: false,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// generateCommentId
// ---------------------------------------------------------------------------

describe('generateCommentId', () => {
	it('returns a string prefixed with "comment-"', () => {
		expect(generateCommentId().startsWith('comment-')).toBeTruthy();
	});

	it('produces unique ids across calls', () => {
		const ids = new Set<string>();
		for (let i = 0; i < 100; i++) {
			ids.add(generateCommentId());
		}
		expect(ids.size).toBe(100);
	});
});

// ---------------------------------------------------------------------------
// addCommentToList
// ---------------------------------------------------------------------------

describe('addCommentToList', () => {
	it('appends a new comment to an empty list', () => {
		const next = addCommentToList([], 'First comment', 'Alice');
		expect(next).not.toBeNull();
		expect(next).toHaveLength(1);
		expect(next?.[0].text).toBe('First comment');
		expect(next?.[0].author).toBe('Alice');
		expect(next?.[0].resolved).toBeFalsy();
		expect(next?.[0].id.startsWith('comment-')).toBeTruthy();
		expect(next?.[0].createdAt).toBeTypeOf('string');
	});

	it('appends after existing comments without mutating the source', () => {
		const existing = [comment({ id: 'c1' })];
		const next = addCommentToList(existing, 'Second', 'Bob');
		expect(next).toHaveLength(2);
		expect(next?.[0]).toBe(existing[0]);
		expect(next?.[1].text).toBe('Second');
		// Source untouched
		expect(existing).toHaveLength(1);
	});

	it('trims whitespace from the text', () => {
		const next = addCommentToList([], '   padded   ', 'Alice');
		expect(next?.[0].text).toBe('padded');
	});

	it('returns null for blank text', () => {
		expect(addCommentToList([], '', 'Alice')).toBeNull();
	});

	it('returns null for whitespace-only text', () => {
		expect(addCommentToList([], '   \n\t  ', 'Alice')).toBeNull();
	});

	it('includes x/y coordinates when provided as numbers', () => {
		const next = addCommentToList([], 'pinned', 'Alice', 0.25, 0.75);
		expect(next?.[0].x).toBe(0.25);
		expect(next?.[0].y).toBe(0.75);
	});

	it('includes x=0 / y=0 (falsy but valid numbers)', () => {
		const next = addCommentToList([], 'origin', 'Alice', 0, 0);
		expect(next?.[0].x).toBe(0);
		expect(next?.[0].y).toBe(0);
	});

	it('omits x/y when not provided', () => {
		const next = addCommentToList([], 'no coords', 'Alice');
		expect(next?.[0]).not.toHaveProperty('x');
		expect(next?.[0]).not.toHaveProperty('y');
	});
});

// ---------------------------------------------------------------------------
// removeCommentFromList
// ---------------------------------------------------------------------------

describe('removeCommentFromList', () => {
	it('removes the matching comment and returns the new array', () => {
		const list = [comment({ id: 'a' }), comment({ id: 'b' }), comment({ id: 'c' })];
		const next = removeCommentFromList(list, 'b');
		expect(next).not.toBeNull();
		expect(next?.map((c) => c.id)).toStrictEqual(['a', 'c']);
	});

	it('does not mutate the source array', () => {
		const list = [comment({ id: 'a' }), comment({ id: 'b' })];
		removeCommentFromList(list, 'a');
		expect(list.map((c) => c.id)).toStrictEqual(['a', 'b']);
	});

	it('returns null when the id is not present', () => {
		const list = [comment({ id: 'a' })];
		expect(removeCommentFromList(list, 'missing')).toBeNull();
	});

	it('returns null for an empty list', () => {
		expect(removeCommentFromList([], 'anything')).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// toggleCommentResolvedInList
// ---------------------------------------------------------------------------

describe('toggleCommentResolvedInList', () => {
	it('flips an unresolved comment to resolved', () => {
		const list = [comment({ id: 'a', resolved: false })];
		const next = toggleCommentResolvedInList(list, 'a');
		expect(next?.[0].resolved).toBeTruthy();
	});

	it('flips a resolved comment back to unresolved', () => {
		const list = [comment({ id: 'a', resolved: true })];
		const next = toggleCommentResolvedInList(list, 'a');
		expect(next?.[0].resolved).toBeFalsy();
	});

	it('only toggles the matching comment', () => {
		const list = [comment({ id: 'a', resolved: false }), comment({ id: 'b', resolved: false })];
		const next = toggleCommentResolvedInList(list, 'b');
		expect(next?.[0].resolved).toBeFalsy();
		expect(next?.[1].resolved).toBeTruthy();
	});

	it('does not mutate the source comment object', () => {
		const target = comment({ id: 'a', resolved: false });
		const list = [target];
		toggleCommentResolvedInList(list, 'a');
		expect(target.resolved).toBeFalsy();
	});

	it('returns null when the id is not present', () => {
		const list = [comment({ id: 'a' })];
		expect(toggleCommentResolvedInList(list, 'missing')).toBeNull();
	});

	it('returns null for an empty list', () => {
		expect(toggleCommentResolvedInList([], 'anything')).toBeNull();
	});
});
