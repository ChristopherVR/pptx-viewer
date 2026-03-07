/**
 * useLoadContent — Handles loading/parsing PPTX content into viewer state.
 *
 * Extracts the heavy loading useEffect from PowerPointViewer so the
 * orchestrator stays lean.
 */
import { useEffect, useRef } from "react";

import type {
  PptxAppProperties,
  MediaPptxElement,
  PptxElement,
  PptxCoreProperties,
  PptxCustomProperty,
  PptxEmbeddedFont,
  PptxHeaderFooter,
  PptxHandoutMaster,
  PptxNotesMaster,
  PptxSlide,
  PptxSlideMaster,
  PptxTheme,
  PptxThemeOption,
  PptxCustomShow,
  PptxSection,
  PptxPresentationProperties,
  PptxTagCollection,
} from "../../core";
import { PptxHandler } from "../../core";
import { EncryptedFileError } from "../../core/utils/encryption-detection";
import {
  collectMediaElements,
  buildInitialGuides,
} from "./load-content-helpers";
import { DEFAULT_CANVAS_HEIGHT, DEFAULT_CANVAS_WIDTH } from "../constants";
import type { CanvasSize } from "../types";
import type { EditorHistoryResult } from "./useEditorHistory";

/* ------------------------------------------------------------------ */
/*  Input / Output types                                              */
/* ------------------------------------------------------------------ */

export interface UseLoadContentInput {
  content: ArrayBuffer | Uint8Array | null | undefined;
  clearSelection: () => void;
  history: EditorHistoryResult;
  setSlides: React.Dispatch<React.SetStateAction<PptxSlide[]>>;
  setTemplateElementsBySlideId: React.Dispatch<
    React.SetStateAction<Record<string, PptxElement[]>>
  >;
  mediaDataUrls: Map<string, string>;
  setCanvasSize: React.Dispatch<React.SetStateAction<CanvasSize>>;
  setHeaderFooter: React.Dispatch<React.SetStateAction<PptxHeaderFooter>>;
  setLayoutOptions: React.Dispatch<
    React.SetStateAction<Array<{ path: string; name: string }>>
  >;
  setSlideMasters: React.Dispatch<React.SetStateAction<PptxSlideMaster[]>>;
  setTheme: React.Dispatch<React.SetStateAction<PptxTheme | undefined>>;
  setThemeOptions: React.Dispatch<React.SetStateAction<PptxThemeOption[]>>;
  setCustomShows: React.Dispatch<React.SetStateAction<PptxCustomShow[]>>;
  setSections: React.Dispatch<React.SetStateAction<PptxSection[]>>;
  setPresentationProperties: React.Dispatch<
    React.SetStateAction<PptxPresentationProperties>
  >;
  setNotesMaster: React.Dispatch<
    React.SetStateAction<PptxNotesMaster | undefined>
  >;
  setHandoutMaster: React.Dispatch<
    React.SetStateAction<PptxHandoutMaster | undefined>
  >;
  setNotesCanvasSize: React.Dispatch<
    React.SetStateAction<CanvasSize | undefined>
  >;
  setCustomProperties: React.Dispatch<
    React.SetStateAction<PptxCustomProperty[]>
  >;
  setTagCollections: React.Dispatch<React.SetStateAction<PptxTagCollection[]>>;
  setCoreProperties: React.Dispatch<
    React.SetStateAction<PptxCoreProperties | undefined>
  >;
  setAppProperties: React.Dispatch<
    React.SetStateAction<PptxAppProperties | undefined>
  >;
  setEmbeddedFonts: React.Dispatch<React.SetStateAction<PptxEmbeddedFont[]>>;
  setActiveSlideIndex: React.Dispatch<React.SetStateAction<number>>;
  setHasMacros: React.Dispatch<React.SetStateAction<boolean>>;
  setHasDigitalSignatures: React.Dispatch<React.SetStateAction<boolean>>;
  setDigitalSignatureCount: React.Dispatch<React.SetStateAction<number>>;
  setGuides: React.Dispatch<
    React.SetStateAction<
      Array<{ id: string; axis: "h" | "v"; position: number }>
    >
  >;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setIsDirty: React.Dispatch<React.SetStateAction<boolean>>;
  setIsEncrypted: React.Dispatch<React.SetStateAction<boolean>>;
}

