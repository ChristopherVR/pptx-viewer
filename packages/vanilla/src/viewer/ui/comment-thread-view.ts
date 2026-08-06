import type { PptxComment } from 'pptx-viewer-core';

import type { Translator } from '../i18n';
import { createEl } from '../render';

/**
 * The threaded comment list: nested replies, edit-in-place, reply, resolve and
 * delete.
 *
 * Vanilla shows comments in TWO places (the inspector's Comments tab and the
 * workspace Comments pane) and only the inspector used to offer threads, so a
 * user who added a comment from the canvas landed in the pane with no way to
 * reply. Both surfaces now render this one view, which is also what keeps the
 * two from drifting apart. Class names stay `pptxv-inspector-comment*` because
 * that is what the stylesheet already carries.
 *
 * Replying is offered on top-level comments only (React's `depth === 0` rule);
 * editing works on replies too.
 */

export interface CommentThreadHandlers {
	addCommentReply(parentId: string, text: string): void;
	editComment(id: string, text: string): void;
	deleteComment(id: string): void;
	toggleCommentResolved(id: string): void;
}

export interface CommentThreadView {
	/** The list container; append it wherever the surface wants the threads. */
	el: HTMLElement;
	/** Re-render from the current model. */
	update(comments: readonly PptxComment[], editable: boolean): void;
}

