import { describe, it, expect } from "vitest";
import {
  AUTO_HIDE_DELAY_MS,
  BOTTOM_TRIGGER_FRACTION,
  isInBottomTriggerZone,
  shouldAutoHide,
  formatSlideCounter,
} from "./presentation-toolbar-utils";

// ---------------------------------------------------------------------------
// isInBottomTriggerZone
// ---------------------------------------------------------------------------

describe("isInBottomTriggerZone", () => {
  const containerHeight = 1000;
  const containerTop = 0;

  it("returns true when mouse is at the very bottom of the container", () => {
    expect(isInBottomTriggerZone(999, containerHeight, containerTop)).toBe(
      true,
    );
  });

  it("returns true when mouse is exactly at the trigger threshold", () => {
    const threshold = containerHeight * (1 - BOTTOM_TRIGGER_FRACTION);
    expect(
      isInBottomTriggerZone(threshold, containerHeight, containerTop),
    ).toBe(true);
  });

  it("returns false when mouse is above the trigger zone", () => {
    // With 15% trigger zone on a 1000px container, threshold is 850px
    expect(isInBottomTriggerZone(500, containerHeight, containerTop)).toBe(
      false,
    );
    expect(isInBottomTriggerZone(0, containerHeight, containerTop)).toBe(false);
    expect(isInBottomTriggerZone(849, containerHeight, containerTop)).toBe(
      false,
    );
  });

  it("returns false when mouse is below the container", () => {
    expect(isInBottomTriggerZone(1001, containerHeight, containerTop)).toBe(
      false,
    );
  });

  it("accounts for containerTop offset", () => {
    const offset = 200;
    // Mouse at 1100 with containerTop=200: relativeY = 900, which is >= 850
    expect(isInBottomTriggerZone(1100, containerHeight, offset)).toBe(true);
    // Mouse at 800 with containerTop=200: relativeY = 600, which is < 850
    expect(isInBottomTriggerZone(800, containerHeight, offset)).toBe(false);
  });

  it("handles small container heights", () => {
    const smallHeight = 100;
    // Threshold = 85px
    expect(isInBottomTriggerZone(90, smallHeight, 0)).toBe(true);
    expect(isInBottomTriggerZone(80, smallHeight, 0)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// shouldAutoHide
// ---------------------------------------------------------------------------

describe("shouldAutoHide", () => {
  it("returns false when no time has elapsed", () => {
    const now = Date.now();
    expect(shouldAutoHide(now, now)).toBe(false);
  });

  it("returns false when less than AUTO_HIDE_DELAY_MS has passed", () => {
    const now = Date.now();
    expect(shouldAutoHide(now, now + AUTO_HIDE_DELAY_MS - 1)).toBe(false);
  });

  it("returns true when exactly AUTO_HIDE_DELAY_MS has passed", () => {
    const now = Date.now();
    expect(shouldAutoHide(now, now + AUTO_HIDE_DELAY_MS)).toBe(true);
  });

  it("returns true when more than AUTO_HIDE_DELAY_MS has passed", () => {
    const now = Date.now();
    expect(shouldAutoHide(now, now + AUTO_HIDE_DELAY_MS + 5000)).toBe(true);
  });

  it("uses the correct delay constant of 3000ms", () => {
    expect(AUTO_HIDE_DELAY_MS).toBe(3000);
  });
});

// ---------------------------------------------------------------------------
// formatSlideCounter
// ---------------------------------------------------------------------------

describe("formatSlideCounter", () => {
  it("formats first slide of a presentation", () => {
    expect(formatSlideCounter(0, 10)).toBe("1 / 10");
  });

  it("formats last slide of a presentation", () => {
    expect(formatSlideCounter(9, 10)).toBe("10 / 10");
  });

  it("formats single slide presentation", () => {
    expect(formatSlideCounter(0, 1)).toBe("1 / 1");
  });

  it("formats middle slide", () => {
    expect(formatSlideCounter(4, 20)).toBe("5 / 20");
  });

  it("handles large slide counts", () => {
    expect(formatSlideCounter(99, 100)).toBe("100 / 100");
  });
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("constants", () => {
  it("AUTO_HIDE_DELAY_MS is 3 seconds", () => {
    expect(AUTO_HIDE_DELAY_MS).toBe(3000);
  });

  it("BOTTOM_TRIGGER_FRACTION is 15%", () => {
    expect(BOTTOM_TRIGGER_FRACTION).toBe(0.15);
  });
});
