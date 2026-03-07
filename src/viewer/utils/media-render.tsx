import React from "react";

import type { PptxElement } from "../../core";
import {
  registerPersistentAudio,
  buildTrimFragment,
} from "./media-persistent-audio";
import {
  MediaNotFoundPlaceholder,
  VideoWithMetadata,
  AudioWithMetadata,
} from "./media-components";
import { PresentationMediaController } from "./media-controller";

// ---------------------------------------------------------------------------
// Public render options
// ---------------------------------------------------------------------------

export interface RenderMediaOptions {
  autoPlay?: boolean;
  fullScreen?: boolean;
  isPresentationMode?: boolean;
  /** Callback fired when the media play/pause state changes. */
  onPlayStateChange?: (isPlaying: boolean) => void;
}

// ---------------------------------------------------------------------------
// renderMediaElement — main public entry point
// ---------------------------------------------------------------------------

/**
 * Render video or audio media elements with native HTML5 players.
 * Supports trim, fade in/out, volume, loop, auto-play, hide-when-not-playing,
 * bookmarks, metadata extraction, closed captions, and missing-media placeholders.
 */
export function renderMediaElement(
  element: PptxElement,
  mediaDataUrls: Map<string, string>,
  options?: RenderMediaOptions,
): React.ReactNode {
  if (element.type !== "media") {
    return (
      <div className="w-full h-full flex items-center justify-center text-[11px] text-white/80 pointer-events-none">
        Media
      </div>
    );
  }

  // Extract media info from the element (already narrowed by type guard above)
  const mediaType = element.mediaType;
  const mediaPath = element.mediaPath;
  const mediaMimeType = element.mediaMimeType;

  // Try to resolve the media data URL (base64-encoded by PptxHandler)
  const dataUrl =
    element.mediaData ?? (mediaPath ? mediaDataUrls.get(mediaPath) : undefined);

  // Trim fragment for media source URL
  const trimFragment = buildTrimFragment(element);

  // Poster frame data URL (resolved during parsing)
  const posterUrl = element.posterFrameData ?? undefined;

  // Loop flag
  const shouldLoop = element.loop === true;
  const shouldAutoPlay =
    options?.autoPlay === true || element.autoPlay === true;
  const isFullScreen = options?.fullScreen === true;
  const isPresentationMode = options?.isPresentationMode === true;

  // Play-across-slides: register persistent audio with resolved dataUrl.
  // The PresentationMediaController auto-play effect handles this when
  // element.mediaData is set, but when data comes from mediaDataUrls we
  // must register here since the controller only sees the element fields.
  if (
    isPresentationMode &&
    shouldAutoPlay &&
    element.playAcrossSlides &&
    element.mediaType === "audio" &&
    dataUrl &&
    !element.mediaData
  ) {
    const trimStartSec =
      element.trimStartMs !== undefined ? element.trimStartMs / 1000 : 0;
    registerPersistentAudio(
      element.id,
      dataUrl,
      mediaMimeType,
      shouldLoop,
      element.volume ?? 1,
      trimStartSec,
    );
  }

  // Check for explicitly missing media
  if (element.mediaMissing) {
    // Show poster frame if available even for missing media
    if (posterUrl) {
      return (
        <div className="w-full h-full relative pointer-events-none">
          <img
            src={posterUrl}
            alt="Media poster"
            className="w-full h-full object-contain opacity-50"
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-white/60"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="4" y1="4" x2="20" y2="20" />
            </svg>
            <span className="text-[10px] text-white/60">Media not found</span>
          </div>
        </div>
      );
    }
    return <MediaNotFoundPlaceholder mediaType={mediaType ?? "video"} />;
  }

  if (mediaType === "video") {
    if (dataUrl) {
      return (
        <PresentationMediaController
          element={element}
          isPresentationMode={isPresentationMode}
          isFullScreen={isFullScreen}
          onPlayStateChange={options?.onPlayStateChange}
        >
          {({ mediaRef, onPlay }) => (
            <VideoWithMetadata
              element={element}
              mediaRef={mediaRef}
              onPlay={onPlay}
              dataUrl={dataUrl}
              trimFragment={trimFragment}
              mediaMimeType={mediaMimeType}
              posterUrl={posterUrl}
              shouldLoop={shouldLoop}
              shouldAutoPlay={shouldAutoPlay}
              isFullScreen={isFullScreen}
              isPresentationMode={isPresentationMode}
            />
          )}
        </PresentationMediaController>
      );
    }
    // Fallback placeholder — show poster frame if available
    if (posterUrl) {
      return (
        <div className="w-full h-full relative pointer-events-none">
          <img
            src={posterUrl}
            alt="Video poster"
            className="w-full h-full object-contain"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-white/80 drop-shadow-md"
            >
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
        </div>
      );
    }
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-1 pointer-events-none bg-black/20 rounded">
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-white/70"
        >
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
        <span className="text-[10px] text-white/70">Video</span>
      </div>
    );
  }

  if (mediaType === "audio") {
    if (dataUrl) {
      return (
        <PresentationMediaController
          element={element}
          isPresentationMode={isPresentationMode}
          isFullScreen={false}
          onPlayStateChange={options?.onPlayStateChange}
        >
          {({ mediaRef, onPlay }) => (
            <AudioWithMetadata
              element={element}
              mediaRef={mediaRef}
              onPlay={onPlay}
              dataUrl={dataUrl}
              trimFragment={trimFragment}
              mediaMimeType={mediaMimeType}
              shouldLoop={shouldLoop}
              shouldAutoPlay={shouldAutoPlay}
              isPresentationMode={isPresentationMode}
            />
          )}
        </PresentationMediaController>
      );
    }
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-1 pointer-events-none bg-black/10 rounded">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-white/70"
        >
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
        <span className="text-[10px] text-white/70">Audio</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center text-[11px] text-white/80 pointer-events-none">
      Media
    </div>
  );
}
