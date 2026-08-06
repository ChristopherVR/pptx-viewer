import type { Translator } from '../../i18n';
import { createEl } from '../../render';
import { createCommentThreadView } from '../comment-thread-view';
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
 *
 * The thread list itself is `createCommentThreadView`, shared with the
 * workspace Comments pane so vanilla's two comment surfaces cannot offer
 * different affordances.
 */
export function createCommentsTab(
	doc: Document,
	t: Translator,
	handlers: CommentsHandlers,
): CommentsTab {
	const el = createEl(doc, 'div', 'pptxv-inspector-comments');
	const threads = createCommentThreadView(doc, t, handlers);
	el.appendChild(threads.el);
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

	return {
		el,
		update(state) {
			empty.hidden = state.comments.length > 0;
			addBox.hidden = !state.editable;
			threads.update(state.comments, state.editable);
		},
	};
}
