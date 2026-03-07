import React, { useRef, useState, useCallback, useEffect } from "react";
import { LuPlay, LuPause, LuInfo } from "react-icons/lu";
import { useTranslation } from "react-i18next";

import type {
  MediaPptxElement,
  MediaMetadata,
  PptxElement,
} from "pptx-viewer-core";
import { MediaInspector } from "./MediaInspector";
import {
  TrimTimeline,
  formatTime,
  CARD,
  HEADING,
  BTN,
  LABEL_CLS,
  LABEL_TEXT,
} from "./TrimTimeline";
import { MediaPlaybackBookmarks } from "./MediaPlaybackBookmarks";

// ==========================================================================
// Props
// ==========================================================================

export interface MediaPropertiesPanelProps {
  element: MediaPptxElement;
  mediaDataUrls: Map<string, string>;
  canEdit: boolean;
  onUpdateElement: (updates: Partial<PptxElement>) => void;
}

// ==========================================================================
// Component
// ==========================================================================

export function MediaPropertiesPanel({
  element,
  mediaDataUrls,
  canEdit,
  onUpdateElement,
}: MediaPropertiesPanelProps): React.ReactElement {
  const { t } = useTranslation();
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const dataUrl =
    element.mediaData ??
    (element.mediaPath ? mediaDataUrls.get(element.mediaPath) : undefined);

  const bookmarks = element.bookmarks ?? [];
  const isVideo = element.mediaType === "video";

  // Sync playback state
  useEffect(() => {
    const el = mediaRef.current;
    if (!el) return;
    const onTimeUpdate = (): void => setCurrentTime(el.currentTime);
    const onDurationChange = (): void => {
      if (Number.isFinite(el.duration)) setDuration(el.duration);
    };
    const onPlay = (): void => setIsPlaying(true);
    const onPause = (): void => setIsPlaying(false);
    const onEnded = (): void => setIsPlaying(false);
    el.addEventListener("timeupdate", onTimeUpdate);
    el.addEventListener("durationchange", onDurationChange);
    el.addEventListener("loadedmetadata", onDurationChange);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);
    return () => {
      el.removeEventListener("timeupdate", onTimeUpdate);
      el.removeEventListener("durationchange", onDurationChange);
      el.removeEventListener("loadedmetadata", onDurationChange);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
    };
  }, [dataUrl]);

  const togglePlay = useCallback((): void => {
    const el = mediaRef.current;
    if (!el) return;
    if (el.paused) {
      void el.play();
    } else {
      el.pause();
    }
  }, []);

  const seekTo = useCallback((time: number): void => {
    const el = mediaRef.current;
    if (!el) return;
    el.currentTime = time;
    setCurrentTime(time);
  }, []);

  const handleTrimChange = useCallback(
    (trimStartMs: number, trimEndMs: number): void => {
      onUpdateElement({ trimStartMs, trimEndMs } as Partial<PptxElement>);
    },
    [onUpdateElement],
  );

  // Extract metadata from the media element once loaded
  const [extractedMetadata, setExtractedMetadata] = useState<
    MediaMetadata | undefined
  >(element.metadata);

  useEffect(() => {
    const el = mediaRef.current;
    if (!el) return;
    if (element.metadata?.duration !== undefined) {
      setExtractedMetadata(element.metadata);
      return;
    }
    const extract = (): void => {
      if (!Number.isFinite(el.duration) || el.duration === 0) return;
      const meta: MediaMetadata = { duration: el.duration };
      if (el instanceof HTMLVideoElement) {
        if (el.videoWidth > 0) meta.videoWidth = el.videoWidth;
        if (el.videoHeight > 0) meta.videoHeight = el.videoHeight;
      }
      const sourceEl = el.querySelector("source");
      if (sourceEl?.type) meta.codecInfo = sourceEl.type;
      element.metadata = meta;
      setExtractedMetadata(meta);
    };
    el.addEventListener("loadedmetadata", extract);
    if (el.readyState >= 1) extract();
    return () => {
      el.removeEventListener("loadedmetadata", extract);
    };
  }, [dataUrl, element]);

  return (
    <div className="space-y-3">
      {/* ── Header + Preview ── */}
      <div className={CARD}>
        <div className={HEADING}>{t("pptx.media.title")}</div>
        <div className="text-[11px] text-muted-foreground">
          {isVideo ? t("pptx.media.videoClip") : t("pptx.media.audioClip")}
        </div>

        {dataUrl && (
          <div className="space-y-1">
            {isVideo ? (
              <video
                ref={mediaRef as React.RefObject<HTMLVideoElement>}
                className="w-full rounded bg-black max-h-32 object-contain"
                src={dataUrl}
                preload="metadata"
              />
            ) : (
              <audio
                ref={mediaRef as React.RefObject<HTMLAudioElement>}
                className="w-full"
                src={dataUrl}
                preload="metadata"
              />
            )}
            <div className="flex items-center gap-1">
              <button
                type="button"
                className={BTN}
                onClick={togglePlay}
                title={isPlaying ? t("pptx.media.pause") : t("pptx.media.play")}
              >
                {isPlaying ? (
                  <LuPause className="w-3 h-3" />
                ) : (
                  <LuPlay className="w-3 h-3" />
                )}
              </button>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>
          </div>
        )}

        {duration > 0 && (
          <TrimTimeline
            duration={duration}
            trimStartMs={element.trimStartMs ?? 0}
            trimEndMs={element.trimEndMs ?? 0}
            currentTime={currentTime}
            bookmarks={bookmarks}
            canEdit={canEdit}
            onTrimChange={handleTrimChange}
            onSeek={seekTo}
          />
        )}
      </div>

      {/* ── Trim Inspector ── */}
      <MediaInspector
        element={element}
        canEdit={canEdit}
        durationSeconds={duration}
        onUpdateElement={onUpdateElement}
      />

      {/* ── Media Info ── */}
      {(extractedMetadata || element.posterFrameData) && (
        <div className={CARD}>
          <div className={HEADING}>
            <LuInfo className="inline w-3 h-3 mr-1" />
            {t("pptx.media.info")}
          </div>
          {element.posterFrameData && (
            <div className="space-y-1">
              <div className={`text-[11px] ${LABEL_TEXT}`}>
                {t("pptx.media.posterFrame")}
              </div>
              <img
                src={element.posterFrameData}
                alt={t("pptx.media.posterFrame")}
                className="w-full max-h-20 object-contain rounded bg-black/20"
              />
            </div>
          )}
          {extractedMetadata?.duration !== undefined && (
            <div className={LABEL_CLS}>
              <span className={`text-[11px] ${LABEL_TEXT}`}>
                {t("pptx.media.duration")}
              </span>
              <span className="text-[11px] tabular-nums">
                {formatTime(extractedMetadata.duration)}
              </span>
            </div>
          )}
          {extractedMetadata?.videoWidth !== undefined &&
            extractedMetadata?.videoHeight !== undefined && (
              <div className={LABEL_CLS}>
                <span className={`text-[11px] ${LABEL_TEXT}`}>
                  {t("pptx.media.resolution")}
                </span>
                <span className="text-[11px] tabular-nums">
                  {extractedMetadata.videoWidth} x{" "}
                  {extractedMetadata.videoHeight}
                </span>
              </div>
            )}
          {extractedMetadata?.codecInfo && (
            <div className={LABEL_CLS}>
              <span className={`text-[11px] ${LABEL_TEXT}`}>
                {t("pptx.media.format")}
              </span>
              <span
                className="text-[11px] truncate max-w-[140px]"
                title={extractedMetadata.codecInfo}
              >
                {extractedMetadata.codecInfo}
              </span>
            </div>
          )}
          {element.mediaPath && (
            <div className={LABEL_CLS}>
              <span className={`text-[11px] ${LABEL_TEXT}`}>
                {t("pptx.media.filePath")}
              </span>
              <span
                className="text-[10px] truncate max-w-[140px] text-muted-foreground"
                title={element.mediaPath}
              >
                {element.mediaPath.split("/").pop()}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Playback & Bookmarks ── */}
      <MediaPlaybackBookmarks
        element={element}
        canEdit={canEdit}
        currentTime={currentTime}
        bookmarks={bookmarks}
        onUpdateElement={onUpdateElement}
        onSeekTo={seekTo}
      />
    </div>
  );
}
