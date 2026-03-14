import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { applyAnimationGroupSteps } from "./animation-helpers";
import type { TimelineClickGroup } from "../../utils/animation-timeline";

vi.mock("../../utils/animation-sound", () => ({
  stopAnimationSound: vi.fn(),
}));

function createMockStep(overrides: Partial<TimelineClickGroup["steps"][0]> = {}) {
  return {
    elementId: "el-1",
    presetClass: "entr" as const,
    cssAnimation: "fadeIn 0.5s ease",
    keyframeName: "fadeIn",
    trigger: "onClick" as const,
    fillMode: "both" as const,
    delayMs: 0,
    durationMs: 500,
    stopSound: false,
    soundPath: undefined as string | undefined,
    ...overrides,
  };
}

describe("applyAnimationGroupSteps", () => {
  let setPresentationElementStates: ReturnType<typeof vi.fn>;
  let presentationTimersRef: { current: number[] };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("window", {
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
    });
    setPresentationElementStates = vi.fn((updater) => {
      // Execute the updater to test its logic
      if (typeof updater === "function") {
        updater(new Map());
      }
    });
    presentationTimersRef = { current: [] };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("should call setPresentationElementStates with CSS animation", () => {
    const group: TimelineClickGroup = {
      totalDurationMs: 500,
      steps: [createMockStep()],
    };
    applyAnimationGroupSteps(
      group,
      undefined,
      setPresentationElementStates,
      presentationTimersRef,
    );
    // Called once for initial CSS animation state
    expect(setPresentationElementStates).toHaveBeenCalledTimes(1);
  });

  it("should schedule cleanup timers for each step", () => {
    const group: TimelineClickGroup = {
      totalDurationMs: 500,
      steps: [
        createMockStep({ elementId: "el-1", durationMs: 300 }),
        createMockStep({ elementId: "el-2", durationMs: 500 }),
      ],
    };
    applyAnimationGroupSteps(
      group,
      undefined,
      setPresentationElementStates,
      presentationTimersRef,
    );
    expect(presentationTimersRef.current).toHaveLength(2);
  });

  it("should play sound when step has soundPath", () => {
    const onPlayActionSound = vi.fn();
    const group: TimelineClickGroup = {
      totalDurationMs: 500,
      steps: [createMockStep({ soundPath: "click.wav" })],
    };
    applyAnimationGroupSteps(
      group,
      onPlayActionSound,
      setPresentationElementStates,
      presentationTimersRef,
    );
    expect(onPlayActionSound).toHaveBeenCalledWith("click.wav");
  });

  it("should not call onPlayActionSound when it is undefined", () => {
    const group: TimelineClickGroup = {
      totalDurationMs: 500,
      steps: [createMockStep({ soundPath: "click.wav" })],
    };
    // Should not throw
    expect(() =>
      applyAnimationGroupSteps(
        group,
        undefined,
        setPresentationElementStates,
        presentationTimersRef,
      ),
    ).not.toThrow();
  });

  it("should set visible=true for entrance animations", () => {
    let capturedState: Map<string, { visible: boolean; cssAnimation?: string }> | undefined;
    const stateSetter = vi.fn((updater: unknown) => {
      if (typeof updater === "function") {
        capturedState = (updater as (prev: Map<string, { visible: boolean; cssAnimation?: string }>) => Map<string, { visible: boolean; cssAnimation?: string }>)(new Map());
      }
    });
    const group: TimelineClickGroup = {
      totalDurationMs: 500,
      steps: [createMockStep({ presetClass: "entr" })],
    };
    applyAnimationGroupSteps(group, undefined, stateSetter, presentationTimersRef);
    expect(capturedState).toBeDefined();
    const state = capturedState!.get("el-1");
    expect(state?.visible).toBe(true);
    expect(state?.cssAnimation).toBe("fadeIn 0.5s ease");
  });

  it("should keep current visibility for exit animations initially", () => {
    let capturedState: Map<string, { visible: boolean; cssAnimation?: string }> | undefined;
    const stateSetter = vi.fn((updater: unknown) => {
      if (typeof updater === "function") {
        const prev = new Map<string, { visible: boolean; cssAnimation?: string }>();
        prev.set("el-1", { visible: true, cssAnimation: undefined });
        capturedState = (updater as (prev: Map<string, { visible: boolean; cssAnimation?: string }>) => Map<string, { visible: boolean; cssAnimation?: string }>)(prev);
      }
    });
    const group: TimelineClickGroup = {
      totalDurationMs: 500,
      steps: [
        createMockStep({
          presetClass: "exit",
          cssAnimation: "fadeOut 0.5s ease",
        }),
      ],
    };
    applyAnimationGroupSteps(group, undefined, stateSetter, presentationTimersRef);
    const state = capturedState!.get("el-1");
    // Exit keeps current visible state during animation
    expect(state?.visible).toBe(true);
    expect(state?.cssAnimation).toBe("fadeOut 0.5s ease");
  });

  it("should clear CSS animation and set visible=false for exit after timer fires", () => {
    let capturedCleanupState: Map<string, { visible: boolean; cssAnimation?: string }> | undefined;
    const stateSetter = vi.fn((updater: unknown) => {
      if (typeof updater === "function") {
        const prev = new Map<string, { visible: boolean; cssAnimation?: string }>();
        prev.set("el-1", { visible: true, cssAnimation: "fadeOut 0.5s ease" });
        capturedCleanupState = (updater as (prev: Map<string, { visible: boolean; cssAnimation?: string }>) => Map<string, { visible: boolean; cssAnimation?: string }>)(prev);
      }
    });
    const group: TimelineClickGroup = {
      totalDurationMs: 500,
      steps: [
        createMockStep({
          presetClass: "exit",
          durationMs: 500,
          delayMs: 0,
          cssAnimation: "fadeOut 0.5s ease",
        }),
      ],
    };
    applyAnimationGroupSteps(group, undefined, stateSetter, presentationTimersRef);

    // Advance past durationMs + delayMs + 8
    vi.advanceTimersByTime(510);

    // The cleanup timer should have fired
    expect(stateSetter).toHaveBeenCalledTimes(2); // once for initial, once for cleanup
    const state = capturedCleanupState!.get("el-1");
    expect(state?.visible).toBe(false);
    expect(state?.cssAnimation).toBeUndefined();
  });

  it("should handle stopSound flag", () => {
    // We can't easily mock stopAnimationSound, but we can verify it doesn't throw
    const group: TimelineClickGroup = {
      totalDurationMs: 500,
      steps: [createMockStep({ stopSound: true })],
    };
    expect(() =>
      applyAnimationGroupSteps(
        group,
        undefined,
        setPresentationElementStates,
        presentationTimersRef,
      ),
    ).not.toThrow();
  });

  it("should handle multiple steps in a single group", () => {
    const group: TimelineClickGroup = {
      totalDurationMs: 600,
      steps: [
        createMockStep({ elementId: "el-1", durationMs: 200 }),
        createMockStep({ elementId: "el-2", durationMs: 400 }),
        createMockStep({ elementId: "el-3", durationMs: 600 }),
      ],
    };
    applyAnimationGroupSteps(
      group,
      undefined,
      setPresentationElementStates,
      presentationTimersRef,
    );
    expect(presentationTimersRef.current).toHaveLength(3);
  });
});
