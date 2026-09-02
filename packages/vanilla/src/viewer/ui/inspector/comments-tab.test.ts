import type { PptxComment } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../i18n';
import { createCommentsTab } from './comments-tab';
import type { InspectorDeckState, InspectorHandlers } from './types';

function makeHandlers() {
	return {
		addComment: vi.fn<InspectorHandlers['addComment']>(),
		addCommentReply: vi.fn<InspectorHandlers['addCommentReply']>(),
		editComment: vi.fn<InspectorHandlers['editComment']>(),
		deleteComment: vi.fn<InspectorHandlers['deleteComment']>(),
		toggleCommentResolved: vi.fn<InspectorHandlers['toggleCommentResolved']>(),
	};
}

function makeState(comments: PptxComment[], editable = true): InspectorDeckState {
	return { comments, editable } as unknown as InspectorDeckState;
}

const t = createTranslator();

function findAction(scope: Element, label: string): HTMLButtonElement {
	const btn = Array.from(
		scope.querySelectorAll<HTMLButtonElement>('.pptxv-inspector-comment-action'),
	).find((b) => b.textContent === label);
	expect(btn).toBeDefined();
	return btn!;
}

describe('inspector comments tab', () => {
	it('renders nested replies with a count toggle', () => {
		const tab = createCommentsTab(document, t, makeHandlers());
		tab.update(
			makeState([
				{
					id: 'c1',
					text: 'Parent',
					author: 'Ada',
					replies: [
						{ id: 'r1', text: 'First reply', author: 'Bob', threadId: 'c1' },
						{ id: 'r2', text: 'Second reply', author: 'Cee', threadId: 'c1' },
					],
				},
			]),
		);

		const replies = tab.el.querySelectorAll('.pptxv-inspector-comment.is-reply');
		expect(replies).toHaveLength(2);
		expect(replies[0].textContent).toContain('First reply');

		const toggle = tab.el.querySelector<HTMLButtonElement>(
			'.pptxv-inspector-comment-replies-toggle',
		);
		expect(toggle?.textContent).toBe(t('pptx.comments.repliesCount', { count: 2 }));
		toggle!.click();
		expect(tab.el.querySelectorAll('.pptxv-inspector-comment.is-reply')).toHaveLength(0);
		toggle!.click();
		expect(tab.el.querySelectorAll('.pptxv-inspector-comment.is-reply')).toHaveLength(2);
	});

	it('submits a reply to a top-level comment through addCommentReply', () => {
		const handlers = makeHandlers();
		const tab = createCommentsTab(document, t, handlers);
		tab.update(makeState([{ id: 'c1', text: 'Parent', author: 'Ada' }]));

		findAction(tab.el, t('pptx.comments.reply')).click();
		const form = tab.el.querySelector<HTMLElement>('.pptxv-inspector-comment-reply-form');
		expect(form).not.toBeNull();

		const area = form!.querySelector<HTMLTextAreaElement>('textarea');
		area!.value = 'A fresh reply';
		area!.dispatchEvent(new Event('input'));
		findAction(form!, t('pptx.comments.addReply')).click();
		expect(handlers.addCommentReply).toHaveBeenCalledWith('c1', 'A fresh reply', []);
		// The inline form closes after submitting.
		expect(tab.el.querySelector('.pptxv-inspector-comment-reply-form')).toBeNull();
	});

	it('does not offer reply on nested reply rows (depth 0 only, like React)', () => {
		const tab = createCommentsTab(document, t, makeHandlers());
		tab.update(
			makeState([
				{ id: 'c1', text: 'Parent', replies: [{ id: 'r1', text: 'Reply', threadId: 'c1' }] },
			]),
		);
		const replyRow = tab.el.querySelector('.pptxv-inspector-comment.is-reply');
		const labels = Array.from(
			replyRow!.querySelectorAll<HTMLButtonElement>('.pptxv-inspector-comment-action'),
		).map((b) => b.textContent);
		expect(labels).not.toContain(t('pptx.comments.reply'));
		expect(labels).toContain(t('pptx.comments.edit'));
	});

	it('edits a comment in place through editComment', () => {
		const handlers = makeHandlers();
		const tab = createCommentsTab(document, t, handlers);
		tab.update(makeState([{ id: 'c1', text: 'Original', author: 'Ada' }]));

		findAction(tab.el, t('pptx.comments.edit')).click();
		const editBox = tab.el.querySelector<HTMLElement>('.pptxv-inspector-comment-edit');
		const area = editBox!.querySelector<HTMLTextAreaElement>('textarea');
		expect(area!.value).toBe('Original');
		area!.value = 'Rewritten';
		area!.dispatchEvent(new Event('input'));
		findAction(editBox!, t('pptx.comments.save')).click();
		expect(handlers.editComment).toHaveBeenCalledWith('c1', 'Rewritten');
		expect(tab.el.querySelector('.pptxv-inspector-comment-edit')).toBeNull();
	});

	it('edits a nested reply in place too', () => {
		const handlers = makeHandlers();
		const tab = createCommentsTab(document, t, handlers);
		tab.update(
			makeState([
				{ id: 'c1', text: 'Parent', replies: [{ id: 'r1', text: 'Reply', threadId: 'c1' }] },
			]),
		);
		const replyRow = tab.el.querySelector('.pptxv-inspector-comment.is-reply');
		findAction(replyRow!, t('pptx.comments.edit')).click();
		const editBox = tab.el.querySelector<HTMLElement>('.pptxv-inspector-comment-edit');
		const area = editBox!.querySelector<HTMLTextAreaElement>('textarea');
		area!.value = 'Reply v2';
		area!.dispatchEvent(new Event('input'));
		findAction(editBox!, t('pptx.comments.save')).click();
		expect(handlers.editComment).toHaveBeenCalledWith('r1', 'Reply v2');
	});

	it('cancelling an edit leaves the comment untouched', () => {
		const handlers = makeHandlers();
		const tab = createCommentsTab(document, t, handlers);
		tab.update(makeState([{ id: 'c1', text: 'Original' }]));

		findAction(tab.el, t('pptx.comments.edit')).click();
		const editBox = tab.el.querySelector<HTMLElement>('.pptxv-inspector-comment-edit');
		findAction(editBox!, t('pptx.comments.cancel')).click();
		expect(handlers.editComment).not.toHaveBeenCalled();
		expect(tab.el.querySelector('.pptxv-inspector-comment-edit')).toBeNull();
	});

	it('hides editing affordances in read-only mode but still shows replies', () => {
		const tab = createCommentsTab(document, t, makeHandlers());
		tab.update(
			makeState(
				[{ id: 'c1', text: 'Parent', replies: [{ id: 'r1', text: 'Reply', threadId: 'c1' }] }],
				false,
			),
		);
		expect(tab.el.querySelectorAll('.pptxv-inspector-comment-action')).toHaveLength(0);
		expect(tab.el.querySelectorAll('.pptxv-inspector-comment.is-reply')).toHaveLength(1);
	});
});
