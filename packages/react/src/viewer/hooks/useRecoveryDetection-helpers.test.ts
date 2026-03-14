import { describe, it, expect } from "vitest";
import {
  shouldCheckRecovery,
  isRecentRecovery,
  hasRecentRecoveryVersion,
  RECOVERY_WINDOW_MS,
  type RecoveryCheckInput,
} from "./useRecoveryDetection-helpers";

// ---------------------------------------------------------------------------
// shouldCheckRecovery
// ---------------------------------------------------------------------------

describe("shouldCheckRecovery", () => {
  const base: RecoveryCheckInput = {
    alreadyChecked: false,
    filePath: "/path/to/file.pptx",
    loading: false,
    error: null,
    slideCount: 5,
  };

  it("returns true when all preconditions are met", () => {
    expect(shouldCheckRecovery(base)).toBe(true);
  });

  it("returns false when already checked", () => {
    expect(shouldCheckRecovery({ ...base, alreadyChecked: true })).toBe(false);
  });

  it("returns false when filePath is undefined", () => {
    expect(shouldCheckRecovery({ ...base, filePath: undefined })).toBe(false);
  });

  it("returns false when filePath is empty string", () => {
    expect(shouldCheckRecovery({ ...base, filePath: "" })).toBe(false);
  });

  it("returns false when loading", () => {
    expect(shouldCheckRecovery({ ...base, loading: true })).toBe(false);
  });

  it("returns false when there is an error", () => {
    expect(
      shouldCheckRecovery({ ...base, error: "Something went wrong" }),
    ).toBe(false);
  });

  it("returns false when slideCount is 0", () => {
    expect(shouldCheckRecovery({ ...base, slideCount: 0 })).toBe(false);
  });

  it("returns true when slideCount is 1", () => {
    expect(shouldCheckRecovery({ ...base, slideCount: 1 })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isRecentRecovery
// ---------------------------------------------------------------------------

describe("isRecentRecovery", () => {
  it("returns true when timestamp is within 24 hours", () => {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    expect(isRecentRecovery(oneHourAgo, now)).toBe(true);
  });

  it("returns true when timestamp is just under 24 hours ago", () => {
    const now = Date.now();
    const justUnder24h = now - RECOVERY_WINDOW_MS + 1000;
    expect(isRecentRecovery(justUnder24h, now)).toBe(true);
  });

  it("returns false when timestamp is exactly 24 hours ago", () => {
    const now = Date.now();
    const exactly24h = now - RECOVERY_WINDOW_MS;
    expect(isRecentRecovery(exactly24h, now)).toBe(false);
  });

  it("returns false when timestamp is more than 24 hours ago", () => {
    const now = Date.now();
    const twoDaysAgo = now - 2 * RECOVERY_WINDOW_MS;
    expect(isRecentRecovery(twoDaysAgo, now)).toBe(false);
  });

  it("returns true when timestamp is in the future", () => {
    const now = Date.now();
    const future = now + 1000;
    expect(isRecentRecovery(future, now)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// hasRecentRecoveryVersion
// ---------------------------------------------------------------------------

describe("hasRecentRecoveryVersion", () => {
  it("returns false for empty versions array", () => {
    expect(hasRecentRecoveryVersion([], Date.now())).toBe(false);
  });

  it("returns true when the first version is recent", () => {
    const now = Date.now();
    const versions = [{ timestamp: now - 1000 }];
    expect(hasRecentRecoveryVersion(versions, now)).toBe(true);
  });

  it("returns false when the first version is too old", () => {
    const now = Date.now();
    const versions = [{ timestamp: now - RECOVERY_WINDOW_MS - 1000 }];
    expect(hasRecentRecoveryVersion(versions, now)).toBe(false);
  });

  it("only checks the first version (most-recent-first assumption)", () => {
    const now = Date.now();
    // First version is old, second is recent
    const versions = [
      { timestamp: now - RECOVERY_WINDOW_MS - 1000 },
      { timestamp: now - 1000 },
    ];
    expect(hasRecentRecoveryVersion(versions, now)).toBe(false);
  });

  it("returns true when first of multiple versions is recent", () => {
    const now = Date.now();
    const versions = [
      { timestamp: now - 1000 },
      { timestamp: now - RECOVERY_WINDOW_MS - 1000 },
    ];
    expect(hasRecentRecoveryVersion(versions, now)).toBe(true);
  });
});
