/**
 * useSerialize — Builds the `serializeSlides` callback that persists the
 * current slide deck (including header/footer, properties, etc.) via the
 * PptxHandler.
 */
import { useCallback } from "react";
import type React from "react";

import type {
  PptxSlide,
  PptxHandler,
  PptxHeaderFooter,
  PptxPresentationProperties,
  PptxCoreProperties,
  PptxAppProperties,
  PptxCustomProperty,
  PptxNotesMaster,
  PptxHandoutMaster,
  PptxSection,
} from "../../core";
import { guidePxToEmu } from "../../core";

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface UseSerializeInput {
  slides: PptxSlide[];
  activeSlideIndex: number;
  guides: Array<{ id: string; axis: "h" | "v"; position: number }>;
  headerFooter: PptxHeaderFooter;
  presentationProperties: PptxPresentationProperties;
  customShows: Array<{ id: string; name: string; slideRIds: string[] }>;
  sections: PptxSection[];
  coreProperties: PptxCoreProperties | undefined;
  appProperties: PptxAppProperties | undefined;
  customProperties: PptxCustomProperty[];
  notesMaster: PptxNotesMaster | undefined;
  handoutMaster: PptxHandoutMaster | undefined;
  handlerRef: React.RefObject<PptxHandler | null>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSerialize(
  input: UseSerializeInput,
): () => Promise<Uint8Array | null> {
  const {
    slides,
    activeSlideIndex,
    guides,
    headerFooter,
    presentationProperties,
    customShows,
    sections,
    coreProperties,
    appProperties,
    customProperties,
    notesMaster,
    handoutMaster,
    handlerRef,
  } = input;

  return useCallback(async (): Promise<Uint8Array | null> => {
    const handler = handlerRef.current;
    if (!handler) return null;

    const slidesWithGuides = slides.map((slide, idx) => {
      if (idx !== activeSlideIndex) return slide;
      const pptxGuides = guides.map((g) => ({
        id: g.id,
        orientation: (g.axis === "h" ? "horz" : "vert") as "horz" | "vert",
        positionEmu: guidePxToEmu(g.position),
      }));
      return {
        ...slide,
        guides: pptxGuides.length > 0 ? pptxGuides : undefined,
      };
    });

    return handler.save(slidesWithGuides, {
      headerFooter,
      presentationProperties,
      customShows: customShows.length > 0 ? customShows : undefined,
      sections: sections.length > 0 ? sections : undefined,
      coreProperties,
      appProperties,
      customProperties:
        customProperties.length > 0 ? customProperties : undefined,
      notesMaster,
      handoutMaster,
    });
  }, [
    slides,
    headerFooter,
    presentationProperties,
    customShows,
    sections,
    coreProperties,
    appProperties,
    customProperties,
    notesMaster,
    handoutMaster,
    guides,
    activeSlideIndex,
    handlerRef,
  ]);
}
