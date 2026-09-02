/**
 * comments-mentions-patch.ts: attach `@`-mention spans to a comment just
 * created by shared's `addCommentToList` / `replyToCommentInList`.
 *
 * Neither shared helper accepts a `mentions` parameter (`packages/shared/src/
 * render/comments-list.ts`), so the mention spans the comment panel's
 * typeahead recorded (`CommentMentionTextareaComponent` /
 * `insertCommentMention`) would otherwise be silently dropped on submit. This
 * patches them onto the newly-created comment by POSITION (the array's last
 * element for a top-level add, the last reply of the matched parent for a
 * threaded reply), which is safe because both shared functions APPEND rather
 * than reorder, and each call creates exactly one new comment.
 *
 * @module viewer/comments-mentions-patch
 */
import type { PptxComment, PptxCommentMention } from 'pptx-viewer-core';

/** Patch `mentions` onto the last comment in a flat list (a top-level add). */
export function withMentionsOnLast(
	comments: PptxComment[],
	mentions: PptxCommentMention[],
): PptxComment[] {
	if (mentions.length === 0 || comments.length === 0) {
		return comments;
	}
	const last = comments.length - 1;
	return comments.map((comment, index) => (index === last ? { ...comment, mentions } : comment));
}

/** Patch `mentions` onto the last reply of `parentId` (a threaded reply). */
export function withMentionsOnLastReply(
	comments: PptxComment[],
	parentId: string,
	mentions: PptxCommentMention[],
): PptxComment[] {
	if (mentions.length === 0) {
		return comments;
	}
	return comments.map((comment) => {
		if (comment.id !== parentId || !comment.replies || comment.replies.length === 0) {
			return comment;
		}
		const last = comment.replies.length - 1;
		return {
			...comment,
			replies: comment.replies.map((reply, index) =>
				index === last ? { ...reply, mentions } : reply,
			),
		};
	});
}
