import { describe, it, expect } from "vitest";
import {
  THEME_EDITOR_CARD,
  THEME_EDITOR_HEADING,
  THEME_EDITOR_INPUT,
  THEME_EDITOR_BTN,
  THEME_EDITOR_BTN_SECONDARY,
} from "./theme-editor-constants";

describe("theme-editor-constants", () => {
  const tokens = [
    ["THEME_EDITOR_CARD", THEME_EDITOR_CARD],
    ["THEME_EDITOR_HEADING", THEME_EDITOR_HEADING],
    ["THEME_EDITOR_INPUT", THEME_EDITOR_INPUT],
    ["THEME_EDITOR_BTN", THEME_EDITOR_BTN],
    ["THEME_EDITOR_BTN_SECONDARY", THEME_EDITOR_BTN_SECONDARY],
  ] as const;

  for (const [name, value] of tokens) {
    describe(name, () => {
      it("is a non-empty string", () => {
        expect(typeof value).toBe("string");
        expect(value.length).toBeGreaterThan(0);
      });

      it("contains no leading or trailing whitespace", () => {
        expect(value).toBe(value.trim());
      });
    });
  }

  it("all tokens are distinct", () => {
    const values = tokens.map(([, v]) => v);
    expect(new Set(values).size).toBe(values.length);
  });

  it("primary and secondary buttons have different styles", () => {
    expect(THEME_EDITOR_BTN).not.toBe(THEME_EDITOR_BTN_SECONDARY);
  });

  it("primary button contains 'primary'", () => {
    expect(THEME_EDITOR_BTN).toContain("primary");
  });

  it("secondary button contains 'accent'", () => {
    expect(THEME_EDITOR_BTN_SECONDARY).toContain("accent");
  });
});
