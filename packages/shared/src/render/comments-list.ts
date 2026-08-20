/* oxlint-disable eslint/one-var -- pervasive pre-existing pattern in this file
   (each mutator is a short sequence of independent `const`s); merging them
   isn't a style choice here. */
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
	elementId?: string,
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
		...(elementId ? { elementId } : {}),
	};

	return [...comments, comment];
}

/**
 * Immutably map the comment matching `id` anywhere in the tree (top-level
 * rows and nested `replies`, at any depth), applying `fn` to it.
 * @returns a tuple of the new tree and whether a match was found/changed.
 */
function mapCommentTree(
	comments: PptxComment[],
	id: string,
	fn: (comment: PptxComment) => PptxComment,
): [PptxComment[], boolean] {
	let changed = false;
	const next = comments.map((comment) => {
		if (comment.id === id) {
			changed = true;
			return fn(comment);
		}
		if (comment.replies && comment.replies.length > 0) {
			const [replies, repliesChanged] = mapCommentTree(comment.replies, id, fn);
			if (repliesChanged) {
				changed = true;
				return { ...comment, replies };
			}
		}
		return comment;
	});
	return [next, changed];
}

/**
 * Immutably drop the comment matching `id` anywhere in the tree (top-level
 * rows and nested `replies`, at any depth).
 * @returns a tuple of the new tree and whether anything was removed.
 */
function filterCommentTree(comments: PptxComment[], id: string): [PptxComment[], boolean] {
	let changed = false;
	const next: PptxComment[] = [];
	for (const comment of comments) {
		if (comment.id === id) {
			changed = true;
			continue;
		}
		if (comment.replies && comment.replies.length > 0) {
			const [replies, repliesChanged] = filterCommentTree(comment.replies, id);
			if (repliesChanged) {
				changed = true;
				next.push({ ...comment, replies });
				continue;
			}
		}
		next.push(comment);
	}
	return [next, changed];
}

/**
 * Remove a comment (by id) from a comment list. Searches the whole tree, so
 * a nested reply (at any depth) is removed just like a top-level comment.
 * @returns the NEW full comment array, or `null` when nothing changed.
 */
export function removeCommentFromList(comments: PptxComment[], id: string): PptxComment[] | null {
	const [next, changed] = filterCommentTree(comments, id);
	return changed ? next : null;
}

/**
 * Update the text of a comment (by id) anywhere in the tree (top-level rows
 * and nested `replies`, at any depth).
 * @returns the NEW full comment array, or `null` when `text` is blank or the
 *   comment is not found.
 */
export function editCommentInList(
	comments: PptxComment[],
	id: string,
	text: string,
): PptxComment[] | null {
	const trimmed = text.trim();
	if (trimmed.length === 0) {
		return null;
	}
	const [next, changed] = mapCommentTree(comments, id, (comment) => ({
		...comment,
		text: trimmed,
	}));
	return changed ? next : null;
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
 * Toggle the `resolved` flag of a comment (by id) in a comment list. Searches
 * the whole tree, so a nested reply (at any depth) can be resolved just like
 * a top-level comment.
 * @returns the NEW full comment array, or `null` when nothing changed.
 */
export function toggleCommentResolvedInList(
	comments: PptxComment[],
	id: string,
): PptxComment[] | null {
	const [next, changed] = mapCommentTree(comments, id, (comment) => ({
		...comment,
		resolved: !comment.resolved,
	}));
	return changed ? next : null;
}
