import { useState, useCallback, useEffect } from "react";

import type { PptxSlide, PptxElement } from "../../core";
import { hasTextProperties } from "../../core";

interface FindResult {
  slideIndex: number;
  elementId: string;
  segmentIndex: number;
  startOffset: number;
  length: number;
}

interface UseFindReplaceInput {
  slides: PptxSlide[];
  mode: string;
  onSetActiveSlideIndex: (index: number) => void;
  onSetSelectedElementId: (id: string | null) => void;
  onUpdateSlides: (updater: (slides: PptxSlide[]) => PptxSlide[]) => void;
  onMarkDirty: () => void;
}

interface UseFindReplaceResult {
  findReplaceOpen: boolean;
  setFindReplaceOpen: (open: boolean) => void;
  findQuery: string;
  setFindQuery: (query: string) => void;
  replaceQuery: string;
  setReplaceQuery: (query: string) => void;
  findMatchCase: boolean;
  setFindMatchCase: (matchCase: boolean) => void;
  findResults: FindResult[];
  findResultIndex: number;
  performFind: () => void;
  navigateFindResult: (direction: 1 | -1) => void;
  handleReplace: () => void;
  handleReplaceAll: () => void;
}

export function useFindReplace({
  slides,
  mode,
  onSetActiveSlideIndex,
  onSetSelectedElementId,
  onUpdateSlides,
  onMarkDirty,
}: UseFindReplaceInput): UseFindReplaceResult {
  const [findReplaceOpen, setFindReplaceOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [replaceQuery, setReplaceQuery] = useState("");
  const [findMatchCase, setFindMatchCase] = useState(false);
  const [findResults, setFindResults] = useState<FindResult[]>([]);
  const [findResultIndex, setFindResultIndex] = useState(-1);

  // ── Search ────────────────────────────────────────────────────────────
  const performFind = useCallback(() => {
    if (!findQuery) {
      setFindResults([]);
      setFindResultIndex(-1);
      return;
    }

    const results: FindResult[] = [];
    const normalised = findMatchCase ? findQuery : findQuery.toLowerCase();

    slides.forEach((slide, slideIndex) => {
      for (const element of slide.elements || []) {
        if (!hasTextProperties(element)) continue;
        const segments = element.textSegments ?? [];
        segments.forEach((seg, segIndex) => {
          const text = findMatchCase
            ? seg.text
            : (seg.text || "").toLowerCase();
          let offset = 0;
          while (offset < text.length) {
            const pos = text.indexOf(normalised, offset);
            if (pos === -1) break;
            results.push({
              slideIndex,
              elementId: element.id,
              segmentIndex: segIndex,
              startOffset: pos,
              length: findQuery.length,
            });
            offset = pos + 1;
          }
        });
      }
    });

    setFindResults(results);
    setFindResultIndex(results.length > 0 ? 0 : -1);

    // Navigate to first match
    if (results.length > 0) {
      onSetActiveSlideIndex(results[0].slideIndex);
      onSetSelectedElementId(results[0].elementId);
    }
  }, [
    slides,
    findQuery,
    findMatchCase,
    onSetActiveSlideIndex,
    onSetSelectedElementId,
  ]);

  // ── Navigate results ──────────────────────────────────────────────────
  const navigateFindResult = useCallback(
    (direction: 1 | -1) => {
      if (findResults.length === 0) return;
      const nextIdx =
        (findResultIndex + direction + findResults.length) % findResults.length;
      setFindResultIndex(nextIdx);
      const match = findResults[nextIdx];
      if (match) {
        onSetActiveSlideIndex(match.slideIndex);
        onSetSelectedElementId(match.elementId);
      }
    },
    [
      findResults,
      findResultIndex,
      onSetActiveSlideIndex,
      onSetSelectedElementId,
    ],
  );

  // ── Replace helpers ───────────────────────────────────────────────────
  const applyReplacements = useCallback(
    (toReplace: FindResult[]) => {
      if (toReplace.length === 0) return;

      onUpdateSlides((prevSlides) => {
        const nextSlides = [...prevSlides];

        // Group replacements by slide + element + segment
        const grouped = new Map<string, FindResult[]>();
        for (const match of toReplace) {
          const key = `${match.slideIndex}::${match.elementId}::${match.segmentIndex}`;
          if (!grouped.has(key)) grouped.set(key, []);
          grouped.get(key)!.push(match);
        }

        for (const [, matches] of grouped) {
          // Sort by startOffset descending so replacements don't shift indexes
          const sorted = [...matches].sort(
            (a, b) => b.startOffset - a.startOffset,
          );
          for (const match of sorted) {
            const slide = nextSlides[match.slideIndex];
            if (!slide) continue;
            const elIdx = (slide.elements || []).findIndex(
              (e) => e.id === match.elementId,
            );
            if (elIdx === -1) continue;
            const element = slide.elements[elIdx];
            if (!hasTextProperties(element)) continue;

            const segments = [...(element.textSegments ?? [])];
            const seg = segments[match.segmentIndex];
            if (!seg) continue;

            const before = seg.text.slice(0, match.startOffset);
            const after = seg.text.slice(match.startOffset + match.length);
            segments[match.segmentIndex] = {
              ...seg,
              text: before + replaceQuery + after,
            };

            const nextElements = [...slide.elements];
            nextElements[elIdx] = {
              ...element,
              text: segments.map((s) => s.text).join(""),
              textSegments: segments,
            } as PptxElement;
            nextSlides[match.slideIndex] = {
              ...slide,
              elements: nextElements,
            };
          }
        }
        return nextSlides;
      });

      onMarkDirty();
    },
    [replaceQuery, onUpdateSlides, onMarkDirty],
  );

  // ── Replace current match ─────────────────────────────────────────────
  const handleReplace = useCallback(() => {
    if (findResults.length === 0 || findResultIndex < 0) return;
    applyReplacements([findResults[findResultIndex]]);
    // Re-run search after replace to refresh results
    setTimeout(performFind, 0);
  }, [findResults, findResultIndex, applyReplacements, performFind]);

  // ── Replace all ───────────────────────────────────────────────────────
  const handleReplaceAll = useCallback(() => {
    if (findResults.length === 0) return;
    applyReplacements(findResults);
    // Re-run search after replace to refresh results
    setTimeout(performFind, 0);
  }, [findResults, applyReplacements, performFind]);

  // ── Keyboard shortcut: Ctrl/Cmd+F toggles find bar (edit mode only) ──
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "f") {
        if (mode !== "edit") return;
        event.preventDefault();
        setFindReplaceOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mode]);

  return {
    findReplaceOpen,
    setFindReplaceOpen,
    findQuery,
    setFindQuery,
    replaceQuery,
    setReplaceQuery,
    findMatchCase,
    setFindMatchCase,
    findResults,
    findResultIndex,
    performFind,
    navigateFindResult,
    handleReplace,
    handleReplaceAll,
  };
}
