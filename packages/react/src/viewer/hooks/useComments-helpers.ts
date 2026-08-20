/* oxlint-disable eslint/one-var -- pervasive pre-existing pattern in this file
   (each wrapper is a short sequence of independent `const`s); merging them
   isn't a style choice here. */
import type { PptxComment, PptxSlide } from 'pptx-viewer-core';
// The comment-array mutations themselves are pure and shared with every
// other binding; these helpers only add the slide-indexing wrapper the full
// `PptxSlide[]` deck array needs on top of them.
import {
	addCommentToList,
	editCommentInList,
	generateCommentId as sharedGenerateCommentId,
	removeCommentFromList,
	replyToCommentInList,
	toggleCommentResolvedInList,
} from 'pptx-viewer-shared';

// ---------------------------------------------------------------------------
// Input / output interfaces
// ---------------------------------------------------------------------------

export interface UseCommentsInput {
	slides: PptxSlide[];
	activeSlideIndex: number;
	canEdit: boolean;
	userName?: string;
	selectedElementId?: string | null;
	onUpdateSlides: (updater: (slides: PptxSlide[]) => PptxSlide[]) => void;
	onMarkDirty: () => void;
}

export interface UseCommentsResult {
	commentDraftBySlideId: Record<string, string>;
	editingCommentIdBySlideId: Record<string, string | null>;
	commentEditDraftByCommentId: Record<string, string>;
	replyingToCommentId: string | null;
	replyDraftByCommentId: Record<string, string>;
	handleCommentDraftChange: (slideId: string, draft: string) => void;
	handleAddSlideComment: (slideIndex: number) => void;
	handleDeleteSlideComment: (slideIndex: number, commentId: string) => void;
	handleStartCommentEdit: (slideId: string, commentId: string) => void;
	handleCancelCommentEdit: (slideId: string) => void;
	handleSaveCommentEdit: (slideIndex: number, commentId: string) => void;
	handleSetCommentEditDraft: (commentId: string, draft: string) => void;
	handleToggleCommentResolved: (slideIndex: number, commentId: string) => void;
	handleStartReply: (slideIndex: number, commentId: string) => void;
	handleCancelReply: () => void;
	handleReplyDraftChange: (commentId: string, draft: string) => void;
	handleSubmitReply: (slideIndex: number, commentId: string) => void;
}

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

export function generateCommentId(): string {
	return sharedGenerateCommentId();
}

// ---------------------------------------------------------------------------
// Slide-indexing wrapper
// ---------------------------------------------------------------------------

/**
 * Write a new comment array back onto slide `slideIndex`, leaving every
 * other slide untouched (mirrors Svelte's `ReviewCommentsPanel.replaceComments`).
 */
function replaceCommentsOnSlide(
	slides: PptxSlide[],
	slideIndex: number,
	next: PptxComment[],
): PptxSlide[] {
	return slides.map((entry, index) =>
		index === slideIndex ? { ...entry, comments: next } : entry,
	);
}

// ---------------------------------------------------------------------------
// Slide-comment mutation helpers
//
// The actual mutations are the pure, framework-agnostic transforms in
// `pptx-viewer-shared` (`render/comments-list.ts`); these wrappers only
// thread them through the full `PptxSlide[]` deck array by index.
// ---------------------------------------------------------------------------

/**
 * Append a new comment to a specific slide.
 * Returns the updated array and a flag indicating whether an insertion occurred.
 */
export function addCommentToSlide(
	slides: PptxSlide[],
	slideIndex: number,
	text: string,
	authorName: string,
	elementId?: string,
): { slides: PptxSlide[]; didAdd: boolean } {
	const slide = slides[slideIndex];
	if (!slide) {
		return { slides, didAdd: false };
	}
	const next = addCommentToList(
		slide.comments || [],
		text,
		authorName,
		undefined,
		undefined,
		elementId,
	);
	if (!next) {
		return { slides, didAdd: false };
	}
	return { slides: replaceCommentsOnSlide(slides, slideIndex, next), didAdd: true };
}

/**
 * Remove a comment from a specific slide (any depth: top-level or nested reply).
 * Returns the updated array and a flag indicating whether a deletion occurred.
 */
export function removeCommentFromSlide(
	slides: PptxSlide[],
	slideIndex: number,
	commentId: string,
): { slides: PptxSlide[]; didDelete: boolean } {
	const slide = slides[slideIndex];
	if (!slide) {
		return { slides, didDelete: false };
	}
	const next = removeCommentFromList(slide.comments || [], commentId);
	if (!next) {
		return { slides, didDelete: false };
	}
	return { slides: replaceCommentsOnSlide(slides, slideIndex, next), didDelete: true };
}

/**
 * Update the text of a comment on a specific slide (any depth: top-level or nested reply).
 * Returns the updated array and a flag indicating whether an update occurred.
 */
export function editCommentInSlide(
	slides: PptxSlide[],
	slideIndex: number,
	commentId: string,
	newText: string,
): { slides: PptxSlide[]; didUpdate: boolean } {
	const slide = slides[slideIndex];
	if (!slide) {
		return { slides, didUpdate: false };
	}
	const next = editCommentInList(slide.comments || [], commentId, newText);
	if (!next) {
		return { slides, didUpdate: false };
	}
	return { slides: replaceCommentsOnSlide(slides, slideIndex, next), didUpdate: true };
}

/**
 * Toggle the `resolved` flag on a comment (any depth: top-level or nested reply).
 * Returns the updated array and a flag indicating whether an update occurred.
 */
export function toggleResolvedInSlide(
	slides: PptxSlide[],
	slideIndex: number,
	commentId: string,
): { slides: PptxSlide[]; didUpdate: boolean } {
	const slide = slides[slideIndex];
	if (!slide) {
		return { slides, didUpdate: false };
	}
	const next = toggleCommentResolvedInList(slide.comments || [], commentId);
	if (!next) {
		return { slides, didUpdate: false };
	}
	return { slides: replaceCommentsOnSlide(slides, slideIndex, next), didUpdate: true };
}

/**
 * Append a threaded reply under `parentId` on a specific slide.
 * Returns the updated array and a flag indicating whether an insertion occurred.
 */
export function addReplyToSlide(
	slides: PptxSlide[],
	slideIndex: number,
	parentId: string,
	text: string,
	authorName: string,
): { slides: PptxSlide[]; didAdd: boolean } {
	const slide = slides[slideIndex];
	if (!slide) {
		return { slides, didAdd: false };
	}
	const next = replyToCommentInList(slide.comments || [], parentId, text, authorName);
	if (!next) {
		return { slides, didAdd: false };
	}
	return { slides: replaceCommentsOnSlide(slides, slideIndex, next), didAdd: true };
}

/**
 * Prune draft entries whose slide IDs no longer exist.
 * Returns the pruned map, or `null` when no change is needed.
 */
export function pruneSlideDrafts(
	drafts: Record<string, string>,
	slideIds: Set<string>,
): Record<string, string> | null {
	const next: Record<string, string> = {};
	let changed = false;

	for (const [id, draft] of Object.entries(drafts)) {
		if (!slideIds.has(id)) {
			changed = true;
			continue;
		}
		next[id] = draft;
	}

	return changed ? next : null;
}
