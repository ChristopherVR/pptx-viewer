import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import type { PptxSlideTransition } from "../../../core";
import {
  getSlideTransitionAnimations,
  SLIDE_TRANSITION_KEYFRAMES,
} from "../../utils/slide-transitions";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TransitionPreviewProps {
  transition: PptxSlideTransition;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TransitionPreview({
  transition,
}: TransitionPreviewProps): React.ReactElement | null {
  const previewRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  const { t } = useTranslation();

  const durationMs = transition.durationMs ?? 500;

  const animations = useMemo(
    () =>
      getSlideTransitionAnimations(
        transition.type,
        durationMs,
        transition.direction,
        transition.orient,
        transition.spokes,
      ),
    [
      transition.type,
      transition.direction,
      transition.orient,
      transition.spokes,
      durationMs,
    ],
  );

  const handlePlay = useCallback(() => {
    setPlaying(true);
    setAnimKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => setPlaying(false), durationMs + 100);
    return () => {
      window.clearTimeout(timer);
    };
  }, [playing, durationMs, animKey]);

  if (transition.type === "none" || transition.type === "cut") return null;

  return (
    <div className="space-y-1">
      <div className="text-[10px] text-muted-foreground">
        {t("pptx.transition.preview")}
      </div>
      <div
        ref={previewRef}
        className="relative w-full h-16 rounded border border-border overflow-hidden bg-muted cursor-pointer"
        onClick={handlePlay}
        title={t("pptx.transition.preview")}
      >
        <div
          className="absolute inset-0 bg-primary/20 flex items-center justify-center text-[9px] text-muted-foreground"
          style={{
            animation:
              playing && animations.incoming !== "none"
                ? animations.incoming
                : undefined,
          }}
          key={`in-${animKey}`}
        >
          B
        </div>
        <div
          className="absolute inset-0 bg-card flex items-center justify-center text-[9px] text-muted-foreground"
          style={{
            zIndex: animations.outgoingOnTop ? 2 : 0,
            animation:
              playing && animations.outgoing !== "none"
                ? animations.outgoing
                : !playing
                  ? undefined
                  : `pptx-tr-fade-out ${durationMs}ms ease-in-out forwards`,
          }}
          key={`out-${animKey}`}
        >
          A
        </div>
      </div>
      <style>{SLIDE_TRANSITION_KEYFRAMES}</style>
    </div>
  );
}
