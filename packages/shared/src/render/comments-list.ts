/**
 * Pure, framework-agnostic comment-array transforms, shared by every binding.
 *
 * Operates on a single slide's comment list (the "active slide" slice). Each
 * mutator returns the NEW full comment array, or `null` when nothing changed
 * (blank text / id-not-found), so the host can write the result back
 * history-aware.
 *
 * No framework imports.
 */

import type { PptxComment } from 'pptx-viewer-core';

/** Generate a stable, collision-resistant comment id. */
export function generateCommentId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return `comment-${crypto.randomUUID()}`;
	}
	// Fallback for environments without `crypto.randomUUID`.
	const rand = Math.random().toString(36).slice(2);
	return `comment-${Date.now().toString(36)}-${rand}`;
}

/**
 * Append a new comment to a comment list.
 * @returns the NEW full comment array, or `null` when `text` is blank.
 */
export function addCommentToList(
	comments: PptxComment[],
	text: string,
	authorName: string,
	x?: number,
	y?: number,
): PptxComment[] | null {
	const trimmed = text.trim();
	if (trimmed.length === 0) {
		return null;
	}

	const comment: PptxComment = {
		id: generateCommentId(),
		text: trimmed,
		author: authorName,
		createdAt: new Date().toISOString(),
		resolved: false,
		...(typeof x === 'number' ? { x } : {}),
		...(typeof y === 'number' ? { y } : {}),
	};

	return [...comments, comment];
}

/**
 * Remove a comment (by id) from a comment list.
 * @returns the NEW full comment array, or `null` when nothing changed.
 */
export function removeCommentFromList(comments: PptxComment[], id: string): PptxComment[] | null {
	const next = comments.filter((comment) => comment.id !== id);
	if (next.length === comments.length) {
		return null;
	}
	return next;
}

/**
 * Append a threaded reply under the top-level comment `parentId`.
 *
 * The reply is nested inside the parent's `replies` array and stamped with
 * `threadId`/`parentId` (mirroring React's `handleSubmitReply`), inheriting
 * the parent's `elementId` anchor when it has one.
 * @returns the NEW full comment array, or `null` when `text` is blank or the
 *   parent is not found.
 */
export function replyToCommentInList(
	comments: PptxComment[],
	parentId: string,
	text: string,
	authorName: string,
): PptxComment[] | null {
	const trimmed = text.trim();
	if (trimmed.length === 0) {
		return null;
	}
	const parent = comments.find((comment) => comment.id === parentId);
	if (!parent) {
		return null;
	}
	const reply: PptxComment = {
		id: generateCommentId(),
		text: trimmed,
		author: authorName,
		createdAt: new Date().toISOString(),
		threadId: parentId,
		parentId,
		...(parent.elementId ? { elementId: parent.elementId } : {}),
	};
	return comments.map((comment) =>
		comment.id === parentId
			? { ...comment, replies: [...(comment.replies ?? []), reply] }
			: comment,
	);
}

/**
 * Toggle the `resolved` flag of a comment (by id) in a comment list.
 * @returns the NEW full comment array, or `null` when nothing changed.
 */
export function toggleCommentResolvedInList(
	comments: PptxComment[],
	id: string,
): PptxComment[] | null {
	let changed = false;
	const next = comments.map((comment) => {
		if (comment.id !== id) {
			return comment;
		}
		changed = true;
		return { ...comment, resolved: !comment.resolved };
	});
	if (!changed) {
		return null;
	}
	return next;
}
