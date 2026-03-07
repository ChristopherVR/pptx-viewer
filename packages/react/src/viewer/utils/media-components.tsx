import React, { useEffect, useState } from "react";

import type {
  MediaPptxElement,
  MediaCaptionTrack,
  MediaMetadata,
} from "pptx-viewer-core";

// ---------------------------------------------------------------------------
// MediaMetadataExtractor — extracts duration, resolution, codec from
// HTMLMediaElement and writes back to element.metadata lazily.
// ---------------------------------------------------------------------------

export function useMediaMetadataExtraction(
  mediaRef: React.RefObject<HTMLVideoElement | HTMLAudioElement | null>,
  element: MediaPptxElement,
): MediaMetadata | undefined {
  const [metadata, setMetadata] = useState<MediaMetadata | undefined>(
    element.metadata,
  );

  useEffect(() => {
    const el = mediaRef.current;
    if (!el) return;
    // If we already have metadata, skip extraction
    if (element.metadata?.duration !== undefined) {
      setMetadata(element.metadata);
      return;
    }

    const extract = (): void => {
      if (!Number.isFinite(el.duration) || el.duration === 0) return;
      const meta: MediaMetadata = {
        duration: el.duration,
      };
      // Extract video resolution
      if (el instanceof HTMLVideoElement) {
        if (el.videoWidth > 0) meta.videoWidth = el.videoWidth;
        if (el.videoHeight > 0) meta.videoHeight = el.videoHeight;
      }
      // Attempt to read codec info from the first <source> element
      const sourceEl = el.querySelector("source");
      if (sourceEl?.type) {
        meta.codecInfo = sourceEl.type;
      }
      element.metadata = meta;
      setMetadata(meta);
    };

    el.addEventListener("loadedmetadata", extract);
    // Also try immediately in case already loaded
    if (el.readyState >= 1) {
      extract();
    }
    return () => {
      el.removeEventListener("loadedmetadata", extract);
    };
  }, [mediaRef, element]);

  return metadata;
}

// ---------------------------------------------------------------------------
// CaptionTrackRenderer — renders <track> elements for closed captions
// ---------------------------------------------------------------------------

interface CaptionTrackRendererProps {
  captionTracks: MediaCaptionTrack[];
}

export function CaptionTrackRenderer({
  captionTracks,
}: CaptionTrackRendererProps): React.ReactElement {
  return (
    <>
      {captionTracks.map((track) => {
        const trackSrc =
          track.src ??
          (track.content
            ? `data:text/vtt;charset=utf-8,${encodeURIComponent(track.content)}`
            : undefined);
        if (!trackSrc) return null;
        return (
          <track
            key={track.id}
            kind={track.kind}
            label={track.label}
            srcLang={track.language}
            src={trackSrc}
            default={track.isDefault}
          />
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// MediaNotFoundPlaceholder — shown when media file is missing/broken
// ---------------------------------------------------------------------------

interface MediaNotFoundPlaceholderProps {
  mediaType: string;
}

export function MediaNotFoundPlaceholder({
  mediaType,
}: MediaNotFoundPlaceholderProps): React.ReactElement {
  const isVideo = mediaType === "video";
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-2 pointer-events-none bg-black/30 rounded border border-dashed border-white/20">
      <svg
        width="36"
        height="36"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-white/50"
      >
        {isVideo ? (
          <>
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <line x1="2" y1="4" x2="22" y2="20" />
          </>
        ) : (
          <>
            <circle cx="12" cy="12" r="10" />
            <line x1="4" y1="4" x2="20" y2="20" />
          </>
        )}
      </svg>
      <span className="text-[10px] text-white/50">
        {isVideo ? "Video" : "Audio"} not found
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// VideoWithMetadata — wraps video element and extracts metadata
// ---------------------------------------------------------------------------

interface VideoWithMetadataProps {
  element: MediaPptxElement;
  mediaRef: React.RefObject<HTMLVideoElement | HTMLAudioElement | null>;
  onPlay: () => void;
  dataUrl: string;
  trimFragment: string;
  mediaMimeType: string | undefined;
  posterUrl: string | undefined;
  shouldLoop: boolean;
  shouldAutoPlay: boolean;
  isFullScreen: boolean;
  isPresentationMode: boolean;
}

export function VideoWithMetadata({
  element,
  mediaRef,
  onPlay,
  dataUrl,
  trimFragment,
  mediaMimeType,
  posterUrl,
  shouldLoop,
  shouldAutoPlay,
  isFullScreen,
  isPresentationMode,
}: VideoWithMetadataProps): React.ReactElement {
  useMediaMetadataExtraction(mediaRef, element);
  const captionTracks = element.captionTracks ?? [];

  return (
    <video
      ref={mediaRef as React.RefObject<HTMLVideoElement>}
      className={`w-full h-full pointer-events-auto ${isFullScreen ? "object-cover" : "object-contain"}`}
      controls={!isPresentationMode}
      preload="metadata"
      playsInline
      autoPlay={shouldAutoPlay}
      muted={shouldAutoPlay && !isPresentationMode}
      poster={posterUrl}
      loop={shouldLoop}
      onPlay={onPlay}
      crossOrigin={captionTracks.length > 0 ? "anonymous" : undefined}
    >
      <source
        src={`${dataUrl}${trimFragment}`}
        type={mediaMimeType || "video/mp4"}
      />
      {captionTracks.length > 0 && (
        <CaptionTrackRenderer captionTracks={captionTracks} />
      )}
    </video>
  );
}

// ---------------------------------------------------------------------------
// AudioWithMetadata — wraps audio element and extracts metadata
// ---------------------------------------------------------------------------

interface AudioWithMetadataProps {
  element: MediaPptxElement;
  mediaRef: React.RefObject<HTMLVideoElement | HTMLAudioElement | null>;
  onPlay: () => void;
  dataUrl: string;
  trimFragment: string;
  mediaMimeType: string | undefined;
  shouldLoop: boolean;
  shouldAutoPlay: boolean;
  isPresentationMode: boolean;
}

export function AudioWithMetadata({
  element,
  mediaRef,
  onPlay,
  dataUrl,
  trimFragment,
  mediaMimeType,
  shouldLoop,
  shouldAutoPlay,
  isPresentationMode,
}: AudioWithMetadataProps): React.ReactElement {
  useMediaMetadataExtraction(mediaRef, element);

  return (
    <div className="w-full h-full flex items-center justify-center p-2 pointer-events-auto">
      <audio
        ref={mediaRef as React.RefObject<HTMLAudioElement>}
        className="w-full"
        controls={!isPresentationMode}
        preload="metadata"
        autoPlay={shouldAutoPlay}
        loop={shouldLoop}
        onPlay={onPlay}
      >
        <source
          src={`${dataUrl}${trimFragment}`}
          type={mediaMimeType || "audio/mpeg"}
        />
      </audio>
    </div>
  );
}
