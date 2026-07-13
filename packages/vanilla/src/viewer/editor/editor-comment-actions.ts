import type { PptxComment, PptxSlide } from 'pptx-viewer-core';
import { generateElementId } from 'pptx-viewer-shared';

import type { Store, ViewerState } from '../state';
import type { EditorOps } from './editor-operations';

export interface CommentActions {
	addComment(text: string, elementId?: string): string | null;
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
		editComment(id, text) {
			const value = text.trim();
			if (!value) {
				return;
			}
			mutate((comments) =>
				comments.map((comment) => (comment.id === id ? { ...comment, text: value } : comment)),
			);
		},
		deleteComment(id) {
			mutate((comments) => comments.filter((comment) => comment.id !== id));
		},
		toggleCommentResolved(id) {
			mutate((comments) =>
				comments.map((comment) =>
					comment.id === id ? { ...comment, resolved: !comment.resolved } : comment,
				),
			);
		},
	};
}
