import type { PptxComment, PptxSlide } from "../../core";

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
  return `comment-${crypto.randomUUID()}`;
}

// ---------------------------------------------------------------------------
// Slide-comment mutation helpers (pure, immutable)
// ---------------------------------------------------------------------------

/** Insert a comment into a specific slide. */
export function addCommentToSlide(
  slides: PptxSlide[],
  slideIndex: number,
  comment: PptxComment,
): PptxSlide[] {
  return slides.map((entry, index) =>
    index === slideIndex
      ? { ...entry, comments: [...(entry.comments || []), comment] }
      : entry,
  );
}

/**
 * Remove a comment from a specific slide.
 * Returns the updated array and a flag indicating whether a deletion occurred.
 */
export function removeCommentFromSlide(
  slides: PptxSlide[],
  slideIndex: number,
  commentId: string,
): { slides: PptxSlide[]; didDelete: boolean } {
  let didDelete = false;
  const updated = slides.map((entry, index) => {
    if (index !== slideIndex) return entry;
    const existing = entry.comments || [];
    const next = existing.filter((c) => {
      const keep = c.id !== commentId;
      if (!keep) didDelete = true;
      return keep;
    });
    return next.length === existing.length
      ? entry
      : { ...entry, comments: next };
  });
  return { slides: updated, didDelete };
}

/**
 * Update the text of a comment on a specific slide.
 * Returns the updated array and a flag indicating whether an update occurred.
 */
export function editCommentInSlide(
  slides: PptxSlide[],
  slideIndex: number,
  commentId: string,
  newText: string,
): { slides: PptxSlide[]; didUpdate: boolean } {
  let didUpdate = false;
  const updated = slides.map((entry, index) => {
    if (index !== slideIndex) return entry;
    const next = (entry.comments || []).map((c) => {
      if (c.id !== commentId) return c;
      didUpdate = true;
      return { ...c, text: newText };
    });
    return didUpdate ? { ...entry, comments: next } : entry;
  });
  return { slides: updated, didUpdate };
}

/**
 * Toggle the `resolved` flag on a comment.
 * Returns the updated array and a flag indicating whether an update occurred.
 */
export function toggleResolvedInSlide(
  slides: PptxSlide[],
  slideIndex: number,
  commentId: string,
): { slides: PptxSlide[]; didUpdate: boolean } {
  let didUpdate = false;
  const updated = slides.map((entry, index) => {
    if (index !== slideIndex) return entry;
    const next = (entry.comments || []).map((c) => {
      if (c.id !== commentId) return c;
      didUpdate = true;
      return { ...c, resolved: !c.resolved };
    });
    return didUpdate ? { ...entry, comments: next } : entry;
  });
  return { slides: updated, didUpdate };
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
