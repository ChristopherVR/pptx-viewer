import type { PptxCommentMention, PptxSlide } from 'pptx-viewer-core';
import { useCallback, useState } from 'react';

import { addReplyToSlide } from './useComments-helpers';

/**
 * useCommentReplyHandlers: the "reply to a comment" slice of `useComments`.
 *
 * Split out purely for file size (`useComments.ts` extraction trigger: a
 * self-contained block that can own its own state). Mentions bookkeeping
 * still lives in the caller's single `useCommentMentionDrafts` instance
 * (shared with the new-comment side), passed in rather than duplicated here.
 */
export interface UseCommentReplyHandlersInput {
	slides: PptxSlide[];
	canEdit: boolean;
	userName: string;
	onUpdateSlides: (updater: (slides: PptxSlide[]) => PptxSlide[]) => void;
	onMarkDirty: () => void;
	replyDraftMentionsByCommentId: Record<string, PptxCommentMention[]>;
	setReplyDraftMentions: (commentId: string, mentions: PptxCommentMention[]) => void;
	clearReplyDraftMentions: (commentId: string) => void;
}

export interface UseCommentReplyHandlersResult {
	replyingToCommentId: string | null;
	replyDraftByCommentId: Record<string, string>;
	handleStartReply: (slideIndex: number, commentId: string) => void;
	handleCancelReply: () => void;
	handleReplyDraftChange: (
		commentId: string,
		draft: string,
		mentions?: PptxCommentMention[],
	) => void;
	handleSubmitReply: (slideIndex: number, commentId: string) => void;
}

export function useCommentReplyHandlers(
	input: UseCommentReplyHandlersInput,
): UseCommentReplyHandlersResult {
	const {
		slides,
		canEdit,
		userName,
		onUpdateSlides,
		onMarkDirty,
		replyDraftMentionsByCommentId,
		setReplyDraftMentions,
		clearReplyDraftMentions,
	} = input;

	const [replyDraftByCommentId, setReplyDraftByCommentId] = useState<Record<string, string>>({});
	const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);

	const handleStartReply = useCallback((_slideIndex: number, commentId: string) => {
		setReplyingToCommentId(commentId);
		setReplyDraftByCommentId((prev) => ({ ...prev, [commentId]: '' }));
	}, []);

	const handleCancelReply = useCallback(() => {
		setReplyingToCommentId(null);
	}, []);

	const handleReplyDraftChange = useCallback(
		(commentId: string, draft: string, mentions?: PptxCommentMention[]) => {
			setReplyDraftByCommentId((prev) => ({ ...prev, [commentId]: draft }));
			if (mentions) {
				setReplyDraftMentions(commentId, mentions);
			}
		},
		[setReplyDraftMentions],
	);

	const handleSubmitReply = useCallback(
		(slideIndex: number, commentId: string) => {
			if (!canEdit) {
				return;
			}
			const slide = slides[slideIndex];
			if (!slide) {
				return;
			}

			const replyText = String(replyDraftByCommentId[commentId] || '').trim();
			if (replyText.length === 0) {
				return;
			}

			let didAdd = false;
			onUpdateSlides((prev) => {
				const result = addReplyToSlide(
					prev,
					slideIndex,
					commentId,
					replyText,
					userName,
					replyDraftMentionsByCommentId[commentId],
				);
				didAdd = result.didAdd;
				return result.slides;
			});

			if (!didAdd) {
				return;
			}

			setReplyingToCommentId(null);
			setReplyDraftByCommentId((prev) => {
				const next = { ...prev };
				delete next[commentId];
				return next;
			});
			clearReplyDraftMentions(commentId);
			onMarkDirty();
		},
		[
			canEdit,
			onMarkDirty,
			onUpdateSlides,
			replyDraftByCommentId,
			replyDraftMentionsByCommentId,
			clearReplyDraftMentions,
			slides,
			userName,
		],
	);

	return {
		replyingToCommentId,
		replyDraftByCommentId,
		handleStartReply,
		handleCancelReply,
		handleReplyDraftChange,
		handleSubmitReply,
	};
}
