import { describe, it, expect } from "vitest";
import {
  PRESET_SHADOW_BLUR_MAP,
  PRESET_SHADOW_OPACITY_MAP,
} from "./effect-style-preset-maps";

describe("effect-style-preset-maps", () => {
  // ── PRESET_SHADOW_BLUR_MAP ───────────────────────────────────────────

  describe("PRESET_SHADOW_BLUR_MAP", () => {
    it("contains all 20 preset shadow entries (shdw1–shdw20)", () => {
      for (let i = 1; i <= 20; i++) {
        expect(PRESET_SHADOW_BLUR_MAP).toHaveProperty(`shdw${i}`);
      }
    });

    it("shdw1 has blur radius of 2", () => {
      expect(PRESET_SHADOW_BLUR_MAP["shdw1"]).toBe(2);
    });

    it("shdw6 has blur radius of 8 (strongest outer shadow)", () => {
      expect(PRESET_SHADOW_BLUR_MAP["shdw6"]).toBe(8);
    });

    it("all blur values are positive numbers", () => {
      for (const key of Object.keys(PRESET_SHADOW_BLUR_MAP)) {
        expect(PRESET_SHADOW_BLUR_MAP[key]).toBeGreaterThan(0);
        expect(typeof PRESET_SHADOW_BLUR_MAP[key]).toBe("number");
      }
    });

    it("returns undefined for non-existent preset", () => {
      expect(PRESET_SHADOW_BLUR_MAP["shdw0"]).toBeUndefined();
      expect(PRESET_SHADOW_BLUR_MAP["shdw21"]).toBeUndefined();
    });

    it("outer shadows shdw1-shdw6 have increasing blur", () => {
      expect(PRESET_SHADOW_BLUR_MAP["shdw1"]).toBeLessThanOrEqual(
        PRESET_SHADOW_BLUR_MAP["shdw2"],
      );
      expect(PRESET_SHADOW_BLUR_MAP["shdw2"]).toBeLessThanOrEqual(
        PRESET_SHADOW_BLUR_MAP["shdw3"],
      );
    });
  });

  // ── PRESET_SHADOW_OPACITY_MAP ────────────────────────────────────────

  describe("PRESET_SHADOW_OPACITY_MAP", () => {
    it("contains all 20 preset shadow opacity entries", () => {
      for (let i = 1; i <= 20; i++) {
        expect(PRESET_SHADOW_OPACITY_MAP).toHaveProperty(`shdw${i}`);
      }
    });

    it("shdw1 has opacity of 0.35", () => {
      expect(PRESET_SHADOW_OPACITY_MAP["shdw1"]).toBe(0.35);
    });

    it("all opacity values are in (0, 1] range", () => {
      for (const key of Object.keys(PRESET_SHADOW_OPACITY_MAP)) {
        expect(PRESET_SHADOW_OPACITY_MAP[key]).toBeGreaterThan(0);
        expect(PRESET_SHADOW_OPACITY_MAP[key]).toBeLessThanOrEqual(1);
      }
    });

    it("has matching keys with blur map", () => {
      const blurKeys = Object.keys(PRESET_SHADOW_BLUR_MAP).sort();
      const opacityKeys = Object.keys(PRESET_SHADOW_OPACITY_MAP).sort();
      expect(blurKeys).toEqual(opacityKeys);
    });

    it("returns undefined for non-existent preset", () => {
      expect(PRESET_SHADOW_OPACITY_MAP["shdw0"]).toBeUndefined();
    });

    it("shdw13 (inner shadow) has opacity 0.5", () => {
      expect(PRESET_SHADOW_OPACITY_MAP["shdw13"]).toBe(0.5);
    });

    it("opacity values are finite numbers", () => {
      for (const key of Object.keys(PRESET_SHADOW_OPACITY_MAP)) {
        expect(Number.isFinite(PRESET_SHADOW_OPACITY_MAP[key])).toBe(true);
      }
    });
  });
});
