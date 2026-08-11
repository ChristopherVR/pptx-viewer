import type { PptxComment } from 'pptx-viewer-core';
// Comment id minting is shared with the other bindings.
import { generateCommentId } from 'pptx-viewer-shared';
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
	 * Append a new comment to the active slide.
	 * @returns the NEW full comment array for the active slide, or `null` when
	 *   `text` is blank.
	 */
	addComment: (text: string, x?: number, y?: number) => PptxComment[] | null;
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
	 * `threadId = parentId` (mirroring React's `handleSubmitReply`).
	 * @returns the NEW full comment array, or `null` when the text is blank or
	 *   the parent is not found.
	 */
	replyToComment: (parentId: string, text: string) => PptxComment[] | null;
}

export function useComments(options: UseCommentsOptions): UseCommentsResult {
	const slideComments = computed<PptxComment[]>(() => toValue(options.comments) ?? []);

	const addComment = (text: string, x?: number, y?: number): PptxComment[] | null => {
		const trimmed = text.trim();
		if (trimmed.length === 0) {
			return null;
		}

		const comment: PptxComment = {
			id: generateCommentId(),
			text: trimmed,
			author: toValue(options.authorName),
			createdAt: new Date().toISOString(),
			resolved: false,
			...(typeof x === 'number' ? { x } : {}),
			...(typeof y === 'number' ? { y } : {}),
		};

		return [...slideComments.value, comment];
	};

	const removeComment = (id: string): PptxComment[] | null => {
		const existing = slideComments.value;
		const next = existing.filter((comment) => comment.id !== id);
		if (next.length === existing.length) {
			return null;
		}
		return next;
	};

	const resolveComment = (id: string): PptxComment[] | null => {
		const existing = slideComments.value;
		let changed = false;
		const next = existing.map((comment) => {
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
	};

	const replyToComment = (parentId: string, text: string): PptxComment[] | null => {
		const trimmed = text.trim();
		if (trimmed.length === 0) {
			return null;
		}
		const existing = slideComments.value;
		const parent = existing.find((comment) => comment.id === parentId);
		if (!parent) {
			return null;
		}
		const reply: PptxComment = {
			id: generateCommentId(),
			text: trimmed,
			author: toValue(options.authorName),
			createdAt: new Date().toISOString(),
			threadId: parentId,
			parentId,
			...(parent.elementId ? { elementId: parent.elementId } : {}),
		};
		return existing.map((comment) =>
			comment.id === parentId
				? { ...comment, replies: [...(comment.replies ?? []), reply] }
				: comment,
		);
	};

	return { slideComments, addComment, removeComment, resolveComment, replyToComment };
}
