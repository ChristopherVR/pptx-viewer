import React, { useRef, useEffect, useCallback, useState } from "react";

import type { MediaPptxElement } from "../../core";
import { registerPersistentAudio } from "./media-persistent-audio";

// ---------------------------------------------------------------------------
// PresentationMediaController — manages trim, fade, volume at runtime
// ---------------------------------------------------------------------------

interface PresentationMediaControllerProps {
  element: MediaPptxElement;
  isPresentationMode: boolean;
  /** Whether this media is in full-screen overlay mode. */
  isFullScreen: boolean;
  /** Callback fired when media play/pause state changes. */
  onPlayStateChange?: (isPlaying: boolean) => void;
  children: (props: {
    mediaRef: React.RefObject<HTMLVideoElement | HTMLAudioElement | null>;
    onPlay: () => void;
    isMediaPlaying: boolean;
  }) => React.ReactNode;
}

export function PresentationMediaController({
  element,
  isPresentationMode,
  isFullScreen,
  onPlayStateChange,
  children,
}: PresentationMediaControllerProps): React.ReactElement {
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const fadeTimerRef = useRef<number | null>(null);
  const trimTimerRef = useRef<number | null>(null);
  const [isMediaPlaying, setIsMediaPlaying] = useState(false);

  const volume = element.volume ?? 1;
  const fadeIn = element.fadeInDuration ?? 0;
  const fadeOut = element.fadeOutDuration ?? 0;
  const trimStartSec =
    element.trimStartMs !== undefined ? element.trimStartMs / 1000 : 0;
  const trimEndSec =
    element.trimEndMs !== undefined && element.trimEndMs > 0
      ? element.trimEndMs / 1000
      : 0;
  const hideWhenNotPlaying =
    isPresentationMode && element.hideWhenNotPlaying === true;

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (fadeTimerRef.current !== null)
        cancelAnimationFrame(fadeTimerRef.current);
      if (trimTimerRef.current !== null)
        window.clearTimeout(trimTimerRef.current);
    };
  }, []);

  // Apply volume
  useEffect(() => {
    const el = mediaRef.current;
    if (el) el.volume = Math.max(0, Math.min(1, volume));
  }, [volume]);

  // Apply playback speed
  const playbackSpeed = element.playbackSpeed ?? 1;
  useEffect(() => {
    const el = mediaRef.current;
    if (el) el.playbackRate = Math.max(0.25, Math.min(4, playbackSpeed));
  }, [playbackSpeed]);

  // Track play/pause state and notify parent
  useEffect(() => {
    const el = mediaRef.current;
    if (!el) return;
    const handlePlay = (): void => {
      setIsMediaPlaying(true);
      onPlayStateChange?.(true);
    };
    const handlePause = (): void => {
      setIsMediaPlaying(false);
      onPlayStateChange?.(false);
    };
    const handleEnded = (): void => {
      setIsMediaPlaying(false);
      onPlayStateChange?.(false);
    };
    el.addEventListener("play", handlePlay);
    el.addEventListener("pause", handlePause);
    el.addEventListener("ended", handleEnded);
    return () => {
      el.removeEventListener("play", handlePlay);
      el.removeEventListener("pause", handlePause);
      el.removeEventListener("ended", handleEnded);
    };
  }, [onPlayStateChange]);

  // Fade-in effect
  const applyFadeIn = useCallback((): void => {
    const el = mediaRef.current;
    if (!el || fadeIn <= 0) return;

    const startTime = performance.now();
    const durationMs = fadeIn * 1000;
    el.volume = 0;

    const tick = (): void => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      el.volume = progress * volume;
      if (progress < 1) {
        fadeTimerRef.current = requestAnimationFrame(tick);
      }
    };
    fadeTimerRef.current = requestAnimationFrame(tick);
  }, [fadeIn, volume]);

  // Trim enforcement + fade-out scheduling
  const handlePlay = useCallback((): void => {
    const el = mediaRef.current;
    if (!el || !isPresentationMode) return;

    // Apply trim start
    if (trimStartSec > 0 && el.currentTime < trimStartSec) {
      el.currentTime = trimStartSec;
    }

    // Apply fade-in
    if (fadeIn > 0) {
      applyFadeIn();
    }

    // Schedule trim-end stop + fade-out
    if (trimEndSec > 0) {
      const remaining = trimEndSec - el.currentTime;
      if (remaining > 0) {
        // Schedule fade-out before trim end
        const fadeOutStart = Math.max(0, (remaining - fadeOut) * 1000);
        if (fadeOut > 0) {
          trimTimerRef.current = window.setTimeout(() => {
            const fadeStartTime = performance.now();
            const fadeMs = fadeOut * 1000;
            const startVol = el.volume;
            const fadeOutTick = (): void => {
              const elapsed = performance.now() - fadeStartTime;
              const progress = Math.min(1, elapsed / fadeMs);
              el.volume = startVol * (1 - progress);
              if (progress < 1 && !el.paused) {
                fadeTimerRef.current = requestAnimationFrame(fadeOutTick);
              }
            };
            fadeTimerRef.current = requestAnimationFrame(fadeOutTick);
          }, fadeOutStart);
        }

        // Stop at trim end
        const stopTimer = window.setTimeout(() => {
          if (!el.paused) {
            el.pause();
            el.currentTime = trimEndSec;
          }
        }, remaining * 1000);

        // Store for cleanup
        const prevTimer = trimTimerRef.current;
        trimTimerRef.current = stopTimer;
        if (prevTimer !== null) window.clearTimeout(prevTimer);
      }
    } else if (fadeOut > 0) {
      // No trim end but has fade-out — listen for near-end
      const handleTimeUpdate = (): void => {
        if (!Number.isFinite(el.duration)) return;
        const timeLeft = el.duration - el.currentTime;
        if (timeLeft <= fadeOut && timeLeft > 0) {
          el.removeEventListener("timeupdate", handleTimeUpdate);
          const fadeStartTime = performance.now();
          const fadeMs = timeLeft * 1000;
          const startVol = el.volume;
          const fadeOutTick = (): void => {
            const elapsed = performance.now() - fadeStartTime;
            const progress = Math.min(1, elapsed / fadeMs);
            el.volume = startVol * (1 - progress);
            if (progress < 1 && !el.paused) {
              fadeTimerRef.current = requestAnimationFrame(fadeOutTick);
            }
          };
          fadeTimerRef.current = requestAnimationFrame(fadeOutTick);
        }
      };
      el.addEventListener("timeupdate", handleTimeUpdate);
    }
  }, [
    applyFadeIn,
    fadeIn,
    fadeOut,
    isPresentationMode,
    trimEndSec,
    trimStartSec,
    volume,
  ]);

  // Auto-play in presentation mode
  useEffect(() => {
    if (!isPresentationMode || !element.autoPlay) return;

    // Play-across-slides: register with persistent manager so audio
    // survives slide unmount. The media element in the slide is hidden;
    // a detached <audio> plays instead.
    if (element.playAcrossSlides && element.mediaType === "audio") {
      const dataUrl =
        element.mediaData ??
        (element.mediaPath
          ? undefined // resolved later when rendering
          : undefined);
      if (dataUrl) {
        registerPersistentAudio(
          element.id,
          dataUrl,
          element.mediaMimeType,
          element.loop === true,
          volume,
          trimStartSec,
        );
      }
      // Don't also play the inline element
      return;
    }

    const el = mediaRef.current;
    if (!el) return;

    // Small delay to let the slide render
    const timer = window.setTimeout(() => {
      if (trimStartSec > 0) {
        el.currentTime = trimStartSec;
      }
      void el.play().catch(() => {
        /* autoplay blocked */
      });
    }, 100);
    return () => window.clearTimeout(timer);
  }, [
    isPresentationMode,
    element.autoPlay,
    element.playAcrossSlides,
    element.mediaType,
    element.mediaData,
    element.mediaPath,
    element.mediaMimeType,
    element.loop,
    element.id,
    trimStartSec,
    volume,
  ]);

  const wrapperStyle: React.CSSProperties = hideWhenNotPlaying
    ? {
        opacity: isMediaPlaying ? 1 : 0,
        transition: "opacity 0.3s ease",
        pointerEvents: isMediaPlaying ? "auto" : "none",
      }
    : {};

  const handleStopFullScreen = useCallback((): void => {
    const el = mediaRef.current;
    if (el && !el.paused) {
      el.pause();
    }
  }, []);

  return (
    <div className="w-full h-full" style={wrapperStyle}>
      {children({ mediaRef, onPlay: handlePlay, isMediaPlaying })}
      {/* Subtle close/stop button for full-screen media overlay */}
      {isFullScreen && isPresentationMode && isMediaPlaying && (
        <button
          type="button"
          className="absolute bottom-3 right-3 z-30 rounded-full bg-black/50 hover:bg-black/70 text-white/80 hover:text-white p-2 transition-colors pointer-events-auto"
          onClick={handleStopFullScreen}
          aria-label="Stop full-screen playback"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="currentColor"
            stroke="none"
          >
            <rect x="6" y="6" width="12" height="12" rx="1" />
          </svg>
        </button>
      )}
    </div>
  );
}
