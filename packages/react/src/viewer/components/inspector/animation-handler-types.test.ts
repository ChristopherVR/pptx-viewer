import { describe, it, expect } from "vitest";
import { DIRECTIONAL_PRESETS } from "./animation-handler-types";

// ---------------------------------------------------------------------------
// DIRECTIONAL_PRESETS
// ---------------------------------------------------------------------------

describe("DIRECTIONAL_PRESETS", () => {
  it("is a Set", () => {
    expect(DIRECTIONAL_PRESETS).toBeInstanceOf(Set);
  });

  it("contains flyIn", () => {
    expect(DIRECTIONAL_PRESETS.has("flyIn")).toBe(true);
  });

  it("contains flyOut", () => {
    expect(DIRECTIONAL_PRESETS.has("flyOut")).toBe(true);
  });

  it("has exactly 2 entries", () => {
    expect(DIRECTIONAL_PRESETS.size).toBe(2);
  });

  it("does not contain non-directional presets", () => {
    expect(DIRECTIONAL_PRESETS.has("fadeIn")).toBe(false);
    expect(DIRECTIONAL_PRESETS.has("fadeOut")).toBe(false);
    expect(DIRECTIONAL_PRESETS.has("spin")).toBe(false);
    expect(DIRECTIONAL_PRESETS.has("zoomIn")).toBe(false);
  });
});
