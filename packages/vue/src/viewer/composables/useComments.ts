/* oxlint-disable eslint/one-var -- pervasive pre-existing pattern in this file
   (each mutator is a short sequence of independent `const`s); merging them
   isn't a style choice here. */
import type { PptxComment, PptxCommentMention } from 'pptx-viewer-core';
// The comment-array mutations themselves are pure and shared with every
// other binding; this composable only wires them to Vue's reactivity.
import {
	addCommentToList,
	generateCommentId,
	removeCommentFromList,
	replyToCommentInList,
	toggleCommentResolvedInList,
} from 'pptx-viewer-shared';
import { computed, toValue } from 'vue';
import type { ComputedRef, MaybeRefOrGetter } from 'vue';

export { generateCommentId };

/**
 * `useComments`: Vue composable backing the comments panel/editor.
 *
 * ## Data model & how comments link to slides
 *
 * In `pptx-viewer-core`, comments are stored **per slide** on
 * `PptxSlide.comments?: PptxComment[]`. The {@link PptxComment} interface itself
 * carries **no** slide-reference field (no `slideId`/`slideIndex`); a comment's
 * owning slide is implied purely by which slide's `comments` array it lives in.
 *
 * Because of that, the "deck-wide list filtered to the active slide" is realised
 * by the **host**: it slices `slides[activeSlideIndex].comments` into the
 * `comments` ref passed here. This composable therefore treats `comments` as the
 * active slide's comment list (the deck slice for `activeSlideIndex`) and the
 * mutators return the **new full comment array** for that slide, which the host
 * writes back history-aware (e.g. `slides[i].comments = next`).
 *
 * `activeSlideIndex` is retained in the options for symmetry and so callers /
 * marker-positioning can reason about which slide is active.
 *
 * No `any`; all regexes use the `/u` flag; framework-agnostic core types only.
 */
export interface UseCommentsOptions {
	/**
	 * The active slide's comments (the deck slice for `activeSlideIndex`).
	 * `PptxComment` has no slide field, so the host slices the per-slide
	 * `PptxSlide.comments` into this ref.
	 */
	comments: MaybeRefOrGetter<PptxComment[]>;
	/** Index of the slide whose comments these are. */
	activeSlideIndex: MaybeRefOrGetter<number>;
	/** Display name written as the `author` of newly-created comments. */
	authorName: MaybeRefOrGetter<string>;
}

export interface UseCommentsResult {
	/** The active slide's comments (mirrors the input ref reactively). */
	slideComments: ComputedRef<PptxComment[]>;
	/**
	 * Append a new comment to the active slide. `mentions` (from the `@`-mention
	 * typeahead; `insertCommentMention`, `pptx-viewer-shared`) is stitched onto
	 * the created comment locally: `addCommentToList` (shared) has no `mentions`
	 * parameter, so this patches the comment it appends (always the last array
	 * entry - see `addCommentToList`) after the fact rather than duplicating its
	 * id-generation and array-shape logic here.
	 * @returns the NEW full comment array for the active slide, or `null` when
	 *   `text` is blank.
	 */
	addComment: (
		text: string,
		x?: number,
		y?: number,
		mentions?: PptxCommentMention[],
	) => PptxComment[] | null;
	/**
	 * Remove a comment (by id) from the active slide.
	 * @returns the NEW full comment array, or `null` when nothing changed.
	 */
	removeComment: (id: string) => PptxComment[] | null;
	/**
	 * Toggle the `resolved` flag of a comment (by id) on the active slide.
	 * @returns the NEW full comment array, or `null` when nothing changed.
	 */
	resolveComment: (id: string) => PptxComment[] | null;
	/**
	 * Append a threaded reply to the comment `parentId` on the active slide. The
	 * reply is nested inside the parent's `replies` array and stamped with
	 * `threadId = parentId` (mirroring React's `handleSubmitReply`). `mentions`
	 * is stitched onto the created reply the same way {@link addComment} does.
	 * @returns the NEW full comment array, or `null` when the text is blank or
	 *   the parent is not found.
	 */
	replyToComment: (
		parentId: string,
		text: string,
		mentions?: PptxCommentMention[],
	) => PptxComment[] | null;
}

/** Patch `mentions` onto the last entry of `comments` (where `addCommentToList` appends). */
function withMentionsOnLast(
	comments: PptxComment[],
	mentions: PptxCommentMention[] | undefined,
): PptxComment[] {
	if (!mentions || mentions.length === 0) {
		return comments;
	}
	const lastIndex = comments.length - 1;
	return comments.map((comment, index) =>
		index === lastIndex ? { ...comment, mentions } : comment,
	);
}

/** Patch `mentions` onto the last reply of the comment `parentId` (where `replyToCommentInList` appends). */
function withMentionsOnLastReply(
	comments: PptxComment[],
	parentId: string,
	mentions: PptxCommentMention[] | undefined,
): PptxComment[] {
	if (!mentions || mentions.length === 0) {
		return comments;
	}
	return comments.map((comment) => {
		if (comment.id !== parentId || !comment.replies || comment.replies.length === 0) {
			return comment;
		}
		const lastIndex = comment.replies.length - 1;
		return {
			...comment,
			replies: comment.replies.map((reply, index) =>
				index === lastIndex ? { ...reply, mentions } : reply,
			),
		};
	});
}

export function useComments(options: UseCommentsOptions): UseCommentsResult {
	const slideComments = computed<PptxComment[]>(() => toValue(options.comments) ?? []);

	const addComment = (
		text: string,
		x?: number,
		y?: number,
		mentions?: PptxCommentMention[],
	): PptxComment[] | null => {
		const next = addCommentToList(slideComments.value, text, toValue(options.authorName), x, y);
		return next ? withMentionsOnLast(next, mentions) : null;
	};

	const removeComment = (id: string): PptxComment[] | null =>
		removeCommentFromList(slideComments.value, id);

	const resolveComment = (id: string): PptxComment[] | null =>
		toggleCommentResolvedInList(slideComments.value, id);

	const replyToComment = (
		parentId: string,
		text: string,
		mentions?: PptxCommentMention[],
	): PptxComment[] | null => {
		const next = replyToCommentInList(
			slideComments.value,
			parentId,
			text,
			toValue(options.authorName),
		);
		return next ? withMentionsOnLastReply(next, parentId, mentions) : null;
	};

	return { slideComments, addComment, removeComment, resolveComment, replyToComment };
}
