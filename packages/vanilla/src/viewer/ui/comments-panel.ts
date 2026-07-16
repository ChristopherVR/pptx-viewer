import type { PptxComment } from 'pptx-viewer-core';

import type { CommentActions } from '../editor/editor-comment-actions';
import type { Translator } from '../i18n';
import { createEl } from '../render';

export function openCommentsPanel(
	doc: Document,
	host: HTMLElement,
	t: Translator,
	comments: readonly PptxComment[],
	actions: CommentActions,
): void {
	host.querySelector('[data-pptx-comments-panel]')?.remove();
	const pane = createEl(doc, 'aside', 'pptxv-workspace-pane');
	pane.dataset.pptxCommentsPanel = 'true';
	const header = createEl(doc, 'header');
	const title = createEl(doc, 'h2');
	title.textContent = t('pptx.toolbar.comments');
	const close = createEl(doc, 'button');
	close.type = 'button';
	close.textContent = '×';
	close.setAttribute('aria-label', t('pptx.common.close'));
	header.append(title, close);
	pane.appendChild(header);
	const list = createEl(doc, 'div', 'pptxv-workspace-list');
	if (!comments.length) {
		const empty = createEl(doc, 'p');
		empty.textContent = t('pptx.comments.noneOnSlide');
		list.appendChild(empty);
	}
	for (const comment of comments) {
		const card = createEl(doc, 'article', 'pptxv-comment-card');
		card.classList.toggle('is-resolved', Boolean(comment.resolved));
		const author = createEl(doc, 'strong');
		author.textContent = comment.author ?? 'You';
		const input = createEl(doc, 'textarea');
		input.value = comment.text;
		input.setAttribute('aria-label', t('pptx.comments.edit'));
		const controls = createEl(doc, 'div');
		for (const [label, action] of [
			[t('pptx.comments.save'), () => actions.editComment(comment.id, input.value)],
			[
				t(comment.resolved ? 'pptx.comments.unresolve' : 'pptx.comments.resolve'),
				() => actions.toggleCommentResolved(comment.id),
			],
			[t('pptx.comments.delete'), () => actions.deleteComment(comment.id)],
		] as const) {
			const button = createEl(doc, 'button');
			button.type = 'button';
			button.textContent = label;
			button.addEventListener('click', action);
			controls.appendChild(button);
		}
		card.append(author, input, controls);
		list.appendChild(card);
	}
	const draft = createEl(doc, 'textarea');
	draft.placeholder = t('pptx.comments.addPlaceholder');
	const add = createEl(doc, 'button');
	add.type = 'button';
	add.textContent = t('pptx.comments.addComment');
	add.addEventListener('click', () => {
		if (actions.addComment(draft.value)) {
			pane.remove();
		}
	});
	list.append(draft, add);
	pane.appendChild(list);
	close.addEventListener('click', () => pane.remove());
	host.appendChild(pane);
}
