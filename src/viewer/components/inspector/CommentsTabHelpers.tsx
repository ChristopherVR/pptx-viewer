import React from "react";

import {
  LuCheck,
  LuMessageSquare,
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
} from "../../../core";
import { formatCommentTimestamp, getElementLabel } from "../../utils";

// ---------------------------------------------------------------------------
// Props for CommentsTab
// ---------------------------------------------------------------------------

export interface CommentsTabProps {
  slides: PptxSlide[];
  activeSlideIndex: number;
  selectedElement: PptxElement | null;
  canEdit: boolean;
  spellCheckEnabled: boolean;
  commentDraftBySlideId: Record<string, string>;
  editingCommentIdBySlideId: Record<string, string | null>;
  commentEditDraftByCommentId: Record<string, string>;
  onToggleCommentResolved: (commentId: string) => void;
  onDeleteComment: (commentId: string) => void;
  onStartCommentEdit: (commentId: string) => void;
  onSaveCommentEdit: (commentId: string) => void;
  onCancelCommentEdit: (commentId: string) => void;
  onReplyToComment: (commentId: string) => void;
  onCommentDraftChange: (text: string) => void;
  onAddComment: () => void;
  onEditDraftChange: (commentId: string, text: string) => void;
  setSelectedElementId: (id: string | null) => void;
  setSelectedElementIds: (ids: string[]) => void;
}

// ---------------------------------------------------------------------------
// Sub-component: single comment item
// ---------------------------------------------------------------------------

interface CommentItemProps {
  comment: PptxComment;
  isEditing: boolean;
  editDraft: string;
  canEdit: boolean;
  spellCheckEnabled: boolean;
  activeSlide: PptxSlide;
  onToggleCommentResolved: (commentId: string) => void;
  onDeleteComment: (commentId: string) => void;
  onStartCommentEdit: (commentId: string) => void;
  onSaveCommentEdit: (commentId: string) => void;
  onCancelCommentEdit: (commentId: string) => void;
  onReplyToComment: (commentId: string) => void;
  onEditDraftChange: (commentId: string, text: string) => void;
  setSelectedElementId: (id: string | null) => void;
  setSelectedElementIds: (ids: string[]) => void;
}

export function CommentItem({
  comment,
  isEditing,
  editDraft,
  canEdit,
  spellCheckEnabled,
  activeSlide,
  onToggleCommentResolved,
  onDeleteComment,
  onStartCommentEdit,
  onSaveCommentEdit,
  onCancelCommentEdit,
  onReplyToComment,
  onEditDraftChange,
  setSelectedElementId,
  setSelectedElementIds,
}: CommentItemProps): React.ReactElement {
  return (
    <div className="rounded border border-border bg-card p-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[11px] font-medium text-foreground truncate">
            {comment.author || "Author"}
          </span>
          {comment.resolved && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-green-900/40 px-1.5 py-0.5 text-[9px] font-medium text-green-300 flex-shrink-0">
              <LuCheck className="h-2.5 w-2.5" />
              Resolved
            </span>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground flex-shrink-0">
          {formatCommentTimestamp(comment.createdAt)}
        </span>
      </div>
      {comment.elementId &&
        (() => {
          const targetEl = activeSlide?.elements?.find(
            (el) => el.id === comment.elementId,
          );
          return targetEl ? (
            <button
              type="button"
              className="mt-1 inline-flex items-center gap-1 rounded bg-primary/20 px-1.5 py-0.5 text-[10px] text-primary hover:bg-primary/30 transition-colors"
              title="Click to select element"
              onClick={() => {
                setSelectedElementId(targetEl.id);
                setSelectedElementIds([targetEl.id]);
              }}
            >
              <LuType className="h-2.5 w-2.5" />
              {getElementLabel(targetEl)}
            </button>
          ) : (
            <span className="mt-1 inline-flex items-center gap-1 rounded bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
              Deleted element
            </span>
          );
        })()}

      {isEditing ? (
        <div className="mt-1.5 space-y-1.5">
          <textarea
            value={editDraft}
            spellCheck={spellCheckEnabled}
            onChange={(event) => {
              onEditDraftChange(comment.id, event.target.value);
            }}
            rows={3}
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary resize-y"
          />
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded bg-primary px-2 py-1 text-[11px] text-primary-foreground hover:bg-primary/80 disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={() => onSaveCommentEdit(comment.id)}
              disabled={String(editDraft).trim().length === 0}
            >
              Save
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded bg-muted px-2 py-1 text-[11px] text-foreground hover:bg-accent"
              onClick={() => onCancelCommentEdit(comment.id)}
            >
              Cancel
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
                onClick={() => onStartCommentEdit(comment.id)}
                title="Edit"
              >
                <LuPencil className="h-3 w-3" />
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center p-1.5 border-l border-border hover:bg-accent text-foreground hover:text-foreground transition-colors"
                onClick={() => onReplyToComment(comment.id)}
                title="Reply"
              >
                <LuReply className="h-3 w-3" />
              </button>
              <button
                type="button"
                className={cn(
                  "inline-flex items-center justify-center p-1.5 border-l border-border transition-colors",
                  comment.resolved
                    ? "bg-green-900/40 text-green-300 hover:bg-green-900/60"
                    : "hover:bg-accent text-foreground hover:text-foreground",
                )}
                onClick={() => onToggleCommentResolved(comment.id)}
                title={comment.resolved ? "Unresolve" : "Resolve"}
              >
                <LuCheck className="h-3 w-3" />
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center p-1.5 border-l border-border hover:bg-red-900/40 text-muted-foreground hover:text-red-300 transition-colors"
                onClick={() => onDeleteComment(comment.id)}
                title="Delete"
              >
                <LuTrash2 className="h-3 w-3" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: add-comment form
// ---------------------------------------------------------------------------

interface AddCommentFormProps {
  draft: string;
  spellCheckEnabled: boolean;
  selectedElement: PptxElement | null;
  onDraftChange: (text: string) => void;
  onAdd: () => void;
}

export function AddCommentForm({
  draft,
  spellCheckEnabled,
  selectedElement,
  onDraftChange,
  onAdd,
}: AddCommentFormProps): React.ReactElement {
  return (
    <div className="space-y-1.5">
      {selectedElement && (
        <div className="inline-flex items-center gap-1 rounded bg-primary/20 px-1.5 py-0.5 text-[10px] text-primary">
          <LuType className="h-2.5 w-2.5" />
          Commenting on: {getElementLabel(selectedElement)}
        </div>
      )}
      <textarea
        value={draft}
        spellCheck={spellCheckEnabled}
        onChange={(event) => onDraftChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            onAdd();
          }
        }}
        rows={3}
        placeholder={
          selectedElement
            ? `Comment on ${getElementLabel(selectedElement)}...`
            : "Add a comment..."
        }
        className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary resize-y"
      />
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded bg-primary px-2 py-1 text-[11px] text-primary-foreground hover:bg-primary/80 disabled:opacity-40 disabled:cursor-not-allowed"
        onClick={() => onAdd()}
        disabled={String(draft).trim().length === 0}
      >
        <LuMessageSquare className="w-3.5 h-3.5" />
        Add comment
      </button>
    </div>
  );
}
