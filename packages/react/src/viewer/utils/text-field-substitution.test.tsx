import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  resolveFieldDateText,
  substituteFieldText,
} from "./text-field-substitution";

// Fix the date to 2026-03-14 10:30:45 (Saturday) for deterministic tests
const FIXED_DATE = new Date(2026, 2, 14, 10, 30, 45); // March 14, 2026 at 10:30:45 AM

describe("resolveFieldDateText", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_DATE);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses explicit dateFormat when provided", () => {
    const result = resolveFieldDateText("datetime1", "yyyy/MM/dd");
    expect(result).toBe("2026/03/14");
  });

  it("uses datetime1 format (M/d/yyyy)", () => {
    const result = resolveFieldDateText("datetime1");
    expect(result).toBe("3/14/2026");
  });

  it("uses datetime2 format (EEEE, MMMM d, yyyy)", () => {
    const result = resolveFieldDateText("datetime2");
    expect(result).toBe("Saturday, March 14, 2026");
  });

  it("uses datetime3 format (d MMMM yyyy)", () => {
    const result = resolveFieldDateText("datetime3");
    expect(result).toBe("14 March 2026");
  });

  it("uses datetime5 format (dd-MMM-yy)", () => {
    const result = resolveFieldDateText("datetime5");
    expect(result).toBe("14-Mar-26");
  });

  it("uses datetime6 format (MMMM yy)", () => {
    const result = resolveFieldDateText("datetime6");
    expect(result).toBe("March 26");
  });

  it("uses datetime10 format (H:mm) for 24h time", () => {
    const result = resolveFieldDateText("datetime10");
    expect(result).toBe("10:30");
  });

  it("uses datetime12 format (h:mm a) for 12h time", () => {
    const result = resolveFieldDateText("datetime12");
    expect(result).toBe("10:30 AM");
  });

  it("is case-insensitive for field type", () => {
    const result = resolveFieldDateText("DateTime1");
    expect(result).toBe("3/14/2026");
  });

  it("falls back to locale string for unknown field type", () => {
    const result = resolveFieldDateText("unknownType");
    // Just verify it returns a non-empty string (locale-dependent)
    expect(result.length).toBeGreaterThan(0);
  });
});

// ── substituteFieldText ───────────────────────────────────────────────

describe("substituteFieldText", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_DATE);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns original text when fieldType is undefined", () => {
    expect(substituteFieldText("hello", undefined)).toBe("hello");
  });

  it("returns original text when no context is provided", () => {
    expect(substituteFieldText("hello", "slidenum")).toBe("hello");
  });

  it("substitutes slide number", () => {
    const result = substituteFieldText("<#>", "slidenum", {
      slideNumber: 5,
    });
    expect(result).toBe("5");
  });

  it("is case-insensitive for slidenum field type", () => {
    const result = substituteFieldText("", "SlideNum", {
      slideNumber: 12,
    });
    expect(result).toBe("12");
  });

  it("substitutes datetime field", () => {
    const result = substituteFieldText("placeholder", "datetime1", {});
    expect(result).toBe("3/14/2026");
  });

  it("uses dateFormat from context for datetime fields", () => {
    const result = substituteFieldText("placeholder", "datetime1", {
      dateFormat: "dd/MM/yyyy",
    });
    expect(result).toBe("14/03/2026");
  });

  it("returns original text for unrecognized field type", () => {
    const result = substituteFieldText("keep me", "somethingElse", {});
    expect(result).toBe("keep me");
  });

  it("returns original text when slidenum field but no slideNumber in ctx", () => {
    const result = substituteFieldText("original", "slidenum", {});
    expect(result).toBe("original");
  });
});
