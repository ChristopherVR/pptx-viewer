/**
 * useSectionOperations — CRUD operations for slide sections.
 */
import { useCallback } from "react";

import type { PptxSection, PptxSlide } from "../../core";

/* ------------------------------------------------------------------ */
/*  Input / Output types                                              */
/* ------------------------------------------------------------------ */

export interface UseSectionOperationsInput {
  sections: PptxSection[];
  setSections: React.Dispatch<React.SetStateAction<PptxSection[]>>;
  slides: PptxSlide[];
  setSlides: React.Dispatch<React.SetStateAction<PptxSlide[]>>;
  markDirty: () => void;
}

export interface SectionOperations {
  addSection: (name: string, afterSlideIndex: number) => void;
  renameSection: (sectionId: string, newName: string) => void;
  deleteSection: (sectionId: string) => void;
  moveSectionUp: (sectionId: string) => void;
  moveSectionDown: (sectionId: string) => void;
  moveSlidesToSection: (
    slideIndexes: number[],
    targetSectionId: string,
  ) => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function generateSectionId(): string {
  // Generate a GUID-like id that matches typical OOXML section ids
  const hex = () =>
    Math.floor(Math.random() * 0x10000)
      .toString(16)
      .padStart(4, "0");
  return `{${hex()}${hex()}-${hex()}-${hex()}-${hex()}-${hex()}${hex()}${hex()}}`;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                              */
/* ------------------------------------------------------------------ */

export function useSectionOperations(
  input: UseSectionOperationsInput,
): SectionOperations {
  const { sections, setSections, slides, setSlides, markDirty } = input;

  const addSection = useCallback(
    (name: string, afterSlideIndex: number) => {
      const newId = generateSectionId();

      // Assign the slide at afterSlideIndex (and all following slides that
      // share the same current section) to the new section.
      const slideAtIndex = slides[afterSlideIndex];
      const currentSectionId = slideAtIndex?.sectionId;

      // The new section claims slides starting from afterSlideIndex onward
      // that belong to the same section, until the next different section.
      const claimedSlideIndexes: number[] = [];
      for (let i = afterSlideIndex; i < slides.length; i++) {
        if (i === afterSlideIndex || slides[i].sectionId === currentSectionId) {
          claimedSlideIndexes.push(i);
        } else {
          break;
        }
      }

      // Update slides' sectionId
      setSlides((prev) =>
        prev.map((s, i) =>
          claimedSlideIndexes.includes(i)
            ? { ...s, sectionId: newId, sectionName: name }
            : s,
        ),
      );

      // Insert the new section into the sections list after the current section
      setSections((prev) => {
        const insertIndex = currentSectionId
          ? prev.findIndex((sec) => sec.id === currentSectionId) + 1
          : prev.length;

        // Collect slide IDs that belong to the new section
        const newSectionSlideIds = claimedSlideIndexes.map((i) => {
          const slide = slides[i];
          // Use the OOXML slide ID which is stored on the rawXml
          const rawXml = slide?.rawXml as Record<string, unknown> | undefined;
          const cSld = rawXml?.["p:sld"] as Record<string, unknown> | undefined;
          return String(cSld?.["@_id"] || slide?.slideNumber || i + 1);
        });

        // Remove claimed slide IDs from the old section
        const updated = prev.map((sec) => {
          if (sec.id === currentSectionId) {
            return {
              ...sec,
              slideIds: sec.slideIds.filter(
                (sid) => !newSectionSlideIds.includes(sid),
              ),
            };
          }
          return sec;
        });

        const newSection: PptxSection = {
          id: newId,
          name,
          slideIds: newSectionSlideIds,
        };

        const result = [...updated];
        result.splice(insertIndex, 0, newSection);
        return result;
      });

      markDirty();
    },
    [slides, setSlides, setSections, markDirty],
  );

  const renameSection = useCallback(
    (sectionId: string, newName: string) => {
      setSections((prev) =>
        prev.map((sec) =>
          sec.id === sectionId ? { ...sec, name: newName } : sec,
        ),
      );

      // Also update sectionName on slides
      setSlides((prev) =>
        prev.map((s) =>
          s.sectionId === sectionId ? { ...s, sectionName: newName } : s,
        ),
      );

      markDirty();
    },
    [setSections, setSlides, markDirty],
  );

  const deleteSection = useCallback(
    (sectionId: string) => {
      setSections((prev) => {
        const idx = prev.findIndex((sec) => sec.id === sectionId);
        if (idx === -1) return prev;

        const deletedSection = prev[idx];
        const prevSection = idx > 0 ? prev[idx - 1] : undefined;

        // Move slide IDs to the previous section (or just remove section boundary)
        const updated = prev.filter((sec) => sec.id !== sectionId);
        if (prevSection && deletedSection) {
          return updated.map((sec) =>
            sec.id === prevSection.id
              ? {
                  ...sec,
                  slideIds: [...sec.slideIds, ...deletedSection.slideIds],
                }
              : sec,
          );
        }

        return updated;
      });

      // Update slides: move to previous section or clear sectionId
      const sectionIdx = sections.findIndex((sec) => sec.id === sectionId);
      const prevSection = sectionIdx > 0 ? sections[sectionIdx - 1] : undefined;

      setSlides((prev) =>
        prev.map((s) => {
          if (s.sectionId !== sectionId) return s;
          if (prevSection) {
            return {
              ...s,
              sectionId: prevSection.id,
              sectionName: prevSection.name,
            };
          }
          return { ...s, sectionId: undefined, sectionName: undefined };
        }),
      );

      markDirty();
    },
    [sections, setSections, setSlides, markDirty],
  );

  const moveSectionUp = useCallback(
    (sectionId: string) => {
      setSections((prev) => {
        const idx = prev.findIndex((sec) => sec.id === sectionId);
        if (idx <= 0) return prev;
        const next = [...prev];
        [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
        return next;
      });
      markDirty();
    },
    [setSections, markDirty],
  );

  const moveSectionDown = useCallback(
    (sectionId: string) => {
      setSections((prev) => {
        const idx = prev.findIndex((sec) => sec.id === sectionId);
        if (idx === -1 || idx >= prev.length - 1) return prev;
        const next = [...prev];
        [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
        return next;
      });
      markDirty();
    },
    [setSections, markDirty],
  );

  const moveSlidesToSection = useCallback(
    (slideIndexes: number[], targetSectionId: string) => {
      const targetSection = sections.find((sec) => sec.id === targetSectionId);
      if (!targetSection) return;

      setSlides((prev) =>
        prev.map((s, i) =>
          slideIndexes.includes(i)
            ? {
                ...s,
                sectionId: targetSectionId,
                sectionName: targetSection.name,
              }
            : s,
        ),
      );

      // Update section slideIds
      setSections((prev) => {
        const movedSlideIds = slideIndexes.map((i) => {
          const slide = slides[i];
          const rawXml = slide?.rawXml as Record<string, unknown> | undefined;
          const cSld = rawXml?.["p:sld"] as Record<string, unknown> | undefined;
          return String(cSld?.["@_id"] || slide?.slideNumber || i + 1);
        });

        return prev.map((sec) => {
          if (sec.id === targetSectionId) {
            return {
              ...sec,
              slideIds: [
                ...sec.slideIds,
                ...movedSlideIds.filter((sid) => !sec.slideIds.includes(sid)),
              ],
            };
          }
          // Remove from other sections
          return {
            ...sec,
            slideIds: sec.slideIds.filter(
              (sid) => !movedSlideIds.includes(sid),
            ),
          };
        });
      });

      markDirty();
    },
    [sections, slides, setSlides, setSections, markDirty],
  );

  return {
    addSection,
    renameSection,
    deleteSection,
    moveSectionUp,
    moveSectionDown,
    moveSlidesToSection,
  };
}
