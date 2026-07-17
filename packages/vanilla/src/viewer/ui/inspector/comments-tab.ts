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
	'addComment' | 'deleteComment' | 'toggleCommentResolved'
>;

/**
 * The inspector's Comments tab: current-slide comment list with resolve and
 * delete, plus an add box in editable mode (a scoped-down port of React's
 * `InspectorCommentsSection`; replies/edit-in-place are not ported).
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

	const renderComment = (comment: PptxComment, editable: boolean): HTMLElement => {
		const row = createEl(doc, 'div', 'pptxv-inspector-comment');
		row.classList.toggle('is-resolved', comment.resolved === true);
		const meta = createEl(doc, 'div', 'pptxv-inspector-comment-meta');
		meta.textContent = comment.author || t('pptx.comments.unknownAuthor');
		const text = createEl(doc, 'p', 'pptxv-inspector-comment-text');
		text.textContent = comment.text;
		row.append(meta, text);
		if (editable) {
			const actions = createEl(doc, 'div', 'pptxv-inspector-comment-actions');
			const resolve = createEl(doc, 'button', 'pptxv-inspector-comment-action');
			resolve.type = 'button';
			resolve.textContent = t(
				comment.resolved ? 'pptx.comments.unresolve' : 'pptx.comments.resolve',
			);
			resolve.addEventListener('click', () => handlers.toggleCommentResolved(comment.id));
			const del = createEl(doc, 'button', 'pptxv-inspector-comment-action');
			del.type = 'button';
			del.textContent = t('pptx.comments.delete');
			del.addEventListener('click', () => handlers.deleteComment(comment.id));
			actions.append(resolve, del);
			row.appendChild(actions);
		}
		return row;
	};

	return {
		el,
		update(state) {
			empty.hidden = state.comments.length > 0;
			addBox.hidden = !state.editable;
			list.replaceChildren(
				...state.comments.map((comment) => renderComment(comment, state.editable)),
			);
		},
	};
}
