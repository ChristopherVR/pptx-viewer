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
} from "pptx-viewer-core";
import { formatCommentTimestamp, getElementLabel } from "../../utils";

// ---------------------------------------------------------------------------
// Props for CommentsTab
// ---------------------------------------------------------------------------

/**
 * Props for the {@link CommentsTab} component.
 * Defines all state and callbacks needed for comment CRUD, editing, replying, and element selection.
 */
export interface CommentsTabProps {
  /** All presentation slides (used to look up the active slide). */
  slides: PptxSlide[];
  /** Index of the currently active slide. */
  activeSlideIndex: number;
  /** Currently selected element, used to anchor new comments. */
  selectedElement: PptxElement | null;
  /** Whether comment editing is permitted. */
  canEdit: boolean;
  /** Whether spellcheck is enabled for comment text areas. */
  spellCheckEnabled: boolean;
  /** Draft text for new comments, keyed by slide ID. */
  commentDraftBySlideId: Record<string, string>;
  /** ID of the comment currently being edited, keyed by slide ID. */
  editingCommentIdBySlideId: Record<string, string | null>;
  /** Draft text for comment edits, keyed by comment ID. */
  commentEditDraftByCommentId: Record<string, string>;
  /** Toggle the resolved status of a comment. */
  onToggleCommentResolved: (commentId: string) => void;
  /** Delete a comment by ID. */
  onDeleteComment: (commentId: string) => void;
  /** Enter edit mode for a specific comment. */
  onStartCommentEdit: (commentId: string) => void;
  /** Save the edited text for a specific comment. */
  onSaveCommentEdit: (commentId: string) => void;
  /** Cancel editing a specific comment. */
  onCancelCommentEdit: (commentId: string) => void;
  /** Start replying to a specific comment. */
  onReplyToComment: (commentId: string) => void;
  /** Update the new-comment draft text for the active slide. */
  onCommentDraftChange: (text: string) => void;
  /** Submit the new comment draft. */
  onAddComment: () => void;
  /** Update the edit draft text for a specific comment. */
  onEditDraftChange: (commentId: string, text: string) => void;
  /** Set the single selected element by ID (or null to deselect). */
  setSelectedElementId: (id: string | null) => void;
  /** Set multiple selected element IDs. */
  setSelectedElementIds: (ids: string[]) => void;
}

// ---------------------------------------------------------------------------
// Sub-component: single comment item
// ---------------------------------------------------------------------------

/**
 * Props for a single comment row in the comments tab.
 */
interface CommentItemProps {
  /** The comment data to display. */
  comment: PptxComment;
  /** Whether this comment is in edit mode. */
  isEditing: boolean;
  /** Current draft text if editing. */
  editDraft: string;
  /** Whether editing actions are available. */
  canEdit: boolean;
  /** Whether spellcheck is enabled for the edit textarea. */
  spellCheckEnabled: boolean;
  /** The slide containing this comment (used to resolve element references). */
  activeSlide: PptxSlide;
  /** Toggle the resolved status of this comment. */
  onToggleCommentResolved: (commentId: string) => void;
  /** Delete this comment. */
  onDeleteComment: (commentId: string) => void;
  /** Enter edit mode for this comment. */
  onStartCommentEdit: (commentId: string) => void;
  /** Save the edited comment text. */
  onSaveCommentEdit: (commentId: string) => void;
  /** Cancel editing and revert changes. */
  onCancelCommentEdit: (commentId: string) => void;
  /** Start a reply to this comment. */
  onReplyToComment: (commentId: string) => void;
  /** Update the edit draft text for this comment. */
  onEditDraftChange: (commentId: string, text: string) => void;
  /** Select an element by ID on the canvas. */
  setSelectedElementId: (id: string | null) => void;
  /** Set multiple selected element IDs on the canvas. */
  setSelectedElementIds: (ids: string[]) => void;
}

/**
 * Renders a single comment item with author, timestamp, text, and action buttons.
 *
 * Supports inline editing mode with save/cancel buttons, element anchor badges
 * that select the referenced element on click, and action buttons for edit,
 * reply, resolve/unresolve, and delete operations.
 *
 * @param props - {@link CommentItemProps}
 * @returns A comment card with contextual controls.
 */
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
