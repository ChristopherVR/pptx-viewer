/**
 * CommentMentionTextarea: a plain `<textarea>` plus the `@`-mention
 * typeahead, shared by the new-comment box and the reply form.
 *
 * The decision logic (which `@`-token is active, which authors match it,
 * what accepting one does to the text/mentions/caret) is entirely shared
 * (`comment-mentions.ts`); this component only tracks the caret position and
 * maps the result onto the textarea and a floating suggestion list.
 */
import type { PptxCommentMention, PptxModernCommentAuthor } from 'pptx-viewer-core';
import {
	commentMentionQuery,
	insertCommentMention,
	matchCommentMentionAuthors,
} from 'pptx-viewer-shared';
import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../utils';

export interface CommentMentionTextareaProps {
	value: string;
	mentions: PptxCommentMention[];
	/** Candidate authors for the typeahead (`data.modernCommentAuthors`). */
	authors: PptxModernCommentAuthor[];
	onChange: (text: string, mentions: PptxCommentMention[]) => void;
	/** Ctrl/Cmd+Enter, when the suggestion list is not open. */
	onSubmitShortcut?: () => void;
	placeholder?: string;
	rows?: number;
	className?: string;
	ariaLabel?: string;
}

export function CommentMentionTextarea({
	value,
	mentions,
	authors,
	onChange,
	onSubmitShortcut,
	placeholder,
	rows = 2,
	className,
	ariaLabel,
}: CommentMentionTextareaProps): React.ReactElement {
	const { t } = useTranslation();
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const [caret, setCaret] = useState(value.length);
	const [highlighted, setHighlighted] = useState(0);
	// The `@`-token start the user Escaped out of; suppresses the list for
	// that same token without needing to mutate the text or caret to close it.
	const [dismissedAt, setDismissedAt] = useState<number | null>(null);

	const query = useMemo(() => commentMentionQuery(value, caret), [value, caret]);
	const activeQuery = query && query.start !== dismissedAt ? query : null;
	const matches = useMemo(
		() => (activeQuery ? matchCommentMentionAuthors(authors, activeQuery.query) : []),
		[activeQuery, authors],
	);
	const safeHighlighted = matches.length > 0 ? highlighted % matches.length : 0;

	const syncCaret = (target: HTMLTextAreaElement): void => {
		setCaret(target.selectionStart ?? target.value.length);
		setHighlighted(0);
	};

	const acceptAuthor = (author: PptxModernCommentAuthor): void => {
		const result = insertCommentMention(value, mentions, caret, author);
		onChange(result.text, result.mentions);
		setCaret(result.caret);
		setDismissedAt(null);
		// The value update above lands on the next render; restore the caret
		// once the textarea actually reflects it.
		requestAnimationFrame(() => {
			textareaRef.current?.setSelectionRange(result.caret, result.caret);
			textareaRef.current?.focus();
		});
	};

	const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>): void => {
		onChange(event.target.value, mentions);
		syncCaret(event.target);
	};

	const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
		if (matches.length > 0) {
			if (event.key === 'ArrowDown') {
				event.preventDefault();
				setHighlighted((index) => (index + 1) % matches.length);
				return;
			}
			if (event.key === 'ArrowUp') {
				event.preventDefault();
				setHighlighted((index) => (index - 1 + matches.length) % matches.length);
				return;
			}
			if (event.key === 'Enter' || event.key === 'Tab') {
				event.preventDefault();
				acceptAuthor(matches[safeHighlighted]);
				return;
			}
			if (event.key === 'Escape') {
				event.preventDefault();
				setDismissedAt(activeQuery?.start ?? null);
				return;
			}
		}
		if (onSubmitShortcut && event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
			event.preventDefault();
			onSubmitShortcut();
		}
	};

	return (
		<div className='relative'>
			<textarea
				ref={textareaRef}
				aria-label={ariaLabel}
				rows={rows}
				placeholder={placeholder ?? t('pptx.comments.mentionPlaceholder')}
				value={value}
				className={className}
				onChange={handleChange}
				onSelect={(event) => syncCaret(event.currentTarget)}
				onClick={(event) => syncCaret(event.currentTarget)}
				onKeyDown={handleKeyDown}
				onKeyUp={(event) => syncCaret(event.currentTarget)}
			/>
			{activeQuery && matches.length > 0 && (
				<div
					data-testid='pptx-comment-mention-suggestions'
					role='listbox'
					aria-label={t('pptx.comments.mentionSuggestions')}
					className='absolute z-10 mt-0.5 max-h-40 w-full overflow-y-auto rounded border border-border bg-popover shadow-lg'
				>
					{matches.map((author, index) => (
						<button
							key={author.id}
							type='button'
							data-testid='pptx-comment-mention-option'
							role='option'
							aria-selected={index === safeHighlighted}
							className={cn(
								'block w-full px-2 py-1 text-left text-[11px] hover:bg-accent',
								index === safeHighlighted && 'bg-accent',
							)}
							// mousedown (not click) so the textarea never loses focus first.
							onMouseDown={(event) => {
								event.preventDefault();
								acceptAuthor(author);
							}}
						>
							{author.name}
						</button>
					))}
				</div>
			)}
		</div>
	);
}
