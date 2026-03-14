import { describe, it, expect } from "vitest";
import { getKinsokuLineBreakStyles } from "./kinsoku-styles";
import type { TextStyle } from "pptx-viewer-core";

describe("getKinsokuLineBreakStyles", () => {
  // ── Undefined / empty input ───────────────────────────────────────────

  it("returns empty object when textStyle is undefined", () => {
    expect(getKinsokuLineBreakStyles(undefined)).toEqual({});
  });

  it("returns empty object when textStyle has no kinsoku-related flags", () => {
    const style: TextStyle = { fontSize: 24, bold: true };
    expect(getKinsokuLineBreakStyles(style)).toEqual({});
  });

  // ── eaLineBreak ──────────────────────────────────────────────────────

  it("sets lineBreak=normal and wordBreak=break-all when eaLineBreak is true", () => {
    const style: TextStyle = { eaLineBreak: true };
    const result = getKinsokuLineBreakStyles(style);
    expect(result.lineBreak).toBe("normal");
    expect(result.wordBreak).toBe("break-all");
    expect(result.overflowWrap).toBe("break-word");
  });

  it("sets lineBreak=strict when eaLineBreak is false", () => {
    const style: TextStyle = { eaLineBreak: false };
    const result = getKinsokuLineBreakStyles(style);
    expect(result.lineBreak).toBe("strict");
    expect(result.overflowWrap).toBe("break-word");
  });

  it("does not set wordBreak when eaLineBreak is false (strict mode)", () => {
    const style: TextStyle = { eaLineBreak: false };
    const result = getKinsokuLineBreakStyles(style);
    expect(result.wordBreak).toBeUndefined();
  });

  // ── hangingPunctuation ───────────────────────────────────────────────

  it("sets hangingPunctuation=last when hangingPunctuation is true", () => {
    const style: TextStyle = { hangingPunctuation: true };
    const result = getKinsokuLineBreakStyles(style);
    expect(result.hangingPunctuation).toBe("last");
  });

  it("sets hangingPunctuation=none when hangingPunctuation is false", () => {
    const style: TextStyle = { hangingPunctuation: false };
    const result = getKinsokuLineBreakStyles(style);
    expect(result.hangingPunctuation).toBe("none");
  });

  it("does not set hangingPunctuation when flag is undefined", () => {
    const style: TextStyle = { eaLineBreak: true };
    const result = getKinsokuLineBreakStyles(style);
    expect(result.hangingPunctuation).toBeUndefined();
  });

  // ── latinLineBreak ───────────────────────────────────────────────────

  it("sets wordBreak=break-all when latinLineBreak is true", () => {
    const style: TextStyle = { latinLineBreak: true };
    const result = getKinsokuLineBreakStyles(style);
    expect(result.wordBreak).toBe("break-all");
    expect(result.overflowWrap).toBe("break-word");
  });

  it("does not set wordBreak when latinLineBreak is false", () => {
    const style: TextStyle = { latinLineBreak: false };
    const result = getKinsokuLineBreakStyles(style);
    expect(result.wordBreak).toBeUndefined();
  });

  // ── Combinations ─────────────────────────────────────────────────────

  it("combines eaLineBreak=true with hangingPunctuation=true", () => {
    const style: TextStyle = { eaLineBreak: true, hangingPunctuation: true };
    const result = getKinsokuLineBreakStyles(style);
    expect(result.lineBreak).toBe("normal");
    expect(result.wordBreak).toBe("break-all");
    expect(result.overflowWrap).toBe("break-word");
    expect(result.hangingPunctuation).toBe("last");
  });

  it("combines eaLineBreak=false with hangingPunctuation=false", () => {
    const style: TextStyle = { eaLineBreak: false, hangingPunctuation: false };
    const result = getKinsokuLineBreakStyles(style);
    expect(result.lineBreak).toBe("strict");
    expect(result.overflowWrap).toBe("break-word");
    expect(result.hangingPunctuation).toBe("none");
  });

  it("combines eaLineBreak=true with latinLineBreak=true", () => {
    const style: TextStyle = { eaLineBreak: true, latinLineBreak: true };
    const result = getKinsokuLineBreakStyles(style);
    expect(result.lineBreak).toBe("normal");
    // latinLineBreak=true also sets wordBreak=break-all (same as eaLineBreak=true)
    expect(result.wordBreak).toBe("break-all");
    expect(result.overflowWrap).toBe("break-word");
  });

  it("combines all three flags: eaLineBreak=true, hangingPunctuation=true, latinLineBreak=true", () => {
    const style: TextStyle = {
      eaLineBreak: true,
      hangingPunctuation: true,
      latinLineBreak: true,
    };
    const result = getKinsokuLineBreakStyles(style);
    expect(result.lineBreak).toBe("normal");
    expect(result.wordBreak).toBe("break-all");
    expect(result.overflowWrap).toBe("break-word");
    expect(result.hangingPunctuation).toBe("last");
  });

  it("combines eaLineBreak=false with hangingPunctuation=true (strict with hanging)", () => {
    const style: TextStyle = { eaLineBreak: false, hangingPunctuation: true };
    const result = getKinsokuLineBreakStyles(style);
    expect(result.lineBreak).toBe("strict");
    expect(result.overflowWrap).toBe("break-word");
    expect(result.hangingPunctuation).toBe("last");
    // wordBreak should not be set (strict kinsoku does not force break-all)
    expect(result.wordBreak).toBeUndefined();
  });

  // ── latinLineBreak overrides wordBreak from eaLineBreak ──────────────

  it("latinLineBreak=true sets wordBreak even when eaLineBreak is false", () => {
    const style: TextStyle = { eaLineBreak: false, latinLineBreak: true };
    const result = getKinsokuLineBreakStyles(style);
    // eaLineBreak=false sets lineBreak=strict (no wordBreak),
    // but latinLineBreak=true then sets wordBreak=break-all
    expect(result.lineBreak).toBe("strict");
    expect(result.wordBreak).toBe("break-all");
    expect(result.overflowWrap).toBe("break-word");
  });

  // ── Does not interfere with other TextStyle properties ───────────────

  it("ignores non-kinsoku TextStyle properties", () => {
    const style: TextStyle = {
      fontFamily: "Noto Sans CJK",
      fontSize: 18,
      bold: true,
      color: "#000000",
      align: "left",
    };
    const result = getKinsokuLineBreakStyles(style);
    expect(result).toEqual({});
  });
});
