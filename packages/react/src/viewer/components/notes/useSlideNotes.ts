import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { PptxSlide, TextSegment } from "pptx-viewer-core";
import {
  DEBOUNCE_MS,
  MAX_INDENT_LEVEL,
  createPlainNotesSegments,
  getCurrentParagraphIndex,
  normalizeSegments,
  paragraphsToSegments,
  segmentsToParagraphs,
  segmentsToPlainText,
} from "./notes-utils";
import type { NotesParagraph } from "./notes-utils";
import {
  parseSegmentsFromRichEditor,
  segmentsToEditorHtml,
} from "./notes-html";

interface UseSlideNotesOptions {
  activeSlide: PptxSlide | undefined;
  isExpanded: boolean;
  canEdit: boolean;
  onToggle: () => void;
  onUpdateNotes: (text: string, segments?: TextSegment[]) => void;
}

export function useSlideNotes({
  activeSlide,
  isExpanded,
  canEdit,
  onToggle,
  onUpdateNotes,
}: UseSlideNotesOptions) {
  const initialSegments = useMemo(
    () =>
      activeSlide?.notesSegments && activeSlide.notesSegments.length > 0
        ? normalizeSegments(activeSlide.notesSegments)
        : createPlainNotesSegments(activeSlide?.notes ?? ""),
    [activeSlide?.id, activeSlide?.notes, activeSlide?.notesSegments],
  );

  const [draft, setDraft] = useState(activeSlide?.notes ?? "");
  const [draftSegments, setDraftSegments] =
    useState<TextSegment[]>(initialSegments);
  const [isRichEditEnabled, setIsRichEditEnabled] = useState<boolean>(
    initialSegments.length > 0,
  );
  const [showLinkPopover, setShowLinkPopover] = useState(false);
  const [showPrintDialog, setShowPrintDialog] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const richEditorRef = useRef<HTMLDivElement>(null);
  const savedSelectionRef = useRef<{ text: string } | null>(null);

  useEffect(() => {
    const nextText = activeSlide?.notes ?? "";
    const nextSegments =
      activeSlide?.notesSegments && activeSlide.notesSegments.length > 0
        ? normalizeSegments(activeSlide.notesSegments)
        : createPlainNotesSegments(nextText);
    setDraft(nextText);
    setDraftSegments(nextSegments);
    setIsRichEditEnabled(nextSegments.length > 0);
  }, [activeSlide?.id, activeSlide?.notes, activeSlide?.notesSegments]);

  useEffect(() => {
    if (!isRichEditEnabled || !isExpanded || !canEdit || !richEditorRef.current)
      return;
    richEditorRef.current.innerHTML = segmentsToEditorHtml(draftSegments);
  }, [canEdit, draftSegments, isExpanded, isRichEditEnabled]);

  const flush = useCallback(
    (value: string, segments?: TextSegment[]) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      onUpdateNotes(value, segments);
    },
    [onUpdateNotes],
  );

  const scheduleSave = useCallback(
    (value: string, segments?: TextSegment[]) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onUpdateNotes(value, segments);
        debounceRef.current = null;
      }, DEBOUNCE_MS);
    },
    [onUpdateNotes],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handlePlainChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      const segments = createPlainNotesSegments(value);
      setDraft(value);
      setDraftSegments(segments);
      scheduleSave(value, segments);
    },
    [scheduleSave],
  );

  const handleKeyDownPlain = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      e.stopPropagation();
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        flush(draft, draftSegments);
        onToggle();
      }
    },
    [draft, draftSegments, flush, onToggle],
  );

  const handleRichInput = useCallback(() => {
    if (!richEditorRef.current) return;
    const segments = parseSegmentsFromRichEditor(richEditorRef.current);
    const text = segmentsToPlainText(segments);
    setDraft(text);
    setDraftSegments(segments);
    scheduleSave(text, segments);
  }, [scheduleSave]);

  const handleBlur = useCallback(() => {
    flush(draft, draftSegments);
  }, [draft, draftSegments, flush]);

  const updateParagraphProperty = useCallback(
    (updater: (para: NotesParagraph, idx: number) => NotesParagraph) => {
      if (!richEditorRef.current) return;
      const paraIdx = getCurrentParagraphIndex(
        richEditorRef.current,
        draftSegments,
      );
      const paragraphs = segmentsToParagraphs(draftSegments);
      if (paraIdx >= 0 && paraIdx < paragraphs.length) {
        paragraphs[paraIdx] = updater(paragraphs[paraIdx], paraIdx);
      }
      const newSegments = paragraphsToSegments(paragraphs);
      const newText = segmentsToPlainText(newSegments);
      setDraft(newText);
      setDraftSegments(newSegments);
      scheduleSave(newText, newSegments);
    },
    [draftSegments, scheduleSave],
  );

  const applyRichCommand = useCallback(
    (command: "bold" | "italic" | "underline" | "strikeThrough") => {
      document.execCommand(command);
      handleRichInput();
      richEditorRef.current?.focus();
    },
    [handleRichInput],
  );

  const toggleBulletList = useCallback(() => {
    updateParagraphProperty((para) => ({
      ...para,
      bulletType: para.bulletType === "bullet" ? "none" : "bullet",
    }));
    richEditorRef.current?.focus();
  }, [updateParagraphProperty]);

  const toggleNumberedList = useCallback(() => {
    updateParagraphProperty((para) => ({
      ...para,
      bulletType: para.bulletType === "numbered" ? "none" : "numbered",
    }));
    richEditorRef.current?.focus();
  }, [updateParagraphProperty]);

  const handleIndent = useCallback(() => {
    updateParagraphProperty((para) => ({
      ...para,
      indentLevel: Math.min(MAX_INDENT_LEVEL, para.indentLevel + 1),
    }));
    richEditorRef.current?.focus();
  }, [updateParagraphProperty]);

  const handleOutdent = useCallback(() => {
    updateParagraphProperty((para) => ({
      ...para,
      indentLevel: Math.max(0, para.indentLevel - 1),
    }));
    richEditorRef.current?.focus();
  }, [updateParagraphProperty]);

  const handleKeyDownRich = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      e.stopPropagation();
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        flush(draft, draftSegments);
        onToggle();
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        if (e.shiftKey) handleOutdent();
        else handleIndent();
      }
    },
    [draft, draftSegments, flush, onToggle, handleIndent, handleOutdent],
  );

  const handleLinkButtonClick = useCallback(() => {
    const sel = window.getSelection();
    savedSelectionRef.current = { text: sel?.toString() ?? "" };
    setShowLinkPopover(true);
  }, []);

  const handleInsertLink = useCallback(
    (url: string, displayText: string) => {
      setShowLinkPopover(false);
      if (!richEditorRef.current) return;
      richEditorRef.current.focus();
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.textContent = displayText;
        anchor.style.color = "#4a9eff";
        anchor.style.textDecoration = "underline";
        anchor.style.cursor = "pointer";
        anchor.setAttribute("data-hyperlink", url);
        range.insertNode(anchor);
        range.setStartAfter(anchor);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
      handleRichInput();
    },
    [handleRichInput],
  );

  const handleEditorClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target;
      if (!(target instanceof HTMLAnchorElement)) return;
      const href =
        target.getAttribute("data-hyperlink") || target.getAttribute("href");
      if (href && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        window.open(href, "_blank");
      }
    },
    [],
  );

  return {
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
  } as const;
}
