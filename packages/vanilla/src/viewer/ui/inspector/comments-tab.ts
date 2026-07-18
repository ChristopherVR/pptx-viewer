import type { PptxComment } from 'pptx-viewer-core';

import type { Translator } from '../../i18n';
import { createEl } from '../../render';
import type { InspectorDeckState, InspectorHandlers } from './types';

export interface CommentsTab {
	el: HTMLElement;
	update(state: InspectorDeckState): void;
}

type CommentsHandlers = Pick<
	InspectorHandlers,
	'addComment' | 'addCommentReply' | 'editComment' | 'deleteComment' | 'toggleCommentResolved'
>;

/**
 * The inspector's Comments tab: current-slide comment threads with nested
 * replies, edit-in-place, resolve and delete, plus an add box in editable
 * mode (port of React's `InspectorCommentsSection` / `InspectorCommentRow`).
 * Replying is offered on top-level comments only (React's `depth === 0`
 * rule); editing works on replies too.
 */
export function createCommentsTab(
	doc: Document,
	t: Translator,
	handlers: CommentsHandlers,
): CommentsTab {
	const el = createEl(doc, 'div', 'pptxv-inspector-comments');
	const list = createEl(doc, 'div', 'pptxv-inspector-comment-list');
	el.appendChild(list);
	const empty = createEl(doc, 'p', 'pptxv-inspector-empty');
	empty.textContent = t('pptx.comments.noComments');
	el.appendChild(empty);

	const addBox = createEl(doc, 'div', 'pptxv-inspector-comment-add');
	const input = doc.createElement('textarea');
	input.className = 'pptxv-inspector-comment-input';
	input.rows = 2;
	input.placeholder = t('pptx.comments.addCommentPlaceholder');
	input.setAttribute('aria-label', t('pptx.comments.addComment'));
	const addBtn = createEl(doc, 'button', 'pptxv-inspector-deck-btn');
	addBtn.type = 'button';
	addBtn.textContent = t('pptx.comments.addComment');
	addBtn.addEventListener('click', () => {
		const text = input.value.trim();
		if (text) {
			handlers.addComment(text);
			input.value = '';
		}
	});
	addBox.append(input, addBtn);
	el.appendChild(addBox);

	// Local UI state, survives store-driven re-renders.
	let editingId: string | null = null;
	let editDraft = '';
	let replyingId: string | null = null;
	let replyDraft = '';
	const collapsedReplies = new Set<string>();
	let current: InspectorDeckState | null = null;

	const render = (): void => {
		const state = current;
		if (!state) {
			return;
		}
		empty.hidden = state.comments.length > 0;
		addBox.hidden = !state.editable;
		list.replaceChildren(
			...state.comments.map((comment) => renderComment(comment, state.editable, 0)),
		);
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

	const renderComment = (comment: PptxComment, editable: boolean, depth: number): HTMLElement => {
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
			if (editable) {
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
				row.appendChild(actions);
			}
		}

		const replies = comment.replies ?? [];
		if (replies.length > 0) {
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
			row.appendChild(toggle);
			if (!collapsedReplies.has(comment.id)) {
				const thread = createEl(doc, 'div', 'pptxv-inspector-comment-replies');
				thread.append(...replies.map((reply) => renderComment(reply, editable, depth + 1)));
				row.appendChild(thread);
			}
		}

		if (replyingId === comment.id) {
			row.appendChild(renderReplyForm(comment));
		}
		return row;
	};

	return {
		el,
		update(state) {
			current = state;
			render();
		},
	};
}
