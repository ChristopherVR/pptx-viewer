import type { PptxSlide } from "pptx-viewer-core";

// ---------------------------------------------------------------------------
// Shared slide transition logic
// ---------------------------------------------------------------------------

export interface SlideTransitionDeps {
  slides: PptxSlide[];
  currentSlideIndex: number;
  onPlayActionSound?: (soundPath: string) => void;
  setPresentationSlideVisible: (visible: boolean) => void;
  clearPresentationTimers: () => void;
  setPresentationSlideIndex: (index: number) => void;
  onSetActiveSlideIndex: (index: number) => void;
  runPresentationEntranceAnimations: (slideIndex: number) => void;
  scheduleAutoAdvanceForSlide?: (slideIndex: number) => void;
  presentationTimersRef: { current: number[] };
}

/**
 * Execute a slide transition: play the outgoing slide's transition sound,
 * hide the current slide, clear timers, then after the transition duration
 * reveal the next slide and run its entrance animations.
 */
export function executeSlideTransition(
  nextSlideIndex: number,
  deps: SlideTransitionDeps,
): void {
  const activePresentationSlide = deps.slides[deps.currentSlideIndex];
  if (
    activePresentationSlide?.transition?.soundPath &&
    deps.onPlayActionSound
  ) {
    deps.onPlayActionSound(activePresentationSlide.transition.soundPath);
  }
  const transitionDuration = Math.max(
    120,
    activePresentationSlide?.transition?.durationMs || 320,
  );
  deps.setPresentationSlideVisible(false);
  deps.clearPresentationTimers();

  const timer = window.setTimeout(
    () => {
      deps.setPresentationSlideIndex(nextSlideIndex);
      deps.onSetActiveSlideIndex(nextSlideIndex);
      deps.setPresentationSlideVisible(true);
      deps.runPresentationEntranceAnimations(nextSlideIndex);
      deps.scheduleAutoAdvanceForSlide?.(nextSlideIndex);
    },
    Math.min(transitionDuration, 480),
  );
  deps.presentationTimersRef.current.push(timer);
}
