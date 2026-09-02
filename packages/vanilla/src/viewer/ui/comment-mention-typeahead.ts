import type {
	PptxCommentAuthor,
	PptxCommentMention,
	PptxModernCommentAuthor,
} from 'pptx-viewer-core';
import {
	commentMentionQuery,
	insertCommentMention,
	matchCommentMentionAuthors,
} from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from '../render';

/**
 * `@`-mention typeahead for a comment draft `<textarea>`, the vanilla
 * counterpart of every other binding's comment mention picker. Pure DOM
 * listener plumbing over the shared decision functions in
 * `render/comment-mentions.ts`: the query parsing, author ranking and text
 * splice all come from there, so this module only maps the result onto a
 * suggestion list and the field's value/selection.
 *
 * @module viewer/ui/comment-mention-typeahead
 */

/** Legacy `ppt/commentAuthors.xml` authors mapped into the modern shape the typeahead reads. */
export function combineCommentMentionAuthors(
	modern: readonly PptxModernCommentAuthor[],
	legacy: readonly PptxCommentAuthor[],
): PptxModernCommentAuthor[] {
	const seen = new Set(modern.map((author) => author.id));
	const mapped = legacy
		.filter((author) => !seen.has(author.id))
		.map((author) => ({ id: author.id, name: author.name, userId: '', providerId: '' }));
	return [...modern, ...mapped];
}

export interface CommentMentionTypeaheadOptions {
	doc: Document;
	t: Translator;
	field: HTMLTextAreaElement;
	getAuthors(): readonly PptxModernCommentAuthor[];
	getMentions(): PptxCommentMention[] | undefined;
	/** Called with the field's new text + mention list after accepting a suggestion. */
	onChange(next: { text: string; mentions: PptxCommentMention[] }): void;
}

export interface CommentMentionTypeahead {
	/** The suggestion list; append it next to `field` (absolutely positioned by the caller's CSS). */
	el: HTMLElement;
	/** Remove listeners. */
	destroy(): void;
}

/** Attach the typeahead to one draft field. Call `destroy()` when the field is torn down. */
export function attachCommentMentionTypeahead(
	options: CommentMentionTypeaheadOptions,
): CommentMentionTypeahead {
	const { doc, t, field } = options;
	const list = createEl(doc, 'div', 'pptxv-comment-mention-suggestions');
	list.dataset.testid = 'pptx-comment-mention-suggestions';
	list.hidden = true;
	list.setAttribute('role', 'listbox');
	list.setAttribute('aria-label', t('pptx.comments.mentionSuggestions'));
	// "Type @ to mention someone": no dedicated UI slot for a standing hint, so
	// it rides along as the suggestions box's tooltip.
	list.title = t('pptx.comments.mentionPlaceholder');

	let matches: PptxModernCommentAuthor[] = [];
	let activeIndex = 0;

	const close = (): void => {
		list.hidden = true;
		list.replaceChildren();
		matches = [];
	};

	const accept = (author: PptxModernCommentAuthor): void => {
		const caret = field.selectionStart ?? field.value.length;
		const result = insertCommentMention(field.value, options.getMentions(), caret, author);
		field.value = result.text;
		field.setSelectionRange(result.caret, result.caret);
		options.onChange({ text: result.text, mentions: result.mentions });
		close();
		field.focus();
	};

	const renderMatches = (): void => {
		list.replaceChildren();
		matches.forEach((author, index) => {
			const option = createEl(doc, 'button', 'pptxv-comment-mention-option');
			option.type = 'button';
			option.dataset.testid = 'pptx-comment-mention-option';
			option.setAttribute('role', 'option');
			option.setAttribute('aria-selected', String(index === activeIndex));
			option.classList.toggle('is-active', index === activeIndex);
			option.textContent = author.name;
			// `mousedown` (not `click`): the field's own `blur` would otherwise fire
			// first and close the list before the click lands.
			option.addEventListener('mousedown', (event) => {
				event.preventDefault();
				accept(author);
			});
			list.appendChild(option);
		});
		list.hidden = matches.length === 0;
	};

	const sync = (): void => {
		const caret = field.selectionStart ?? field.value.length;
		const active = commentMentionQuery(field.value, caret);
		if (!active) {
			close();
			return;
		}
		matches = matchCommentMentionAuthors([...options.getAuthors()], active.query);
		activeIndex = 0;
		renderMatches();
	};

	const onInput = (): void => sync();
	const onKeydown = (event: KeyboardEvent): void => {
		if (list.hidden || matches.length === 0) {
			return;
		}
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			activeIndex = (activeIndex + 1) % matches.length;
			renderMatches();
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			activeIndex = (activeIndex - 1 + matches.length) % matches.length;
			renderMatches();
		} else if (event.key === 'Enter' || event.key === 'Tab') {
			const author = matches[activeIndex];
			if (author) {
				event.preventDefault();
				accept(author);
			}
		} else if (event.key === 'Escape') {
			event.preventDefault();
			close();
		}
	};
	const onBlur = (): void => close();

	field.addEventListener('input', onInput);
	field.addEventListener('keydown', onKeydown);
	field.addEventListener('blur', onBlur);

	return {
		el: list,
		destroy() {
			field.removeEventListener('input', onInput);
			field.removeEventListener('keydown', onKeydown);
			field.removeEventListener('blur', onBlur);
		},
	};
}
