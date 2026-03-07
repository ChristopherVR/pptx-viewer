import React from "react";
import { useTranslation } from "react-i18next";
import { LuMessageSquare, LuType } from "react-icons/lu";

import { cn } from "../../utils";
import type {
  PptxComment,
  PptxElement,
  PptxSlide,
} from "../../../core";
import { getElementLabel } from "../../utils";
import { InspectorCommentRow } from "./InspectorCommentRow";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface InspectorCommentsSectionProps {
  comments: PptxComment[];
  canEdit: boolean;
  activeSlide: PptxSlide | undefined;
  selectedElement: PptxElement | null;
  editingCommentId: string | null;
  commentEditDraft: string;
  commentDraft: string;
  replyingToCommentId: string | null;
  replyDraftByCommentId: Record<string, string>;
  onSetCommentDraft: (draft: string) => void;
  onAddComment: () => void;
  onDeleteComment: (id: string) => void;
  onStartEditComment: (id: string) => void;
  onSaveEditComment: (id: string) => void;
  onCancelEditComment: () => void;
  onSetCommentEditDraft: (draft: string) => void;
  onToggleCommentResolved?: (id: string) => void;
  onStartReply?: (id: string) => void;
  onCancelReply?: () => void;
  onReplyDraftChange?: (commentId: string, draft: string) => void;
  onSubmitReply?: (commentId: string) => void;
  onSelectElement: (id: string | null) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InspectorCommentsSection({
  comments,
  canEdit,
  activeSlide,
  selectedElement,
  editingCommentId,
  commentEditDraft,
  commentDraft,
  replyingToCommentId,
  replyDraftByCommentId,
  onSetCommentDraft,
  onAddComment,
  onDeleteComment,
  onStartEditComment,
  onSaveEditComment,
  onCancelEditComment,
  onSetCommentEditDraft,
  onToggleCommentResolved,
  onStartReply,
  onCancelReply,
  onReplyDraftChange,
  onSubmitReply,
  onSelectElement,
}: InspectorCommentsSectionProps): React.ReactElement {
  const { t } = useTranslation();
  const HEADING_CLS =
    "text-[11px] uppercase tracking-wide text-muted-foreground";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className={HEADING_CLS}>{t("pptx.comments.slideComments")}</div>
        <div className="text-[11px] text-muted-foreground">
          {comments.length}
        </div>
      </div>

      {comments.length === 0 ? (
        <div className="text-xs text-muted-foreground">
          {t("pptx.comments.noComments")}
        </div>
      ) : (
        <div className="space-y-2 max-h-[42vh] overflow-y-auto pr-1">
          {comments.map((c, idx) => (
            <InspectorCommentRow
              key={`${c.id}-${idx}`}
              comment={c}
              canEdit={canEdit}
              activeSlide={activeSlide}
              editingCommentId={editingCommentId}
              commentEditDraft={commentEditDraft}
              replyingToCommentId={replyingToCommentId}
              replyDraftByCommentId={replyDraftByCommentId}
              onStartEditComment={onStartEditComment}
              onSaveEditComment={onSaveEditComment}
              onCancelEditComment={onCancelEditComment}
              onSetCommentEditDraft={onSetCommentEditDraft}
              onDeleteComment={onDeleteComment}
              onToggleCommentResolved={onToggleCommentResolved}
              onStartReply={onStartReply}
              onCancelReply={onCancelReply}
              onReplyDraftChange={onReplyDraftChange}
              onSubmitReply={onSubmitReply}
              onSelectElement={onSelectElement}
            />
          ))}
        </div>
      )}

      {/* Add comment form */}
      {canEdit && (
        <div className="space-y-1.5 pt-1 border-t border-border">
          {selectedElement && (
            <div className="inline-flex items-center gap-1 rounded bg-primary/20 px-1.5 py-0.5 text-[10px] text-primary">
              <LuType className="h-2.5 w-2.5" />
              {t("pptx.comments.commentingOn", {
                element: getElementLabel(selectedElement),
              })}
            </div>
          )}
          <textarea
            rows={2}
            placeholder={
              selectedElement
                ? t("pptx.comments.addOnElement", {
                    element: getElementLabel(selectedElement),
                  })
                : t("pptx.comments.addPlaceholder")
            }
            value={commentDraft}
            className="w-full bg-muted border border-border rounded px-2 py-1 text-xs resize-y outline-none focus:border-primary"
            onChange={(e) => onSetCommentDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                onAddComment();
              }
            }}
          />
          <button
            type="button"
            onClick={onAddComment}
            disabled={!commentDraft.trim()}
            className={cn(
              "w-full inline-flex items-center justify-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors",
              commentDraft.trim()
                ? "bg-primary hover:bg-primary/80 text-white"
                : "bg-muted text-muted-foreground cursor-not-allowed",
            )}
          >
            <LuMessageSquare className="w-3.5 h-3.5" />
            {t("pptx.comments.addComment")}
          </button>
        </div>
      )}
    </div>
  );
}