export interface UseLoadContentResult {
  handlerRef: React.MutableRefObject<PptxHandler | null>;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                              */
/* ------------------------------------------------------------------ */

export function useLoadContent({
  content,
  clearSelection,
  history,
  setSlides,
  setTemplateElementsBySlideId,
  mediaDataUrls,
  setCanvasSize,
  setHeaderFooter,
  setLayoutOptions,
  setSlideMasters,
  setTheme,
  setThemeOptions,
  setCustomShows,
  setSections,
  setPresentationProperties,
  setNotesMaster,
  setHandoutMaster,
  setNotesCanvasSize,
  setCustomProperties,
  setTagCollections,
  setCoreProperties,
  setAppProperties,
  setEmbeddedFonts,
  setActiveSlideIndex,
  setHasMacros,
  setHasDigitalSignatures,
  setDigitalSignatureCount,
  setGuides,
  setLoading,
  setError,
  setIsDirty,
  setIsEncrypted,
}: UseLoadContentInput): UseLoadContentResult {
  const handlerRef = useRef<PptxHandler | null>(null);
  const originalBufferRef = useRef<ArrayBuffer | null>(null);
  const renderTokenRef = useRef(0);

  useEffect(() => {
    if (!content) return;
    let cancelled = false;
    const token = ++renderTokenRef.current;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const buffer =
          content instanceof Uint8Array
            ? content.buffer.slice(
                content.byteOffset,
                content.byteOffset + content.byteLength,
              )
            : content;
        originalBufferRef.current =
          buffer instanceof ArrayBuffer ? buffer : null;
        const handler = new PptxHandler();
        const parsed = await handler.load(buffer as ArrayBuffer);
        if (cancelled || token !== renderTokenRef.current) return;

        const mediaElements: MediaPptxElement[] = [];
        for (const slide of parsed.slides) {
          collectMediaElements(slide.elements, mediaElements);
        }
        mediaDataUrls.clear();
        await Promise.all(
          mediaElements.map(async (mediaElement) => {
            const mediaPath = mediaElement.mediaPath;
            if (!mediaPath) {
              console.warn(
                `[pptx] Media element "${mediaElement.id}" has no mediaPath (type: ${mediaElement.mediaType ?? "unknown"})`,
              );
              mediaElement.mediaMissing = true;
              return;
            }
            try {
              // For audio/video media, use Blob URLs instead of base64.
              // This avoids the ~33% base64 encoding overhead and reduces
              // memory pressure that can cause OOM with large media files.
              const isAudioVideo =
                mediaElement.mediaType === "audio" ||
                mediaElement.mediaType === "video";
              if (isAudioVideo) {
                const arrayBuffer =
                  await handler.getMediaArrayBuffer(mediaPath);
                if (arrayBuffer) {
                  const mimeType =
                    mediaElement.mediaMimeType || "application/octet-stream";
                  const blob = new Blob([arrayBuffer], { type: mimeType });
                  const blobUrl = URL.createObjectURL(blob);
                  mediaDataUrls.set(mediaPath, blobUrl);
                } else {
                  console.warn(`[pptx] Failed to load media: ${mediaPath}`);
                  mediaElement.mediaMissing = true;
                }
              } else {
                // Non-audio/video media (e.g. unknown type): fall back to
                // base64 data URL via getImageData.
                const dataUrl = await handler.getImageData(mediaPath);
                if (dataUrl) {
                  mediaDataUrls.set(mediaPath, dataUrl);
                } else {
                  console.warn(`[pptx] Failed to load media: ${mediaPath}`);
                  mediaElement.mediaMissing = true;
                }
              }
            } catch (err) {
              console.warn(`[pptx] Error loading media "${mediaPath}":`, err);
              mediaElement.mediaMissing = true;
            }
          }),
        );

        handlerRef.current = handler;
        setSlides(parsed.slides);
        setTemplateElementsBySlideId({});
        setCanvasSize({
          width: parsed.width ?? DEFAULT_CANVAS_WIDTH,
          height: parsed.height ?? DEFAULT_CANVAS_HEIGHT,
        });
        setHeaderFooter(parsed.headerFooter ?? {});
        setLayoutOptions(parsed.layoutOptions ?? []);
        setSlideMasters(parsed.slideMasters ?? []);
        setTheme(parsed.theme);
        setThemeOptions(parsed.themeOptions ?? []);
        setCustomShows(parsed.customShows ?? []);
        setSections(parsed.sections ?? []);
        setPresentationProperties(parsed.presentationProperties ?? {});
        setNotesMaster(parsed.notesMaster);
        setHandoutMaster(parsed.handoutMaster);
        if (
          typeof parsed.notesWidthEmu === "number" &&
          typeof parsed.notesHeightEmu === "number" &&
          parsed.notesWidthEmu > 0 &&
          parsed.notesHeightEmu > 0
        ) {
          setNotesCanvasSize({
            width: Math.round(parsed.notesWidthEmu / 9525),
            height: Math.round(parsed.notesHeightEmu / 9525),
          });
        } else {
          setNotesCanvasSize(undefined);
        }
        setCustomProperties(parsed.customProperties ?? []);
        setTagCollections(parsed.tags ?? []);
        setCoreProperties(parsed.coreProperties);
        setAppProperties(parsed.appProperties);
        setEmbeddedFonts(parsed.embeddedFonts ?? []);
        setHasMacros(parsed.hasMacros === true);
        setHasDigitalSignatures(parsed.hasDigitalSignatures === true);
        setDigitalSignatureCount(parsed.digitalSignatureCount ?? 0);

        // Initialize drawing guides from parsed presentation + slide data
        setGuides(
          buildInitialGuides(
            parsed.presentationGuides,
            parsed.slides[0]?.guides,
          ),
        );

        setActiveSlideIndex(0);
        clearSelection();
        setIsDirty(false);
        history.resetHistory();
      } catch (err) {
        if (!cancelled && token === renderTokenRef.current) {
          if (err instanceof EncryptedFileError) {
            setIsEncrypted(true);
          } else {
            setError(err instanceof Error ? err.message : String(err));
          }
        }
      } finally {
        if (!cancelled && token === renderTokenRef.current) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  return { handlerRef };
}
