import React from "react";
import {
  LuGitCompare,
  LuMessageSquare,
  LuPalette,
  LuPanelRight,
  LuPencil,
  LuSpellCheck,
} from "react-icons/lu";
import { cn } from "../../utils";
import { ic, ics, pill } from "./toolbar-constants";

/* ── Design ────────────────────────────────────────────── */

export interface DesignSectionProps {
  canEdit: boolean;
  onToggleThemeGallery: () => void;
  isThemeGalleryOpen: boolean;
  onToggleThemeEditor: () => void;
  isThemeEditorOpen: boolean;
}

export function DesignSection(p: DesignSectionProps): React.ReactElement {
  return (
    <>
      <button
        onClick={p.onToggleThemeGallery}
        disabled={!p.canEdit}
        className={cn(
          pill,
          p.isThemeGalleryOpen
            ? "bg-primary hover:bg-primary/80 text-primary-foreground"
            : "",
        )}
        title="Browse and apply built-in themes"
      >
        <LuPalette className={ics} />
        Browse Themes
      </button>
      <button
        onClick={p.onToggleThemeEditor}
        disabled={!p.canEdit}
        className={cn(
          pill,
          p.isThemeEditorOpen
            ? "bg-primary hover:bg-primary/80 text-primary-foreground"
            : "",
        )}
        title="Edit presentation theme colors and fonts"
      >
        <LuPencil className={ics} />
        Edit Theme
      </button>
    </>
  );
}

/* ── Transitions ───────────────────────────────────────── */

export interface TransitionsSectionProps {
  isInspectorPaneOpen: boolean;
  onToggleInspector: () => void;
}

export function TransitionsSection(
  p: TransitionsSectionProps,
): React.ReactElement {
  return (
    <>
      <span className="text-xs text-muted-foreground px-2">
        Configure transitions in the Inspector panel (Slide tab).
      </span>
      <button
        type="button"
        onClick={p.onToggleInspector}
        className={cn(
          pill,
          p.isInspectorPaneOpen
            ? "bg-primary hover:bg-primary/80 text-primary-foreground"
            : "",
        )}
        title="Open Inspector to edit transitions"
      >
        <LuPanelRight className={ic} />
        Inspector
      </button>
    </>
  );
}

/* ── Review ────────────────────────────────────────────── */

export interface ReviewSectionProps {
  canEdit: boolean;
  spellCheckEnabled: boolean;
  onSetSpellCheckEnabled: (enabled: boolean) => void;
  onToggleComments?: () => void;
  isCommentsPanelOpen?: boolean;
  slideCommentCount?: number;
  onCompare?: () => void;
}

export function ReviewSection(p: ReviewSectionProps): React.ReactElement {
  return (
    <>
      {p.onToggleComments && (
        <button
          onClick={p.onToggleComments}
          className={cn(
            pill,
            p.isCommentsPanelOpen
              ? "bg-primary hover:bg-primary/80 text-primary-foreground"
              : "",
          )}
          title="Toggle comments panel"
        >
          <LuMessageSquare className={ic} />
          Comments
          {(p.slideCommentCount ?? 0) > 0 && (
            <span className="inline-flex items-center justify-center min-w-[16px] h-4 rounded-full bg-amber-500 text-[10px] font-medium text-white px-1">
              {p.slideCommentCount}
            </span>
          )}
        </button>
      )}
      <button
        onClick={() => p.onSetSpellCheckEnabled(!p.spellCheckEnabled)}
        className={cn(
          pill,
          p.spellCheckEnabled
            ? "bg-primary hover:bg-primary/80 text-primary-foreground"
            : "",
        )}
        title="Toggle spell check"
      >
        <LuSpellCheck className={ic} />
        Spelling
      </button>
      {p.onCompare && (
        <button
          onClick={p.onCompare}
          disabled={!p.canEdit}
          className={pill}
          title="Compare with another presentation"
        >
          <LuGitCompare className={ic} />
          Compare
        </button>
      )}
    </>
  );
}
