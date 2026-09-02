import type { PptxComment, PptxCommentMention, PptxModernCommentAuthor } from 'pptx-viewer-core';

import type { CommentActions } from '../editor/editor-comment-actions';
import type { Translator } from '../i18n';
import { createEl } from '../render';
import { attachCommentMentionTypeahead } from './comment-mention-typeahead';
import { createCommentThreadView } from './comment-thread-view';

/** Live view of the active slide's comments backing the workspace pane. */
export interface CommentsPanelModel {
	/** The active slide's comments at this moment. */
	getComments(): readonly PptxComment[];
	/** Authors offered by the `@`-mention typeahead. */
	getAuthors(): readonly PptxModernCommentAuthor[];
	/** Notify on any state change; returns an unsubscribe function. */
	subscribe(listener: () => void): () => void;
}

/** Detach hook stored on the pane so a replacement can end its subscription. */
const DISPOSE = Symbol('pptxv-comments-panel-dispose');

interface DisposablePane extends HTMLElement {
	[DISPOSE]?: () => void;
}

/**
 * The workspace Comments pane. LIVE, not a snapshot: it subscribes to the
 * store (the same pattern the inspector Comments tab rides via its
 * store-driven `update`) and rebuilds its card list whenever the comment
 * model changes, so a resolve/edit/delete re-renders in place and an add
 * appends the new card with the pane still open. The compose draft lives
 * outside the rebuilt card list and survives re-renders.
 */
export function openCommentsPanel(
	doc: Document,
	host: HTMLElement,
	t: Translator,
	model: CommentsPanelModel,
	actions: CommentActions,
): void {
	const existing = host.querySelector<DisposablePane>('[data-pptx-comments-panel]');
	existing?.[DISPOSE]?.();
	existing?.remove();

	const pane: DisposablePane = createEl(doc, 'aside', 'pptxv-workspace-pane');
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
	// The SAME threaded view the inspector Comments tab renders, so the pane a
	// canvas "Add Comment" lands in offers replies too (it used to offer only
	// save/resolve/delete, leaving no way to reply without closing it).
	const threads = createCommentThreadView(doc, t, actions, model.getAuthors);
	const empty = createEl(doc, 'p');
	empty.textContent = t('pptx.comments.noneOnSlide');
	list.append(threads.el, empty);

	const render = (): void => {
		const comments: readonly PptxComment[] = model.getComments();
		empty.hidden = comments.length > 0;
		threads.update(comments, true);
	};

	const draft = createEl(doc, 'textarea');
	draft.placeholder = t('pptx.comments.addPlaceholder');
	let draftMentions: PptxCommentMention[] = [];
	const draftMentionTypeahead = attachCommentMentionTypeahead({
		doc,
		t,
		field: draft,
		getAuthors: model.getAuthors,
		getMentions: () => draftMentions,
		onChange: (next) => {
			draft.value = next.text;
			draftMentions = next.mentions;
		},
	});
	const add = createEl(doc, 'button');
	add.type = 'button';
	add.textContent = t('pptx.comments.addComment');
	add.addEventListener('click', () => {
		if (actions.addComment(draft.value, undefined, draftMentions)) {
			// The subscription re-renders the card list; the pane stays open.
			draft.value = '';
			draftMentions = [];
		}
	});
	list.append(draft, draftMentionTypeahead.el, add);
	pane.appendChild(list);

	// Re-render only when the comment ARRAY changes (every mutation replaces
	// it), so unrelated store traffic never clobbers an in-progress card edit.
	let lastRendered = model.getComments();
	const dispose = (): void => {
		unsubscribe();
		draftMentionTypeahead.destroy();
		delete pane[DISPOSE];
	};
	const unsubscribe = model.subscribe(() => {
		if (!pane.isConnected) {
			dispose();
			return;
		}
		const next = model.getComments();
		if (next !== lastRendered) {
			lastRendered = next;
			render();
		}
	});
	pane[DISPOSE] = dispose;

	close.addEventListener('click', () => {
		dispose();
		pane.remove();
	});
	render();
	host.appendChild(pane);
}
