import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  executeSlideTransition,
  type SlideTransitionDeps,
} from "./slide-transition";
import type { PptxSlide } from "pptx-viewer-core";

function createMockSlide(
  overrides: Partial<PptxSlide> = {},
): PptxSlide {
  return {
    id: "slide-1",
    elements: [],
    ...overrides,
  } as PptxSlide;
}

function createMockDeps(
  overrides: Partial<SlideTransitionDeps> = {},
): SlideTransitionDeps {
  return {
    slides: [createMockSlide(), createMockSlide({ id: "slide-2" })],
    currentSlideIndex: 0,
    onPlayActionSound: vi.fn(),
    setPresentationSlideVisible: vi.fn(),
    clearPresentationTimers: vi.fn(),
    setPresentationSlideIndex: vi.fn(),
    onSetActiveSlideIndex: vi.fn(),
    runPresentationEntranceAnimations: vi.fn(),
    scheduleAutoAdvanceForSlide: vi.fn(),
    presentationTimersRef: { current: [] },
    ...overrides,
  };
}

describe("executeSlideTransition", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("window", {
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("should hide the current slide immediately", () => {
    const deps = createMockDeps();
    executeSlideTransition(1, deps);
    expect(deps.setPresentationSlideVisible).toHaveBeenCalledWith(false);
  });

  it("should clear existing timers", () => {
    const deps = createMockDeps();
    executeSlideTransition(1, deps);
    expect(deps.clearPresentationTimers).toHaveBeenCalled();
  });

  it("should play transition sound when slide has one", () => {
    const slide = createMockSlide({
      transition: { soundPath: "swoosh.wav", durationMs: 500 } as PptxSlide["transition"],
    });
    const deps = createMockDeps({ slides: [slide, createMockSlide()] });
    executeSlideTransition(1, deps);
    expect(deps.onPlayActionSound).toHaveBeenCalledWith("swoosh.wav");
  });

  it("should not play sound when slide has no transition sound", () => {
    const deps = createMockDeps();
    executeSlideTransition(1, deps);
    expect(deps.onPlayActionSound).not.toHaveBeenCalled();
  });

  it("should set next slide index after transition duration", () => {
    const slide = createMockSlide({
      transition: { durationMs: 300 } as PptxSlide["transition"],
    });
    const deps = createMockDeps({ slides: [slide, createMockSlide()] });
    executeSlideTransition(1, deps);

    expect(deps.setPresentationSlideIndex).not.toHaveBeenCalled();

    // Advance past transition duration (clamped to max 480)
    vi.advanceTimersByTime(310);
    expect(deps.setPresentationSlideIndex).toHaveBeenCalledWith(1);
  });

  it("should make next slide visible after transition", () => {
    const deps = createMockDeps();
    executeSlideTransition(1, deps);

    vi.advanceTimersByTime(500);
    expect(deps.setPresentationSlideVisible).toHaveBeenCalledWith(true);
  });

  it("should set active slide index after transition", () => {
    const deps = createMockDeps();
    executeSlideTransition(1, deps);

    vi.advanceTimersByTime(500);
    expect(deps.onSetActiveSlideIndex).toHaveBeenCalledWith(1);
  });

  it("should run entrance animations after transition", () => {
    const deps = createMockDeps();
    executeSlideTransition(1, deps);

    vi.advanceTimersByTime(500);
    expect(deps.runPresentationEntranceAnimations).toHaveBeenCalledWith(1);
  });

  it("should schedule auto-advance for the next slide", () => {
    const deps = createMockDeps();
    executeSlideTransition(1, deps);

    vi.advanceTimersByTime(500);
    expect(deps.scheduleAutoAdvanceForSlide).toHaveBeenCalledWith(1);
  });

  it("should push timer to presentationTimersRef", () => {
    const deps = createMockDeps();
    executeSlideTransition(1, deps);
    expect(deps.presentationTimersRef.current).toHaveLength(1);
  });

  it("should use minimum transition duration of 120ms", () => {
    const slide = createMockSlide({
      transition: { durationMs: 50 } as PptxSlide["transition"],
    });
    const deps = createMockDeps({ slides: [slide, createMockSlide()] });
    executeSlideTransition(1, deps);

    // At 100ms, transition should NOT have fired yet (minimum is 120)
    vi.advanceTimersByTime(100);
    expect(deps.setPresentationSlideIndex).not.toHaveBeenCalled();

    // At 130ms, the timer fires
    vi.advanceTimersByTime(30);
    expect(deps.setPresentationSlideIndex).toHaveBeenCalledWith(1);
  });

  it("should cap transition duration at 480ms", () => {
    const slide = createMockSlide({
      transition: { durationMs: 2000 } as PptxSlide["transition"],
    });
    const deps = createMockDeps({ slides: [slide, createMockSlide()] });
    executeSlideTransition(1, deps);

    // At 480ms, the transition should complete (not wait for 2000ms)
    vi.advanceTimersByTime(490);
    expect(deps.setPresentationSlideIndex).toHaveBeenCalledWith(1);
  });
});
