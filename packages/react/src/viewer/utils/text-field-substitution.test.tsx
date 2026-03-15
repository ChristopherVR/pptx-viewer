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

  // ── Footer field ─────────────────────────────────────────────────

  it("substitutes footer text from context", () => {
    const result = substituteFieldText("<footer>", "footer", {
      footerText: "Confidential",
    });
    expect(result).toBe("Confidential");
  });

  it("is case-insensitive for footer field type", () => {
    const result = substituteFieldText("", "Footer", {
      footerText: "Company Inc.",
    });
    expect(result).toBe("Company Inc.");
  });

  it("returns original text when footer field but no footerText in ctx", () => {
    const result = substituteFieldText("original", "footer", {});
    expect(result).toBe("original");
  });

  // ── Header field ─────────────────────────────────────────────────

  it("substitutes header text from context", () => {
    const result = substituteFieldText("<header>", "header", {
      headerText: "Q4 Report",
    });
    expect(result).toBe("Q4 Report");
  });

  it("is case-insensitive for header field type", () => {
    const result = substituteFieldText("", "Header", {
      headerText: "Draft",
    });
    expect(result).toBe("Draft");
  });

  it("returns original text when header field but no headerText in ctx", () => {
    const result = substituteFieldText("original", "header", {});
    expect(result).toBe("original");
  });

  // ── Current date field ───────────────────────────────────────────

  it("substitutes currentDate with locale-formatted date", () => {
    const result = substituteFieldText("placeholder", "currentDate", {});
    // Should return a non-empty locale-formatted date string
    expect(result.length).toBeGreaterThan(0);
    // The date should contain "2026" since we've fixed the system time
    expect(result).toContain("2026");
  });

  it("is case-insensitive for currentDate field type", () => {
    const result = substituteFieldText("", "CURRENTDATE", {});
    expect(result.length).toBeGreaterThan(0);
  });

  it("uses locale from context for currentDate", () => {
    const result = substituteFieldText("placeholder", "currentdate", {
      locale: "en-US",
    });
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain("2026");
  });

  // ── Current time field ───────────────────────────────────────────

  it("substitutes currentTime with locale-formatted time", () => {
    const result = substituteFieldText("placeholder", "currentTime", {});
    // Should return a non-empty locale-formatted time string
    expect(result.length).toBeGreaterThan(0);
  });

  it("is case-insensitive for currentTime field type", () => {
    const result = substituteFieldText("", "CURRENTTIME", {});
    expect(result.length).toBeGreaterThan(0);
  });

  it("uses locale from context for currentTime", () => {
    const result = substituteFieldText("placeholder", "currenttime", {
      locale: "en-US",
    });
    expect(result.length).toBeGreaterThan(0);
  });

  // ── Document property field ──────────────────────────────────────

  it("substitutes docproperty field with matching custom property", () => {
    const result = substituteFieldText("placeholder", "docproperty.Project", {
      customProperties: [
        { name: "Project", value: "pptx" },
        { name: "Department", value: "Engineering" },
      ],
    });
    expect(result).toBe("pptx");
  });

  it("is case-insensitive for docproperty name matching", () => {
    const result = substituteFieldText(
      "placeholder",
      "docproperty.project",
      {
        customProperties: [{ name: "Project", value: "pptx" }],
      },
    );
    expect(result).toBe("pptx");
  });

  it("returns original text when docproperty has no matching property", () => {
    const result = substituteFieldText(
      "original",
      "docproperty.NonExistent",
      {
        customProperties: [{ name: "Project", value: "pptx" }],
      },
    );
    expect(result).toBe("original");
  });

  it("returns original text when docproperty has no property name", () => {
    const result = substituteFieldText("original", "docproperty", {
      customProperties: [{ name: "Project", value: "pptx" }],
    });
    expect(result).toBe("original");
  });

  it("returns original text when docproperty but no customProperties in ctx", () => {
    const result = substituteFieldText(
      "original",
      "docproperty.Project",
      {},
    );
    expect(result).toBe("original");
  });

  // ── Slide title field ────────────────────────────────────────────

  it("substitutes slideTitle text from context", () => {
    const result = substituteFieldText("<title>", "slideTitle", {
      slideTitle: "Quarterly Review",
    });
    expect(result).toBe("Quarterly Review");
  });

  it("is case-insensitive for slideTitle field type", () => {
    const result = substituteFieldText("", "SLIDETITLE", {
      slideTitle: "Introduction",
    });
    expect(result).toBe("Introduction");
  });

  it("returns original text when slideTitle field but no slideTitle in ctx", () => {
    const result = substituteFieldText("original", "slideTitle", {});
    expect(result).toBe("original");
  });

  // ── Edge cases ───────────────────────────────────────────────────

  it("substitutes footer with empty string value", () => {
    const result = substituteFieldText("<footer>", "footer", {
      footerText: "",
    });
    expect(result).toBe("");
  });

  it("substitutes header with empty string value", () => {
    const result = substituteFieldText("<header>", "header", {
      headerText: "",
    });
    expect(result).toBe("");
  });

  it("does not substitute currentdate when no context provided", () => {
    expect(substituteFieldText("original", "currentdate")).toBe("original");
  });

  it("does not substitute currenttime when no context provided", () => {
    expect(substituteFieldText("original", "currenttime")).toBe("original");
  });
});
