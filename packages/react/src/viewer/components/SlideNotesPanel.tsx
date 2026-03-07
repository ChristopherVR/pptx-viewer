import React from "react";
import { useTranslation } from "react-i18next";

import { LuChevronDown, LuChevronUp, LuStickyNote } from "react-icons/lu";

import type { PptxSlide, TextSegment } from "pptx-viewer-core";
import { EXPANDED_MAX_HEIGHT } from "./notes/notes-utils";
import { renderRichNotesSegments } from "./notes/notes-html";
import { NotesPrintDialog } from "./notes/NotesPrintDialog";
import { NotesToolbar } from "./notes/NotesToolbar";
import { useSlideNotes } from "./notes/useSlideNotes";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface SlideNotesPanelProps {
  activeSlide: PptxSlide | undefined;
  /** All slides — needed for print view. */
  allSlides?: PptxSlide[];
  isExpanded: boolean;
  canEdit: boolean;
  onToggle: () => void;
  onUpdateNotes: (text: string, segments?: TextSegment[]) => void;
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export const SlideNotesPanel: React.FC<SlideNotesPanelProps> = ({
  activeSlide,
  allSlides,
  isExpanded,
  canEdit,
  onToggle,
  onUpdateNotes,
}) => {
  const { t } = useTranslation();

  const {
    draft,
    draftSegments,
    isRichEditEnabled,
    setIsRichEditEnabled,
    showLinkPopover,
    setShowLinkPopover,
    showPrintDialog,
    setShowPrintDialog,
    textareaRef,
    richEditorRef,
    savedSelectionRef,
    handlePlainChange,
    handleRichInput,
    handleBlur,
    handleKeyDownPlain,
    handleKeyDownRich,
    applyRichCommand,
    toggleBulletList,
    toggleNumberedList,
    handleIndent,
    handleOutdent,
    handleLinkButtonClick,
    handleInsertLink,
    handleEditorClick,
  } = useSlideNotes({
    activeSlide,
    isExpanded,
    canEdit,
    onToggle,
    onUpdateNotes,
  });

  const hasNotes = draft.trim().length > 0;
  const slideLabel = activeSlide
    ? t("pptx.notes.slideN", { n: activeSlide.slideNumber })
    : t("pptx.notes.noSlide");

  return (
    <div className="flex flex-col border-t border-border/60 bg-background/80 select-none">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors w-full text-left shrink-0"
        aria-expanded={isExpanded}
        aria-controls="slide-notes-content"
      >
        <LuStickyNote className="w-3.5 h-3.5 shrink-0" />
        <span className="font-medium tracking-wide uppercase">
          {t("pptx.notes.title")}
        </span>
        {!isExpanded && hasNotes && (
          <span className="ml-1 truncate max-w-[240px] text-muted-foreground font-normal normal-case">
            - {draft.trim().split("\n")[0]}
          </span>
        )}
        <span className="ml-auto shrink-0">
          {isExpanded ? (
            <LuChevronDown className="w-3.5 h-3.5" />
          ) : (
            <LuChevronUp className="w-3.5 h-3.5" />
          )}
        </span>
      </button>

      {isExpanded && (
        <div
          id="slide-notes-content"
          className="px-3 pb-2"
          style={{ maxHeight: EXPANDED_MAX_HEIGHT + 40 }}
        >
          <div className="text-[10px] text-muted-foreground mb-1">
            {slideLabel}
          </div>

          {canEdit ? (
            <>
              <NotesToolbar
                isRichEditEnabled={isRichEditEnabled}
                showLinkPopover={showLinkPopover}
                savedSelectionText={savedSelectionRef.current?.text ?? ""}
                hasAllSlides={!!allSlides && allSlides.length > 0}
                onApplyRichCommand={applyRichCommand}
                onToggleBulletList={toggleBulletList}
                onToggleNumberedList={toggleNumberedList}
                onIndent={handleIndent}
                onOutdent={handleOutdent}
                onLinkButtonClick={handleLinkButtonClick}
                onInsertLink={handleInsertLink}
                onCloseLinkPopover={() => setShowLinkPopover(false)}
                onPrintClick={() => setShowPrintDialog(true)}
                onToggleRichEdit={() => setIsRichEditEnabled((prev) => !prev)}
              />

              {isRichEditEnabled ? (
                <div
                  ref={richEditorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={handleRichInput}
                  onBlur={handleBlur}
                  onKeyDown={handleKeyDownRich}
                  onClick={handleEditorClick}
                  className="w-full overflow-y-auto rounded-md border border-border/50 bg-muted/60 px-2.5 py-1.5 text-xs text-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors whitespace-pre-wrap"
                  style={{ maxHeight: EXPANDED_MAX_HEIGHT - 8, minHeight: 72 }}
                />
              ) : (
                <textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={handlePlainChange}
                  onBlur={handleBlur}
                  onKeyDown={handleKeyDownPlain}
                  placeholder={t("pptx.notes.clickToAddNotes")}
                  rows={4}
                  className="w-full resize-none rounded-md border border-border/50 bg-muted/60 px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors"
                  style={{ maxHeight: EXPANDED_MAX_HEIGHT - 8 }}
                />
              )}
            </>
          ) : (
            <div
              className="w-full rounded-md border border-border/30 bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground overflow-y-auto whitespace-pre-wrap"
              style={{ maxHeight: EXPANDED_MAX_HEIGHT - 32, minHeight: 60 }}
            >
              {hasNotes ? (
                renderRichNotesSegments(draftSegments)
              ) : (
                <span className="italic text-muted-foreground">
                  {t("pptx.notes.noNotes")}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {showPrintDialog && allSlides && (
        <NotesPrintDialog
          slides={allSlides}
          onClose={() => setShowPrintDialog(false)}
        />
      )}
    </div>
  );
};