export function createCommentThreadView(
	doc: Document,
	t: Translator,
	handlers: CommentThreadHandlers,
): CommentThreadView {
	const el = createEl(doc, 'div', 'pptxv-inspector-comment-list');

	// Local UI state, survives store-driven re-renders.
	let editingId: string | null = null;
	let editDraft = '';
	let replyingId: string | null = null;
	let replyDraft = '';
	const collapsedReplies = new Set<string>();
	let comments: readonly PptxComment[] = [];
	let editable = false;

	const render = (): void => {
		el.replaceChildren(...comments.map((comment) => renderComment(comment, editable, 0)));
	};

	const actionBtn = (label: string, onClick: () => void): HTMLButtonElement => {
		const btn = createEl(doc, 'button', 'pptxv-inspector-comment-action');
		btn.type = 'button';
		btn.textContent = label;
		btn.addEventListener('click', onClick);
		return btn;
	};

	const draftBox = (
		value: string,
		placeholder: string,
		onInput: (next: string) => void,
	): HTMLTextAreaElement => {
		const area = doc.createElement('textarea');
		area.className = 'pptxv-inspector-comment-input';
		area.rows = 2;
		area.value = value;
		area.placeholder = placeholder;
		area.addEventListener('input', () => onInput(area.value));
		return area;
	};

	const renderEditForm = (comment: PptxComment): HTMLElement => {
		const form = createEl(doc, 'div', 'pptxv-inspector-comment-edit');
		const area = draftBox(editDraft, '', (next) => {
			editDraft = next;
		});
		area.setAttribute('aria-label', t('pptx.comments.edit'));
		const actions = createEl(doc, 'div', 'pptxv-inspector-comment-actions');
		actions.append(
			actionBtn(t('pptx.comments.save'), () => {
				if (editDraft.trim()) {
					handlers.editComment(comment.id, editDraft.trim());
				}
				editingId = null;
				render();
			}),
			actionBtn(t('pptx.comments.cancel'), () => {
				editingId = null;
				render();
			}),
		);
		form.append(area, actions);
		return form;
	};

	const renderReplyForm = (comment: PptxComment): HTMLElement => {
		const form = createEl(doc, 'div', 'pptxv-inspector-comment-reply-form');
		const area = draftBox(
			replyDraft,
			t('pptx.comments.replyPlaceholder', {
				author: comment.author || t('pptx.comments.unknownAuthor'),
			}),
			(next) => {
				replyDraft = next;
			},
		);
		area.setAttribute('aria-label', t('pptx.comments.reply'));
		const actions = createEl(doc, 'div', 'pptxv-inspector-comment-actions');
		actions.append(
			actionBtn(t('pptx.comments.addReply'), () => {
				if (replyDraft.trim()) {
					handlers.addCommentReply(comment.id, replyDraft.trim());
				}
				replyingId = null;
				replyDraft = '';
				render();
			}),
			actionBtn(t('pptx.comments.cancel'), () => {
				replyingId = null;
				render();
			}),
		);
		form.append(area, actions);
		return form;
	};

	const renderActions = (comment: PptxComment, depth: number): HTMLElement => {
		const actions = createEl(doc, 'div', 'pptxv-inspector-comment-actions');
		actions.appendChild(
			actionBtn(t('pptx.comments.edit'), () => {
				editingId = comment.id;
				editDraft = comment.text;
				render();
			}),
		);
		if (depth === 0) {
			actions.appendChild(
				actionBtn(t('pptx.comments.reply'), () => {
					replyingId = comment.id;
					replyDraft = '';
					render();
				}),
			);
		}
		actions.append(
			actionBtn(t(comment.resolved ? 'pptx.comments.unresolve' : 'pptx.comments.resolve'), () =>
				handlers.toggleCommentResolved(comment.id),
			),
			actionBtn(t('pptx.comments.delete'), () => handlers.deleteComment(comment.id)),
		);
		return actions;
	};

	const renderReplies = (
		comment: PptxComment,
		rowEditable: boolean,
		depth: number,
	): HTMLElement => {
		const wrap = createEl(doc, 'div', 'pptxv-inspector-comment-replies-wrap');
		const replies = comment.replies ?? [];
		const toggle = createEl(doc, 'button', 'pptxv-inspector-comment-replies-toggle');
		toggle.type = 'button';
		toggle.textContent = t('pptx.comments.repliesCount', { count: replies.length });
		toggle.setAttribute('aria-expanded', String(!collapsedReplies.has(comment.id)));
		toggle.addEventListener('click', () => {
			if (collapsedReplies.has(comment.id)) {
				collapsedReplies.delete(comment.id);
			} else {
				collapsedReplies.add(comment.id);
			}
			render();
		});
		wrap.appendChild(toggle);
		if (!collapsedReplies.has(comment.id)) {
			const thread = createEl(doc, 'div', 'pptxv-inspector-comment-replies');
			thread.append(...replies.map((reply) => renderComment(reply, rowEditable, depth + 1)));
			wrap.appendChild(thread);
		}
		return wrap;
	};

	function renderComment(comment: PptxComment, rowEditable: boolean, depth: number): HTMLElement {
		const row = createEl(doc, 'div', 'pptxv-inspector-comment');
		row.classList.toggle('is-resolved', comment.resolved === true);
		row.classList.toggle('is-reply', depth > 0);
		const meta = createEl(doc, 'div', 'pptxv-inspector-comment-meta');
		meta.textContent = comment.author || t('pptx.comments.unknownAuthor');
		if (comment.resolved) {
			const badge = createEl(doc, 'span', 'pptxv-inspector-comment-badge');
			badge.textContent = t('pptx.comments.resolved');
			meta.appendChild(badge);
		}
		row.appendChild(meta);

		if (editingId === comment.id) {
			row.appendChild(renderEditForm(comment));
		} else {
			const text = createEl(doc, 'p', 'pptxv-inspector-comment-text');
			text.textContent = comment.text;
			row.appendChild(text);
			if (rowEditable) {
				row.appendChild(renderActions(comment, depth));
			}
		}

		if ((comment.replies ?? []).length > 0) {
			row.appendChild(renderReplies(comment, rowEditable, depth));
		}
		if (replyingId === comment.id) {
			row.appendChild(renderReplyForm(comment));
		}
		return row;
	}

	return {
		el,
		update(nextComments, nextEditable) {
			comments = nextComments;
			editable = nextEditable;
			render();
		},
	};
}
