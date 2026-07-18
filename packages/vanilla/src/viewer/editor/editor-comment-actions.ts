import type { PptxComment, PptxSlide } from 'pptx-viewer-core';
import { generateElementId } from 'pptx-viewer-shared';

import type { Store, ViewerState } from '../state';
import type { EditorOps } from './editor-operations';

export interface CommentActions {
	addComment(text: string, elementId?: string): string | null;
	/**
	 * Append a reply under a top-level comment (React's `handleSubmitReply`
	 * nested-`replies` model: the reply carries `threadId` = parent id and
	 * inherits the parent's `elementId` anchor).
	 */
	addCommentReply(parentId: string, text: string): string | null;
	/** Update a comment's text in place; recurses into `replies` so nested rows are editable too. */
	editComment(id: string, text: string): void;
	deleteComment(id: string): void;
	toggleCommentResolved(id: string): void;
}

export function updateSlideComments(
	slides: readonly PptxSlide[],
	slideIndex: number,
	update: (comments: readonly PptxComment[]) => PptxComment[],
): PptxSlide[] {
	return slides.map((slide, index) =>
		index === slideIndex ? { ...slide, comments: update(slide.comments ?? []) } : slide,
	);
}

/** Immutably map every comment in the tree (top-level rows and nested replies). */
function mapCommentTree(
	comments: readonly PptxComment[],
	fn: (comment: PptxComment) => PptxComment,
): PptxComment[] {
	return comments.map((comment) => {
		const mapped = fn(comment);
		if (!mapped.replies?.length) {
			return mapped;
		}
		return { ...mapped, replies: mapCommentTree(mapped.replies, fn) };
	});
}

/** Immutably drop the comment with `id` anywhere in the tree. */
function filterCommentTree(comments: readonly PptxComment[], id: string): PptxComment[] {
	return comments
		.filter((comment) => comment.id !== id)
		.map((comment) =>
			comment.replies?.length
				? { ...comment, replies: filterCommentTree(comment.replies, id) }
				: comment,
		);
}

export function createCommentActions(deps: {
	store: Store<ViewerState>;
	ops: EditorOps;
}): CommentActions {
	const mutate = (update: (comments: readonly PptxComment[]) => PptxComment[]): void => {
		const state = deps.store.get();
		if (!state.editable || !state.slides[state.currentSlide]) {
			return;
		}
		deps.ops.pushHistory();
		deps.store.set({ slides: updateSlideComments(state.slides, state.currentSlide, update) });
		deps.ops.commitChange();
	};

	return {
		addComment(text, elementId) {
			const value = text.trim();
			if (!value) {
				return null;
			}
			const state = deps.store.get();
			if (!state.editable || !state.slides[state.currentSlide]) {
				return null;
			}
			const id = generateElementId();
			mutate((comments) => [
				...comments,
				{
					id,
					text: value,
					author: 'You',
					createdAt: new Date().toISOString(),
					resolved: false,
					elementId,
				},
			]);
			return id;
		},
		addCommentReply(parentId, text) {
			const value = text.trim();
			if (!value) {
				return null;
			}
			const state = deps.store.get();
			const slide = state.slides[state.currentSlide];
			if (!state.editable || !slide) {
				return null;
			}
			const parent = (slide.comments ?? []).find((comment) => comment.id === parentId);
			if (!parent) {
				return null;
			}
			const id = generateElementId();
			const reply: PptxComment = {
				id,
				text: value,
				author: 'You',
				createdAt: new Date().toISOString(),
				threadId: parentId,
				elementId: parent.elementId,
			};
			mutate((comments) =>
				comments.map((comment) =>
					comment.id === parentId
						? { ...comment, replies: [...(comment.replies ?? []), reply] }
						: comment,
				),
			);
			return id;
		},
		editComment(id, text) {
			const value = text.trim();
			if (!value) {
				return;
			}
			mutate((comments) =>
				mapCommentTree(comments, (comment) =>
					comment.id === id ? { ...comment, text: value } : comment,
				),
			);
		},
		deleteComment(id) {
			mutate((comments) => filterCommentTree(comments, id));
		},
		toggleCommentResolved(id) {
			mutate((comments) =>
				mapCommentTree(comments, (comment) =>
					comment.id === id ? { ...comment, resolved: !comment.resolved } : comment,
				),
			);
		},
	};
}
