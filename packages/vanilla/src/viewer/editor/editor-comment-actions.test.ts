/* oxlint-disable eslint/one-var -- pervasive pre-existing pattern in this file
   (each spec sets up a couple of independent `const`s); merging them isn't a
   style choice here. */
import type { PptxComment, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createInitialViewerState, createStore } from '../state';
import { createCommentActions, updateSlideComments } from './editor-comment-actions';
import { createEditorOps } from './editor-operations';

const slides: PptxSlide[] = [
	{ id: 's1', rId: 'r1', slideNumber: 1, elements: [], comments: [{ id: 'c1', text: 'Old' }] },
	{ id: 's2', rId: 'r2', slideNumber: 2, elements: [] },
];

function makeActions(comments: PptxComment[]) {
	const store = createStore({
		...createInitialViewerState(),
		slides: [{ id: 's1', rId: 'r1', slideNumber: 1, elements: [], comments }],
		currentSlide: 0,
		editable: true,
	});
	const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });
	return { store, ops, actions: createCommentActions({ store, ops }) };
}

describe('updateSlideComments', () => {
	it('updates only the requested slide and preserves other references', () => {
		const result = updateSlideComments(slides, 0, (comments) => [
			...comments,
			{ id: 'c2', text: 'New' },
		]);
		expect(result[0].comments?.map(({ id }) => id)).toStrictEqual(['c1', 'c2']);
		expect(result[1]).toBe(slides[1]);
	});

	it('supports edit, resolve, and deletion transforms', () => {
		const edited = updateSlideComments(slides, 0, (comments) =>
			comments.map((comment) => ({ ...comment, text: 'Edited', resolved: true })),
		);
		expect(edited[0].comments?.[0]).toMatchObject({ text: 'Edited', resolved: true });
		const removed = updateSlideComments(edited, 0, () => []);
		expect(removed[0].comments).toStrictEqual([]);
	});
});

describe('createCommentActions replies and edit-in-place', () => {
	it('appends a reply under the parent with threadId and inherited elementId', () => {
		const { store, actions } = makeActions([
			{ id: 'c1', text: 'Parent', elementId: 'el7' },
			{ id: 'c2', text: 'Other' },
		]);

		const id = actions.addCommentReply('c1', 'A reply');

		const comments = store.get().slides[0].comments!;
		expect(comments[0].replies).toHaveLength(1);
		expect(comments[0].replies?.[0]).toMatchObject({
			id,
			text: 'A reply',
			threadId: 'c1',
			elementId: 'el7',
		});
		expect(comments[1].replies).toBeUndefined();
		expect(store.get().dirty).toBeTruthy();
	});

	it('addCommentReply is a no-op for blank text or a missing parent', () => {
		const { store, ops, actions } = makeActions([{ id: 'c1', text: 'Parent' }]);

		expect(actions.addCommentReply('c1', '   ')).toBeNull();
		expect(actions.addCommentReply('missing', 'text')).toBeNull();
		expect(store.get().slides[0].comments?.[0].replies).toBeUndefined();
		expect(ops.canUndo()).toBeFalsy();
	});

	it('editComment rewrites a top-level comment in place and marks dirty', () => {
		const { store, ops, actions } = makeActions([{ id: 'c1', text: 'Original' }]);

		actions.editComment('c1', 'Rewritten');

		expect(store.get().slides[0].comments?.[0].text).toBe('Rewritten');
		expect(store.get().dirty).toBeTruthy();
		ops.undo();
		expect(store.get().slides[0].comments?.[0].text).toBe('Original');
	});

	it('editComment reaches nested replies', () => {
		const { store, actions } = makeActions([
			{
				id: 'c1',
				text: 'Parent',
				replies: [{ id: 'r1', text: 'Reply', threadId: 'c1' }],
			},
		]);

		actions.editComment('r1', 'Reply v2');

		const parent = store.get().slides[0].comments?.[0];
		expect(parent?.text).toBe('Parent');
		expect(parent?.replies?.[0].text).toBe('Reply v2');
	});

	it('deleteComment and toggleCommentResolved also reach nested replies', () => {
		const { store, actions } = makeActions([
			{
				id: 'c1',
				text: 'Parent',
				replies: [
					{ id: 'r1', text: 'Reply 1', threadId: 'c1' },
					{ id: 'r2', text: 'Reply 2', threadId: 'c1' },
				],
			},
		]);

		actions.toggleCommentResolved('r1');
		expect(store.get().slides[0].comments?.[0].replies?.[0].resolved).toBeTruthy();

		actions.deleteComment('r2');
		expect(store.get().slides[0].comments?.[0].replies?.map(({ id }) => id)).toStrictEqual(['r1']);
	});

	it('addComment mints a shared-format id (parity with the other bindings)', () => {
		const { actions } = makeActions([]);
		const id = actions.addComment('Hello');
		expect(id).toMatch(/^comment-/);
	});

	// B5: `addCommentToList` / `replyToCommentInList` (shared) have no `mentions`
	// parameter, so the typeahead's picks are stitched onto the just-added
	// comment/reply here, in the SAME history entry as the add.
	it('addComment carries the mention list onto the new comment', () => {
		const { store, actions } = makeActions([]);
		const mentions = [{ personId: 'a1', authorName: 'Alice', startIndex: 0, length: 6 }];

		const id = actions.addComment('@Alice look at this', undefined, mentions);

		expect(store.get().slides[0].comments?.[0]).toMatchObject({ id, mentions });
	});

	it('addCommentReply carries the mention list onto the new reply', () => {
		const { store, actions } = makeActions([{ id: 'c1', text: 'Parent' }]);
		const mentions = [{ personId: 'a1', authorName: 'Alice', startIndex: 0, length: 6 }];

		const id = actions.addCommentReply('c1', '@Alice thoughts?', mentions);

		expect(store.get().slides[0].comments?.[0].replies?.[0]).toMatchObject({ id, mentions });
	});

	it('editComment, deleteComment, and toggleCommentResolved are no-ops for an unknown id: no history, no dirty flag', () => {
		const { store, ops, actions } = makeActions([{ id: 'c1', text: 'Original' }]);

		actions.editComment('missing', 'text');
		actions.deleteComment('missing');
		actions.toggleCommentResolved('missing');

		expect(store.get().slides[0].comments?.[0].text).toBe('Original');
		expect(store.get().dirty).toBeFalsy();
		expect(ops.canUndo()).toBeFalsy();
	});
});
