import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LuCheck,
  LuChevronDown,
  LuChevronRight,
  LuPencil,
  LuReply,
  LuTrash2,
  LuType,
} from "react-icons/lu";

import { cn } from "../../utils";
import type {
  PptxComment,
  PptxElement,
  PptxSlide,
} from "pptx-viewer-core";
import { formatCommentTimestamp, getElementLabel } from "../../utils";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface InspectorCommentRowProps {
  comment: PptxComment;
  canEdit: boolean;
  activeSlide: PptxSlide | undefined;
  editingCommentId: string | null;
  commentEditDraft: string;
  replyingToCommentId: string | null;
  replyDraftByCommentId: Record<string, string>;
  onStartEditComment: (id: string) => void;
  onSaveEditComment: (id: string) => void;
  onCancelEditComment: () => void;
  onSetCommentEditDraft: (draft: string) => void;
  onDeleteComment: (id: string) => void;
  onToggleCommentResolved?: (id: string) => void;
  onStartReply?: (id: string) => void;
  onCancelReply?: () => void;
  onReplyDraftChange?: (commentId: string, draft: string) => void;
  onSubmitReply?: (commentId: string) => void;
  onSelectElement: (id: string | null) => void;
  depth?: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InspectorCommentRow({
  comment,
  canEdit,
  activeSlide,
  editingCommentId,
  commentEditDraft,
  replyingToCommentId,
  replyDraftByCommentId,
  onStartEditComment,
  onSaveEditComment,
  onCancelEditComment,
  onSetCommentEditDraft,
  onDeleteComment,
  onToggleCommentResolved,
  onStartReply,
  onCancelReply,
  onReplyDraftChange,
  onSubmitReply,
  onSelectElement,
  depth = 0,
}: InspectorCommentRowProps): React.ReactElement {
  const { t } = useTranslation();
  const isEditing = editingCommentId === comment.id;
  const isReplying = replyingToCommentId === comment.id;
  const replyDraft = replyDraftByCommentId[comment.id] ?? "";
  const [showReplies, setShowReplies] = useState(true);
  const replies = comment.replies ?? [];

  const targetElement: PptxElement | null = comment.elementId
    ? (activeSlide?.elements?.find((el) => el.id === comment.elementId) ?? null)
    : null;

  return (
    <div
      className={cn(
        "rounded border border-border bg-card p-2",
        depth > 0 && "ml-3 border-l-2 border-l-primary/40",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[11px] font-medium text-foreground truncate">
            {comment.author || "Author"}
          </span>
          {comment.resolved && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-green-900/40 px-1.5 py-0.5 text-[9px] font-medium text-green-300 flex-shrink-0">
              <LuCheck className="h-2.5 w-2.5" />
              {t("pptx.comments.resolved")}
            </span>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground flex-shrink-0">
          {formatCommentTimestamp(comment.createdAt)}
        </span>
      </div>

      {/* Element anchor badge */}
      {comment.elementId &&
        (targetElement ? (
          <button
            type="button"
            className="mt-1 inline-flex items-center gap-1 rounded bg-primary/20 px-1.5 py-0.5 text-[10px] text-primary hover:bg-primary/30 transition-colors"
            title={t("pptx.comments.commentingOn", {
              element: getElementLabel(targetElement),
            })}
            onClick={() => onSelectElement(targetElement.id)}
          >
            <LuType className="h-2.5 w-2.5" />
            {getElementLabel(targetElement)}
          </button>
        ) : (
          <span className="mt-1 inline-flex items-center gap-1 rounded bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {t("pptx.comments.deletedElement")}
          </span>
        ))}

      {/* Body */}
      {isEditing ? (
        <div className="mt-1.5 space-y-1.5">
          <textarea
            value={commentEditDraft}
            onChange={(e) => onSetCommentEditDraft(e.target.value)}
            rows={3}
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary resize-y"
          />
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded bg-primary px-2 py-1 text-[11px] text-primary-foreground hover:bg-primary/80 disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={() => onSaveEditComment(comment.id)}
              disabled={String(commentEditDraft).trim().length === 0}
            >
              {t("pptx.comments.save")}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded bg-muted px-2 py-1 text-[11px] text-foreground hover:bg-accent"
              onClick={onCancelEditComment}
            >
              {t("pptx.comments.cancel")}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-1 whitespace-pre-wrap break-words text-[11px] text-foreground">
            {comment.text}
          </div>
          {canEdit && (
            <div className="mt-1.5 inline-flex items-center rounded bg-muted overflow-hidden">
              <button
                type="button"
                className="inline-flex items-center justify-center p-1.5 hover:bg-accent text-foreground hover:text-foreground transition-colors"
                onClick={() => onStartEditComment(comment.id)}
                title={t("pptx.comments.edit")}
              >
                <LuPencil className="h-3 w-3" />
              </button>
              {onStartReply && depth === 0 && (
                <button
                  type="button"
                  className="inline-flex items-center justify-center p-1.5 border-l border-border hover:bg-accent text-foreground hover:text-foreground transition-colors"
                  onClick={() => onStartReply(comment.id)}
                  title={t("pptx.comments.reply")}
                >
                  <LuReply className="h-3 w-3" />
                </button>
              )}
              {onToggleCommentResolved && (
                <button
                  type="button"
                  className={cn(
                    "inline-flex items-center justify-center p-1.5 border-l border-border transition-colors",
                    comment.resolved
                      ? "bg-green-900/40 text-green-300 hover:bg-green-900/60"
                      : "hover:bg-accent text-foreground hover:text-foreground",
                  )}
                  onClick={() => onToggleCommentResolved(comment.id)}
                  title={
                    comment.resolved
                      ? t("pptx.comments.unresolve")
                      : t("pptx.comments.resolve")
                  }
                >
                  <LuCheck className="h-3 w-3" />
                </button>
              )}
              <button
                type="button"
                className="inline-flex items-center justify-center p-1.5 border-l border-border hover:bg-red-900/40 text-muted-foreground hover:text-red-300 transition-colors"
                onClick={() => onDeleteComment(comment.id)}
                title={t("pptx.comments.delete")}
              >
                <LuTrash2 className="h-3 w-3" />
              </button>
            </div>
          )}
        </>
      )}

      {/* Threaded replies */}
      {replies.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setShowReplies((p) => !p)}
          >
            {showReplies ? (
              <LuChevronDown className="h-3 w-3" />
            ) : (
              <LuChevronRight className="h-3 w-3" />
            )}
            {t("pptx.comments.repliesCount", { count: replies.length })}
          </button>
          {showReplies && (
            <div className="mt-1.5 space-y-1.5">
              {replies.map((reply, ri) => (
                <InspectorCommentRow
                  key={`${reply.id}-${ri}`}
                  comment={reply}
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
                  depth={depth + 1}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Inline reply form */}
      {isReplying && onCancelReply && onReplyDraftChange && onSubmitReply && (
        <div className="mt-2 space-y-1.5 pl-3 border-l-2 border-l-primary/40">
          <textarea
            value={replyDraft}
            onChange={(e) => onReplyDraftChange(comment.id, e.target.value)}
            rows={2}
            placeholder={t("pptx.comments.replyPlaceholder", {
              author: comment.author || "Author",
            })}
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary resize-y"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                onSubmitReply(comment.id);
              }
            }}
          />
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded bg-primary px-2 py-1 text-[11px] text-primary-foreground hover:bg-primary/80 disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={() => onSubmitReply(comment.id)}
              disabled={replyDraft.trim().length === 0}
            >
              <LuReply className="h-3 w-3" />
              {t("pptx.comments.addReply")}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded bg-muted px-2 py-1 text-[11px] text-foreground hover:bg-accent"
              onClick={onCancelReply}
            >
              {t("pptx.comments.cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
