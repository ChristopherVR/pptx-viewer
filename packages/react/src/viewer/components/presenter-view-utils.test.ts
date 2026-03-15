import { describe, it, expect } from "vitest";
import {
  formatElapsed,
  clampNotesFontSize,
  NOTES_FONT_SIZE_MIN,
  NOTES_FONT_SIZE_MAX,
  NOTES_FONT_SIZE_DEFAULT,
  NOTES_FONT_SIZE_STEP,
} from "./presenter-view-utils";

// ---------------------------------------------------------------------------
// formatElapsed
// ---------------------------------------------------------------------------

describe("formatElapsed", () => {
  it("should format 0 ms as 00:00", () => {
    expect(formatElapsed(0)).toBe("00:00");
  });

  it("should format 1000 ms as 00:01", () => {
    expect(formatElapsed(1000)).toBe("00:01");
  });

  it("should format 60000 ms as 01:00", () => {
    expect(formatElapsed(60000)).toBe("01:00");
  });

  it("should format 90000 ms as 01:30", () => {
    expect(formatElapsed(90000)).toBe("01:30");
  });

  it("should pad single-digit minutes and seconds", () => {
    expect(formatElapsed(5000)).toBe("00:05");
    expect(formatElapsed(65000)).toBe("01:05");
  });

  it("should switch to HH:MM:SS when >= 1 hour", () => {
    // 3600 seconds = exactly 1 hour
    expect(formatElapsed(3600000)).toBe("01:00:00");
  });

  it("should format large values with hours correctly", () => {
    // 3661 seconds = 1 hour, 1 minute, 1 second
    expect(formatElapsed(3661000)).toBe("01:01:01");
  });

  it("should format 2 hours 30 minutes 45 seconds", () => {
    const ms = (2 * 3600 + 30 * 60 + 45) * 1000;
    expect(formatElapsed(ms)).toBe("02:30:45");
  });

  it("should use MM:SS for values just under 1 hour", () => {
    // 59:59
    expect(formatElapsed(3599000)).toBe("59:59");
  });

  it("should truncate sub-second values (floor)", () => {
    expect(formatElapsed(1500)).toBe("00:01");
    expect(formatElapsed(999)).toBe("00:00");
  });

  it("should format 10 minutes exactly", () => {
    expect(formatElapsed(600000)).toBe("10:00");
  });
});

// ---------------------------------------------------------------------------
// clampNotesFontSize
// ---------------------------------------------------------------------------

describe("clampNotesFontSize", () => {
  it("returns the value when within range", () => {
    expect(clampNotesFontSize(16)).toBe(16);
    expect(clampNotesFontSize(NOTES_FONT_SIZE_DEFAULT)).toBe(
      NOTES_FONT_SIZE_DEFAULT,
    );
  });

  it("clamps to minimum when below range", () => {
    expect(clampNotesFontSize(0)).toBe(NOTES_FONT_SIZE_MIN);
    expect(clampNotesFontSize(-5)).toBe(NOTES_FONT_SIZE_MIN);
    expect(clampNotesFontSize(NOTES_FONT_SIZE_MIN - 1)).toBe(
      NOTES_FONT_SIZE_MIN,
    );
  });

  it("clamps to maximum when above range", () => {
    expect(clampNotesFontSize(100)).toBe(NOTES_FONT_SIZE_MAX);
    expect(clampNotesFontSize(NOTES_FONT_SIZE_MAX + 1)).toBe(
      NOTES_FONT_SIZE_MAX,
    );
  });

  it("returns exact boundary values", () => {
    expect(clampNotesFontSize(NOTES_FONT_SIZE_MIN)).toBe(NOTES_FONT_SIZE_MIN);
    expect(clampNotesFontSize(NOTES_FONT_SIZE_MAX)).toBe(NOTES_FONT_SIZE_MAX);
  });
});

// ---------------------------------------------------------------------------
// Font size constants
// ---------------------------------------------------------------------------

describe("font size constants", () => {
  it("NOTES_FONT_SIZE_MIN is less than MAX", () => {
    expect(NOTES_FONT_SIZE_MIN).toBeLessThan(NOTES_FONT_SIZE_MAX);
  });

  it("NOTES_FONT_SIZE_DEFAULT is within range", () => {
    expect(NOTES_FONT_SIZE_DEFAULT).toBeGreaterThanOrEqual(
      NOTES_FONT_SIZE_MIN,
    );
    expect(NOTES_FONT_SIZE_DEFAULT).toBeLessThanOrEqual(NOTES_FONT_SIZE_MAX);
  });

  it("NOTES_FONT_SIZE_STEP is positive", () => {
    expect(NOTES_FONT_SIZE_STEP).toBeGreaterThan(0);
  });

  it("stepping from MIN reaches MAX in a finite number of steps", () => {
    const steps = Math.ceil(
      (NOTES_FONT_SIZE_MAX - NOTES_FONT_SIZE_MIN) / NOTES_FONT_SIZE_STEP,
    );
    expect(steps).toBeGreaterThan(0);
    expect(steps).toBeLessThan(100); // sanity check
  });
});
