import type { PptxCommentMention, PptxModernCommentAuthor } from 'pptx-viewer-core';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { LuReply } from 'react-icons/lu';

import { CommentMentionTextarea } from './CommentMentionTextarea';

/** The inline reply box `InspectorCommentRow` shows under a comment being replied to. */
export interface InspectorCommentReplyFormProps {
	commentId: string;
	authorName: string;
	draft: string;
	mentions: PptxCommentMention[];
	authors: PptxModernCommentAuthor[];
	onDraftChange: (commentId: string, draft: string, mentions?: PptxCommentMention[]) => void;
	onSubmit: (commentId: string) => void;
	onCancel: () => void;
}

export function InspectorCommentReplyForm({
	commentId,
	authorName,
	draft,
	mentions,
	authors,
	onDraftChange,
	onSubmit,
	onCancel,
}: InspectorCommentReplyFormProps): React.ReactElement {
	const { t } = useTranslation();
	return (
		<div className='mt-2 space-y-1.5 pl-3 border-l-2 border-l-primary/40'>
			<CommentMentionTextarea
				value={draft}
				mentions={mentions}
				authors={authors}
				rows={2}
				placeholder={t('pptx.comments.replyPlaceholder', { author: authorName || 'Author' })}
				className='w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary resize-y'
				onChange={(text, next) => onDraftChange(commentId, text, next)}
				onSubmitShortcut={() => onSubmit(commentId)}
			/>
			<div className='flex items-center gap-1.5'>
				<button
					type='button'
					className='inline-flex items-center gap-1 rounded bg-primary px-2 py-1 text-[11px] text-white hover:bg-primary/80 disabled:opacity-40 disabled:cursor-not-allowed'
					onClick={() => onSubmit(commentId)}
					disabled={draft.trim().length === 0}
				>
					<LuReply className='h-3 w-3' />
					{t('pptx.comments.addReply')}
				</button>
				<button
					type='button'
					className='inline-flex items-center gap-1 rounded bg-muted px-2 py-1 text-[11px] text-foreground hover:bg-accent'
					onClick={onCancel}
				>
					{t('pptx.comments.cancel')}
				</button>
			</div>
		</div>
	);
}
