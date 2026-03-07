import React from "react";
import { useTranslation } from "react-i18next";

import {
  LuBold,
  LuIndentDecrease,
  LuIndentIncrease,
  LuItalic,
  LuLink,
  LuList,
  LuListOrdered,
  LuPrinter,
  LuStrikethrough,
  LuUnderline,
} from "react-icons/lu";

import { HyperlinkPopover } from "./HyperlinkPopover";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface NotesToolbarProps {
  isRichEditEnabled: boolean;
  showLinkPopover: boolean;
  savedSelectionText: string;
  hasAllSlides: boolean;
  onApplyRichCommand: (
    command: "bold" | "italic" | "underline" | "strikeThrough",
  ) => void;
  onToggleBulletList: () => void;
  onToggleNumberedList: () => void;
  onIndent: () => void;
  onOutdent: () => void;
  onLinkButtonClick: () => void;
  onInsertLink: (url: string, displayText: string) => void;
  onCloseLinkPopover: () => void;
  onPrintClick: () => void;
  onToggleRichEdit: () => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function NotesToolbar({
  isRichEditEnabled,
  showLinkPopover,
  savedSelectionText,
  hasAllSlides,
  onApplyRichCommand,
  onToggleBulletList,
  onToggleNumberedList,
  onIndent,
  onOutdent,
  onLinkButtonClick,
  onInsertLink,
  onCloseLinkPopover,
  onPrintClick,
  onToggleRichEdit,
}: NotesToolbarProps): React.ReactElement {
  const { t } = useTranslation();

  return (
    <div className="mb-1 flex items-center justify-between gap-2">
      <div className="inline-flex items-center rounded bg-muted text-xs overflow-hidden border border-border/60 relative">
        {/* Text formatting */}
        <button
          type="button"
          className="px-2 py-1 hover:bg-accent"
          title={t("pptx.notes.bold")}
          onClick={() => onApplyRichCommand("bold")}
        >
          <LuBold className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          className="px-2 py-1 hover:bg-accent border-l border-border/60"
          title={t("pptx.notes.italic")}
          onClick={() => onApplyRichCommand("italic")}
        >
          <LuItalic className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          className="px-2 py-1 hover:bg-accent border-l border-border/60"
          title={t("pptx.notes.underline")}
          onClick={() => onApplyRichCommand("underline")}
        >
          <LuUnderline className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          className="px-2 py-1 hover:bg-accent border-l border-border/60"
          title={t("pptx.notes.strikethrough")}
          onClick={() => onApplyRichCommand("strikeThrough")}
        >
          <LuStrikethrough className="w-3.5 h-3.5" />
        </button>

        {/* Separator */}
        <div className="w-px h-4 bg-border mx-0.5" />

        {/* Bullet list */}
        <button
          type="button"
          className="px-2 py-1 hover:bg-accent"
          title={t("pptx.notes.bulletList")}
          onClick={onToggleBulletList}
        >
          <LuList className="w-3.5 h-3.5" />
        </button>
        {/* Numbered list */}
        <button
          type="button"
          className="px-2 py-1 hover:bg-accent border-l border-border/60"
          title={t("pptx.notes.numberedList")}
          onClick={onToggleNumberedList}
        >
          <LuListOrdered className="w-3.5 h-3.5" />
        </button>

        {/* Separator */}
        <div className="w-px h-4 bg-border mx-0.5" />

        {/* Indent / Outdent */}
        <button
          type="button"
          className="px-2 py-1 hover:bg-accent"
          title={t("pptx.notes.indent")}
          onClick={onIndent}
        >
          <LuIndentIncrease className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          className="px-2 py-1 hover:bg-accent border-l border-border/60"
          title={t("pptx.notes.outdent")}
          onClick={onOutdent}
        >
          <LuIndentDecrease className="w-3.5 h-3.5" />
        </button>

        {/* Separator */}
        <div className="w-px h-4 bg-border mx-0.5" />

        {/* Link */}
        <button
          type="button"
          className="px-2 py-1 hover:bg-accent"
          title={t("pptx.notes.insertLink")}
          onClick={onLinkButtonClick}
        >
          <LuLink className="w-3.5 h-3.5" />
        </button>

        {/* Print */}
        {hasAllSlides && (
          <button
            type="button"
            className="px-2 py-1 hover:bg-accent border-l border-border/60"
            title={t("pptx.notes.printNotes")}
            onClick={onPrintClick}
          >
            <LuPrinter className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Link popover */}
        {showLinkPopover && (
          <HyperlinkPopover
            initialText={savedSelectionText}
            onInsert={onInsertLink}
            onClose={onCloseLinkPopover}
          />
        )}
      </div>
      <button
        type="button"
        className="text-[10px] px-2 py-1 rounded bg-muted hover:bg-accent border border-border/60"
        onClick={onToggleRichEdit}
        title={t("pptx.notes.toggleRichPlainEditor")}
      >
        {isRichEditEnabled
          ? t("pptx.notes.plainEditor")
          : t("pptx.notes.richEditor")}
      </button>
    </div>
  );
}
