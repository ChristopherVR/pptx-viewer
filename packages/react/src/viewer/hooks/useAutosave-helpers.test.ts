import { describe, it, expect } from "vitest";
import {
  computeAutosaveIntervalMs,
  canAutosave,
  getAutosaveStatusLabel,
  DEFAULT_AUTOSAVE_INTERVAL_SECONDS,
  MIN_AUTOSAVE_INTERVAL_SECONDS,
  type CanAutosaveInput,
  type AutosaveState,
} from "./useAutosave-helpers";

// ---------------------------------------------------------------------------
// computeAutosaveIntervalMs
// ---------------------------------------------------------------------------

describe("computeAutosaveIntervalMs", () => {
  it("returns the interval in milliseconds for values above minimum", () => {
    expect(computeAutosaveIntervalMs(120)).toBe(120_000);
  });

  it("clamps to minimum when value is below 10 seconds", () => {
    expect(computeAutosaveIntervalMs(5)).toBe(MIN_AUTOSAVE_INTERVAL_SECONDS * 1000);
  });

  it("clamps to minimum for zero", () => {
    expect(computeAutosaveIntervalMs(0)).toBe(MIN_AUTOSAVE_INTERVAL_SECONDS * 1000);
  });

  it("clamps to minimum for negative values", () => {
    expect(computeAutosaveIntervalMs(-30)).toBe(MIN_AUTOSAVE_INTERVAL_SECONDS * 1000);
  });

  it("returns exactly minimum for 10 seconds", () => {
    expect(computeAutosaveIntervalMs(10)).toBe(10_000);
  });

  it("handles large values", () => {
    expect(computeAutosaveIntervalMs(3600)).toBe(3_600_000);
  });

  it("handles fractional seconds", () => {
    expect(computeAutosaveIntervalMs(15.5)).toBe(15_500);
  });
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("autosave constants", () => {
  it("DEFAULT_AUTOSAVE_INTERVAL_SECONDS is 120", () => {
    expect(DEFAULT_AUTOSAVE_INTERVAL_SECONDS).toBe(120);
  });

  it("MIN_AUTOSAVE_INTERVAL_SECONDS is 10", () => {
    expect(MIN_AUTOSAVE_INTERVAL_SECONDS).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// canAutosave
// ---------------------------------------------------------------------------

describe("canAutosave", () => {
  const base: CanAutosaveInput = {
    enabled: true,
    filePath: "/path/to/file.pptx",
    isDirty: true,
    isSaving: false,
    hasElectronApi: true,
  };

  it("returns true when all conditions are met", () => {
    expect(canAutosave(base)).toBe(true);
  });

  it("returns false when not enabled", () => {
    expect(canAutosave({ ...base, enabled: false })).toBe(false);
  });

  it("returns false when filePath is undefined", () => {
    expect(canAutosave({ ...base, filePath: undefined })).toBe(false);
  });

  it("returns false when filePath is empty string", () => {
    expect(canAutosave({ ...base, filePath: "" })).toBe(false);
  });

  it("returns false when not dirty", () => {
    expect(canAutosave({ ...base, isDirty: false })).toBe(false);
  });

  it("returns false when already saving", () => {
    expect(canAutosave({ ...base, isSaving: true })).toBe(false);
  });

  it("returns false when Electron API is not available", () => {
    expect(canAutosave({ ...base, hasElectronApi: false })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getAutosaveStatusLabel
// ---------------------------------------------------------------------------

describe("getAutosaveStatusLabel", () => {
  const cases: Array<[AutosaveState, string]> = [
    ["idle", "Idle"],
    ["saving", "Saving..."],
    ["saved", "Saved"],
    ["error", "Error"],
  ];

  it.each(cases)('returns "%s" for state "%s"', (state, expected) => {
    expect(getAutosaveStatusLabel(state)).toBe(expected);
  });
});
