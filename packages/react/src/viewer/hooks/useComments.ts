import { useState, useCallback, useEffect } from "react";

import type { PptxComment } from "pptx-viewer-core";
import {
  generateCommentId,
  addCommentToSlide,
  removeCommentFromSlide,
  editCommentInSlide,
  toggleResolvedInSlide,
  pruneSlideDrafts,
} from "./useComments-helpers";
import type {
  UseCommentsInput,
  UseCommentsResult,
} from "./useComments-helpers";

// Re-export types so consumers importing from this module still work.
export type { UseCommentsInput, UseCommentsResult };

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useComments({
  slides,
  canEdit,
  userName = "You",
  selectedElementId,
  onUpdateSlides,
  onMarkDirty,
}: UseCommentsInput): UseCommentsResult {
  // -- State ---------------------------------------------------------------

  const [commentDraftBySlideId, setCommentDraftBySlideId] = useState<
    Record<string, string>
  >({});
  const [editingCommentIdBySlideId, setEditingCommentIdBySlideId] = useState<
    Record<string, string | null>
  >({});
  const [commentEditDraftByCommentId, setCommentEditDraftByCommentId] =
    useState<Record<string, string>>({});
  const [replyDraftByCommentId, setReplyDraftByCommentId] = useState<
    Record<string, string>
  >({});
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(
    null,
  );

  // -- Draft management ----------------------------------------------------

  const handleCommentDraftChange = useCallback(
    (slideId: string, draft: string) => {
      setCommentDraftBySlideId((prev) => ({ ...prev, [slideId]: draft }));
    },
    [],
  );

  const handleSetCommentEditDraft = useCallback(
    (commentId: string, draft: string) => {
      setCommentEditDraftByCommentId((prev) => ({
        ...prev,
        [commentId]: draft,
      }));
    },
    [],
  );

  // -- Add -----------------------------------------------------------------

  const handleAddSlideComment = useCallback(
    (slideIndex: number) => {
      if (!canEdit) return;
      const slide = slides[slideIndex];
      if (!slide) return;

      const draft = String(commentDraftBySlideId[slide.id] || "").trim();
      if (draft.length === 0) return;

      const newComment: PptxComment = {
        id: generateCommentId(),
        text: draft,
        author: userName,
        createdAt: new Date().toISOString(),
        elementId: selectedElementId ?? undefined,
      };

      onUpdateSlides((prev) => addCommentToSlide(prev, slideIndex, newComment));

      setCommentDraftBySlideId((prev) => ({
        ...prev,
        [slide.id]: "",
      }));

      onMarkDirty();
    },
    [
      canEdit,
      commentDraftBySlideId,
      onMarkDirty,
      onUpdateSlides,
      selectedElementId,
      slides,
      userName,
    ],
  );

  // -- Delete --------------------------------------------------------------

  const handleDeleteSlideComment = useCallback(
    (slideIndex: number, commentId: string) => {
      if (!canEdit) return;
      const slide = slides[slideIndex];
      if (!slide) return;

      let didDelete = false;
      onUpdateSlides((prev) => {
        const result = removeCommentFromSlide(prev, slideIndex, commentId);
        didDelete = result.didDelete;
        return result.slides;
      });

      if (!didDelete) return;
      setEditingCommentIdBySlideId((prev) => ({
        ...prev,
        [slide.id]: null,
      }));
      onMarkDirty();
    },
    [canEdit, onMarkDirty, onUpdateSlides, slides],
  );

  // -- Edit lifecycle ------------------------------------------------------

  const handleStartCommentEdit = useCallback(
    (slideId: string, commentId: string) => {
      const slide = slides.find((s) => s.id === slideId);
      if (!slide) return;
      const comment = (slide.comments || []).find((c) => c.id === commentId);
      if (!comment) return;

      setEditingCommentIdBySlideId((prev) => ({
        ...prev,
        [slideId]: commentId,
      }));
      setCommentEditDraftByCommentId((prev) => ({
        ...prev,
        [commentId]: comment.text || "",
      }));
    },
    [slides],
  );

  const handleCancelCommentEdit = useCallback((slideId: string) => {
    setEditingCommentIdBySlideId((prev) => ({
      ...prev,
      [slideId]: null,
    }));
  }, []);

  const handleSaveCommentEdit = useCallback(
    (slideIndex: number, commentId: string) => {
      if (!canEdit) return;
      const slide = slides[slideIndex];
      if (!slide) return;

      const draft = String(commentEditDraftByCommentId[commentId] || "").trim();
      if (draft.length === 0) return;

      let didUpdate = false;
      onUpdateSlides((prev) => {
        const result = editCommentInSlide(prev, slideIndex, commentId, draft);
        didUpdate = result.didUpdate;
        return result.slides;
      });

      if (!didUpdate) return;
      setEditingCommentIdBySlideId((prev) => ({
        ...prev,
        [slide.id]: null,
      }));
      onMarkDirty();
    },
    [canEdit, commentEditDraftByCommentId, onMarkDirty, onUpdateSlides, slides],
  );

  // -- Toggle resolved -----------------------------------------------------

  const handleToggleCommentResolved = useCallback(
    (slideIndex: number, commentId: string) => {
      if (!canEdit) return;
      const slide = slides[slideIndex];
      if (!slide) return;

      let didUpdate = false;
      onUpdateSlides((prev) => {
        const result = toggleResolvedInSlide(prev, slideIndex, commentId);
        didUpdate = result.didUpdate;
        return result.slides;
      });

      if (didUpdate) {
        onMarkDirty();
      }
    },
    [canEdit, onMarkDirty, onUpdateSlides, slides],
  );

  // -- Reply ---------------------------------------------------------------

  const handleStartReply = useCallback(
    (_slideIndex: number, commentId: string) => {
      setReplyingToCommentId(commentId);
      setReplyDraftByCommentId((prev) => ({ ...prev, [commentId]: "" }));
    },
    [],
  );

  const handleCancelReply = useCallback(() => {
    setReplyingToCommentId(null);
  }, []);

  const handleReplyDraftChange = useCallback(
    (commentId: string, draft: string) => {
      setReplyDraftByCommentId((prev) => ({ ...prev, [commentId]: draft }));
    },
    [],
  );

  const handleSubmitReply = useCallback(
    (slideIndex: number, commentId: string) => {
      if (!canEdit) return;
      const slide = slides[slideIndex];
      if (!slide) return;

      const parentComment = (slide.comments || []).find(
        (c) => c.id === commentId,
      );
      if (!parentComment) return;

      const replyText = String(replyDraftByCommentId[commentId] || "").trim();
      if (replyText.length === 0) return;

      const replyComment: PptxComment = {
        id: generateCommentId(),
        text: replyText,
        author: userName,
        createdAt: new Date().toISOString(),
        threadId: commentId,
        elementId: parentComment.elementId,
      };

      // Add reply as a nested reply inside the parent comment
      onUpdateSlides((prev) =>
        prev.map((entry, index) => {
          if (index !== slideIndex) return entry;
          const updatedComments = (entry.comments || []).map((c) => {
            if (c.id !== commentId) return c;
            return {
              ...c,
              replies: [...(c.replies || []), replyComment],
            };
          });
          return { ...entry, comments: updatedComments };
        }),
      );

      setReplyingToCommentId(null);
      setReplyDraftByCommentId((prev) => {
        const next = { ...prev };
        delete next[commentId];
        return next;
      });
      onMarkDirty();
    },
    [
      canEdit,
      onMarkDirty,
      onUpdateSlides,
      replyDraftByCommentId,
      slides,
      userName,
    ],
  );

  // -- Cleanup effect: prune drafts for deleted slides ---------------------

  useEffect(() => {
    const slideIds = new Set(slides.map((slide) => slide.id));
    setCommentDraftBySlideId((prev) => {
      const pruned = pruneSlideDrafts(prev, slideIds);
      return pruned ?? prev;
    });
  }, [slides]);

  // -- Return --------------------------------------------------------------

  return {
    commentDraftBySlideId,
    editingCommentIdBySlideId,
    commentEditDraftByCommentId,
    replyingToCommentId,
    replyDraftByCommentId,
    handleCommentDraftChange,
    handleAddSlideComment,
    handleDeleteSlideComment,
    handleStartCommentEdit,
    handleCancelCommentEdit,
    handleSaveCommentEdit,
    handleSetCommentEditDraft,
    handleToggleCommentResolved,
    handleStartReply,
    handleCancelReply,
    handleReplyDraftChange,
    handleSubmitReply,
  };
}
