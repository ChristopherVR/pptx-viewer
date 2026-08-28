/* oxlint-disable eslint/one-var -- pervasive pre-existing pattern in this file
   (each action is a short sequence of independent `const`s); merging them
   isn't a style choice here. */
import type { PptxComment, PptxSlide } from 'pptx-viewer-core';
// The comment-array mutations themselves are pure and shared with every
// other binding (including the nested-reply tree traversal for edit/delete/
// resolve, which used to be reimplemented here); this module only wires them
// to the editor store's history-aware commit path.
import {
	addCommentToList,
	editCommentInList,
	removeCommentFromList,
	replyToCommentInList,
	toggleCommentResolvedInList,
} from 'pptx-viewer-shared';

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

export function createCommentActions(deps: {
	store: Store<ViewerState>;
	ops: EditorOps;
	/** Options > General > "User name" override; falls back to "You" when unset/blank. */
	getUserName?: () => string | undefined;
}): CommentActions {
	const authorName = (): string => deps.getUserName?.() || 'You';
	/**
	 * Run `transform` against the active slide's comments and, if it produced a
	 * real change, commit the result history-aware. `transform` follows the
	 * shared `render/comments-list.ts` contract: it returns the NEW full
	 * comment array, or `null` for a no-op (blank text / id not found), in
	 * which case nothing is pushed to history or marked dirty.
	 */
	const applyToActiveComments = (
		transform: (comments: PptxComment[]) => PptxComment[] | null,
	): PptxComment[] | null => {
		const state = deps.store.get();
		if (!state.editable || !state.slides[state.currentSlide]) {
			return null;
		}
		const next = transform(state.slides[state.currentSlide].comments ?? []);
		if (!next) {
			return null;
		}
		deps.ops.pushHistory();
		deps.store.set({ slides: updateSlideComments(state.slides, state.currentSlide, () => next) });
		deps.ops.commitChange();
		return next;
	};

	return {
		addComment(text, elementId) {
			const next = applyToActiveComments((comments) =>
				addCommentToList(comments, text, authorName(), undefined, undefined, elementId),
			);
			return next ? (next[next.length - 1]?.id ?? null) : null;
		},
		addCommentReply(parentId, text) {
			const next = applyToActiveComments((comments) =>
				replyToCommentInList(comments, parentId, text, authorName()),
			);
			if (!next) {
				return null;
			}
			const parent = next.find((comment) => comment.id === parentId);
			return parent?.replies?.at(-1)?.id ?? null;
		},
		editComment(id, text) {
			applyToActiveComments((comments) => editCommentInList(comments, id, text));
		},
		deleteComment(id) {
			applyToActiveComments((comments) => removeCommentFromList(comments, id));
		},
		toggleCommentResolved(id) {
			applyToActiveComments((comments) => toggleCommentResolvedInList(comments, id));
		},
	};
}
