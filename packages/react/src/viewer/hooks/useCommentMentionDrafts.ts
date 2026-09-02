import type { PptxCommentMention } from 'pptx-viewer-core';
import { useCallback, useState } from 'react';

/**
 * useCommentMentionDrafts: the `@`-mention bookkeeping alongside `useComments`'
 * plain-text comment/reply drafts.
 *
 * Split out of `useComments` (file-size extraction) since it is a small,
 * self-contained slice: a mentions array per in-progress draft (new comment,
 * keyed by slide id; reply, keyed by parent comment id), set only when
 * `CommentMentionTextarea` reports a change (a plain keystroke passes
 * `mentions: undefined` through and this leaves the accumulated array alone),
 * and cleared once the draft is submitted.
 */
export interface UseCommentMentionDraftsResult {
	commentDraftMentionsBySlideId: Record<string, PptxCommentMention[]>;
	replyDraftMentionsByCommentId: Record<string, PptxCommentMention[]>;
	setCommentDraftMentions: (slideId: string, mentions: PptxCommentMention[]) => void;
	setReplyDraftMentions: (commentId: string, mentions: PptxCommentMention[]) => void;
	clearCommentDraftMentions: (slideId: string) => void;
	clearReplyDraftMentions: (commentId: string) => void;
}

function withoutKey<T>(map: Record<string, T>, key: string): Record<string, T> {
	if (!(key in map)) {
		return map;
	}
	const next = { ...map };
	delete next[key];
	return next;
}

export function useCommentMentionDrafts(): UseCommentMentionDraftsResult {
	const [commentDraftMentionsBySlideId, setCommentDraftMentionsBySlideId] = useState<
		Record<string, PptxCommentMention[]>
	>({});
	const [replyDraftMentionsByCommentId, setReplyDraftMentionsByCommentId] = useState<
		Record<string, PptxCommentMention[]>
	>({});

	const setCommentDraftMentions = useCallback((slideId: string, mentions: PptxCommentMention[]) => {
		setCommentDraftMentionsBySlideId((prev) => ({ ...prev, [slideId]: mentions }));
	}, []);
	const setReplyDraftMentions = useCallback((commentId: string, mentions: PptxCommentMention[]) => {
		setReplyDraftMentionsByCommentId((prev) => ({ ...prev, [commentId]: mentions }));
	}, []);
	const clearCommentDraftMentions = useCallback((slideId: string) => {
		setCommentDraftMentionsBySlideId((prev) => withoutKey(prev, slideId));
	}, []);
	const clearReplyDraftMentions = useCallback((commentId: string) => {
		setReplyDraftMentionsByCommentId((prev) => withoutKey(prev, commentId));
	}, []);

	return {
		commentDraftMentionsBySlideId,
		replyDraftMentionsByCommentId,
		setCommentDraftMentions,
		setReplyDraftMentions,
		clearCommentDraftMentions,
		clearReplyDraftMentions,
	};
}
