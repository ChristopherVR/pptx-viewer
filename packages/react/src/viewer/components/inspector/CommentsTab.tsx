import React from "react";

import type { PptxSlide } from "pptx-viewer-core";
import { CommentItem, AddCommentForm } from "./CommentsTabHelpers";
import type { CommentsTabProps } from "./CommentsTabHelpers";

export type { CommentsTabProps };

/**
 * Comments tab panel for viewing and managing slide-level comments.
 *
 * Displays all comments on the active slide in a scrollable list, with support
 * for editing, replying, resolving, and deleting individual comments. When editing
 * is enabled, an "Add comment" form is shown at the bottom, optionally anchored
 * to the currently selected element.
 *
 * Shows an empty-state message when no slide is selected or no comments exist.
 *
 * @param props - {@link CommentsTabProps}
 * @returns The comments tab panel.
 */
export function CommentsTab({
  slides,
  activeSlideIndex,
  selectedElement,
  canEdit,
  spellCheckEnabled,
  commentDraftBySlideId,
  editingCommentIdBySlideId,
  commentEditDraftByCommentId,
  onToggleCommentResolved,
  onDeleteComment,
  onStartCommentEdit,
  onSaveCommentEdit,
  onCancelCommentEdit,
  onReplyToComment,
  onCommentDraftChange,
  onAddComment,
  onEditDraftChange,
  setSelectedElementId,
  setSelectedElementIds,
}: CommentsTabProps): React.ReactElement {
  const activeSlide = slides[activeSlideIndex] as PptxSlide | undefined;

  if (!activeSlide) {
    return (
      <div className="text-xs text-muted-foreground">
        Select a slide to view comments.
      </div>
    );
  }

  return (
    <div className="space-y-3 text-xs">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          Slide Comments
        </div>
        <div className="text-[11px] text-muted-foreground">
          {activeSlide.comments?.length || 0}
        </div>
      </div>

      {(activeSlide.comments || []).length === 0 ? (
        <div className="text-xs text-muted-foreground">
          No comments on this slide yet.
        </div>
      ) : (
        <div className="space-y-2 max-h-[42vh] overflow-y-auto pr-1">
          {(activeSlide.comments || []).map((comment, index) => (
            <CommentItem
              key={`${activeSlide.id}-sidebar-comment-${comment.id}-${index}`}
              comment={comment}
              isEditing={
                editingCommentIdBySlideId[activeSlide.id] === comment.id
              }
              editDraft={commentEditDraftByCommentId[comment.id] || ""}
              canEdit={canEdit}
              spellCheckEnabled={spellCheckEnabled}
              activeSlide={activeSlide}
              onToggleCommentResolved={onToggleCommentResolved}
              onDeleteComment={onDeleteComment}
              onStartCommentEdit={onStartCommentEdit}
              onSaveCommentEdit={onSaveCommentEdit}
              onCancelCommentEdit={onCancelCommentEdit}
              onReplyToComment={onReplyToComment}
              onEditDraftChange={onEditDraftChange}
              setSelectedElementId={setSelectedElementId}
              setSelectedElementIds={setSelectedElementIds}
            />
          ))}
        </div>
      )}

      {canEdit && (
        <AddCommentForm
          draft={commentDraftBySlideId[activeSlide.id] || ""}
          spellCheckEnabled={spellCheckEnabled}
          selectedElement={selectedElement}
          onDraftChange={onCommentDraftChange}
          onAdd={onAddComment}
        />
      )}
    </div>
  );
}
