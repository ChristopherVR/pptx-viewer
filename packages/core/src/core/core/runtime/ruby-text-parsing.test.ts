import { describe, it, expect } from "vitest";
import type { TextStyle, TextSegment } from "../../types";

// ---------------------------------------------------------------------------
// Extracted ruby parsing logic (mirrors parseRubyElement in the runtime mixin)
// ---------------------------------------------------------------------------

function ensureArray(val: unknown): unknown[] {
  if (val === undefined || val === null) return [];
  return Array.isArray(val) ? val : [val];
}

/**
 * Standalone ruby element parser that mirrors the logic in
 * PptxHandlerRuntimeShapeParagraphContentParsing.parseRubyElement.
 *
 * This allows us to unit-test the core parsing logic without
 * instantiating the full runtime mixin chain.
 */
function parseRubyElement(
  rubyNode: Record<string, unknown>,
  defaultStyle: TextStyle = {},
): TextSegment | undefined {
  // Extract ruby properties
  const rubyPr = rubyNode["a:rubyPr"] as Record<string, unknown> | undefined;
  const rubyAlignNode = rubyPr?.["a:rubyAlign"] as Record<string, unknown> | undefined;
  const rubyAlign = String(
    rubyPr?.["@_algn"] ?? rubyAlignNode?.["@_val"] ?? "ctr",
  ).trim() || "ctr";

  // Extract ruby text (phonetic annotation) from a:rt
  const rtNode = rubyNode["a:rt"] as Record<string, unknown> | undefined;
  let rubyText = "";
  let rubyFontSize: number | undefined;
  let rubyStyle: TextStyle | undefined;
  if (rtNode) {
    const rtRuns = ensureArray(rtNode["a:r"]);
    const rtParts: string[] = [];
    for (const rtRun of rtRuns) {
      if (!rtRun) continue;
      const rtRunObj = rtRun as Record<string, unknown>;
      const t = rtRunObj["a:t"];
      if (t !== undefined) {
        rtParts.push(typeof t === "string" ? t : String(t));
      }
      // Parse simplified style from the first ruby text run
      if (!rubyStyle) {
        const rPr = rtRunObj["a:rPr"] as Record<string, unknown> | undefined;
        rubyStyle = { ...defaultStyle };
        if (rPr?.["@_sz"] !== undefined) {
          const sz = Number.parseInt(String(rPr["@_sz"]), 10);
          if (Number.isFinite(sz)) {
            rubyStyle.fontSize = sz / 100; // hundredths of a point to points
            rubyFontSize = rubyStyle.fontSize;
          }
        }
        if (rPr?.["@_lang"]) {
          rubyStyle.language = String(rPr["@_lang"]);
        }
      }
    }
    rubyText = rtParts.join("");
  }

  // Extract base text from a:rubyBase
  const rubyBaseNode = rubyNode["a:rubyBase"] as Record<string, unknown> | undefined;
  let baseText = "";
  let baseStyle: TextStyle = { ...defaultStyle };
  if (rubyBaseNode) {
    const baseRuns = ensureArray(rubyBaseNode["a:r"]);
    const baseParts: string[] = [];
    for (const baseRun of baseRuns) {
      if (!baseRun) continue;
      const baseRunObj = baseRun as Record<string, unknown>;
      const t = baseRunObj["a:t"];
      if (t !== undefined) {
        baseParts.push(typeof t === "string" ? t : String(t));
      }
      if (baseParts.length === 1) {
        const rPr = baseRunObj["a:rPr"] as Record<string, unknown> | undefined;
        baseStyle = { ...defaultStyle };
        if (rPr?.["@_sz"] !== undefined) {
          const sz = Number.parseInt(String(rPr["@_sz"]), 10);
          if (Number.isFinite(sz)) {
            baseStyle.fontSize = sz / 100;
          }
        }
        if (rPr?.["@_lang"]) {
          baseStyle.language = String(rPr["@_lang"]);
        }
      }
    }
    baseText = baseParts.join("");
  }

  if (!baseText && !rubyText) return undefined;

  // Check for hps (half-point size) on rubyPr
  if (rubyPr?.["@_hps"] !== undefined && rubyFontSize === undefined) {
    const hps = Number.parseInt(String(rubyPr["@_hps"]), 10);
    if (Number.isFinite(hps)) {
      rubyFontSize = hps / 2; // half-points to points
    }
  }

  return {
    text: baseText,
    style: baseStyle,
    rubyText,
    rubyAlignment: rubyAlign,
    rubyFontSize,
    rubyStyle,
  };
}

// ---------------------------------------------------------------------------
// Extracted: ruby run detection in paragraph content collection
// ---------------------------------------------------------------------------
function collectParagraphWithRuby(
  p: Record<string, unknown>,
): { parts: string[]; segments: TextSegment[] } {
  const parts: string[] = [];
  const segments: TextSegment[] = [];
  const defaultStyle: TextStyle = { fontSize: 24 };

  const runs = ensureArray(p["a:r"]);
  for (const r of runs) {
    if (!r) continue;
    const run = r as Record<string, unknown>;

    // Check for ruby element
    const rubyNode = run["a:ruby"] as Record<string, unknown> | undefined;
    if (rubyNode) {
      const rubySegment = parseRubyElement(rubyNode, defaultStyle);
      if (rubySegment) {
        parts.push(rubySegment.text);
        segments.push(rubySegment);
        continue;
      }
    }

    // Normal run
    const t = run["a:t"];
    const text = t !== undefined ? (typeof t === "string" ? t : String(t)) : "";
    parts.push(text);
    segments.push({ text, style: defaultStyle });
  }

  return { parts, segments };
}

// ---------------------------------------------------------------------------
// Tests: parseRubyElement
// ---------------------------------------------------------------------------
describe("parseRubyElement", () => {
  it("should parse a basic ruby element with base text and phonetic text", () => {
    const ruby = {
      "a:rubyPr": { "@_algn": "ctr" },
      "a:rt": {
        "a:r": { "a:rPr": { "@_lang": "ja-JP", "@_sz": "1200" }, "a:t": "とうきょう" },
      },
      "a:rubyBase": {
        "a:r": { "a:rPr": { "@_lang": "ja-JP", "@_sz": "2400" }, "a:t": "東京" },
      },
    };

    const result = parseRubyElement(ruby);
    expect(result).toBeDefined();
    expect(result!.text).toBe("東京");
    expect(result!.rubyText).toBe("とうきょう");
    expect(result!.rubyAlignment).toBe("ctr");
    expect(result!.rubyFontSize).toBe(12); // 1200 hundredths / 100
    expect(result!.style.fontSize).toBe(24); // 2400 hundredths / 100
  });

  it("should handle left alignment", () => {
    const ruby = {
      "a:rubyPr": { "@_algn": "l" },
      "a:rt": { "a:r": { "a:t": "ピンイン" } },
      "a:rubyBase": { "a:r": { "a:t": "拼音" } },
    };

    const result = parseRubyElement(ruby);
    expect(result).toBeDefined();
    expect(result!.rubyAlignment).toBe("l");
  });

  it("should handle right alignment", () => {
    const ruby = {
      "a:rubyPr": { "@_algn": "r" },
      "a:rt": { "a:r": { "a:t": "phonetic" } },
      "a:rubyBase": { "a:r": { "a:t": "base" } },
    };

    const result = parseRubyElement(ruby);
    expect(result!.rubyAlignment).toBe("r");
  });

  it("should handle distribute alignment", () => {
    const ruby = {
      "a:rubyPr": { "@_algn": "dist" },
      "a:rt": { "a:r": { "a:t": "phonetic" } },
      "a:rubyBase": { "a:r": { "a:t": "base" } },
    };

    const result = parseRubyElement(ruby);
    expect(result!.rubyAlignment).toBe("dist");
  });

  it("should default alignment to ctr when not specified", () => {
    const ruby = {
      "a:rt": { "a:r": { "a:t": "abc" } },
      "a:rubyBase": { "a:r": { "a:t": "XYZ" } },
    };

    const result = parseRubyElement(ruby);
    expect(result).toBeDefined();
    expect(result!.rubyAlignment).toBe("ctr");
  });

  it("should handle multiple runs in ruby text (a:rt)", () => {
    const ruby = {
      "a:rubyPr": { "@_algn": "ctr" },
      "a:rt": {
        "a:r": [
          { "a:t": "とう" },
          { "a:t": "きょう" },
        ],
      },
      "a:rubyBase": { "a:r": { "a:t": "東京" } },
    };

    const result = parseRubyElement(ruby);
    expect(result!.rubyText).toBe("とうきょう");
  });

  it("should handle multiple runs in ruby base (a:rubyBase)", () => {
    const ruby = {
      "a:rubyPr": { "@_algn": "ctr" },
      "a:rt": { "a:r": { "a:t": "にほん" } },
      "a:rubyBase": {
        "a:r": [
          { "a:rPr": { "@_sz": "2400" }, "a:t": "日" },
          { "a:t": "本" },
        ],
      },
    };

    const result = parseRubyElement(ruby);
    expect(result!.text).toBe("日本");
    expect(result!.rubyText).toBe("にほん");
  });

  it("should return undefined when both base and ruby text are empty", () => {
    const ruby = {
      "a:rubyPr": { "@_algn": "ctr" },
      "a:rt": {},
      "a:rubyBase": {},
    };

    const result = parseRubyElement(ruby);
    expect(result).toBeUndefined();
  });

  it("should handle ruby with only base text (no phonetic)", () => {
    const ruby = {
      "a:rt": {},
      "a:rubyBase": { "a:r": { "a:t": "漢字" } },
    };

    const result = parseRubyElement(ruby);
    expect(result).toBeDefined();
    expect(result!.text).toBe("漢字");
    expect(result!.rubyText).toBe("");
  });

  it("should handle ruby with only phonetic text (no base)", () => {
    const ruby = {
      "a:rt": { "a:r": { "a:t": "かんじ" } },
      "a:rubyBase": {},
    };

    const result = parseRubyElement(ruby);
    expect(result).toBeDefined();
    expect(result!.text).toBe("");
    expect(result!.rubyText).toBe("かんじ");
  });

  it("should parse hps (half-point size) from rubyPr when rt has no font size", () => {
    const ruby = {
      "a:rubyPr": { "@_algn": "ctr", "@_hps": "24" },
      "a:rt": { "a:r": { "a:t": "ふりがな" } },
      "a:rubyBase": { "a:r": { "a:t": "振り仮名" } },
    };

    const result = parseRubyElement(ruby);
    expect(result!.rubyFontSize).toBe(12); // 24 half-points = 12 points
  });

  it("should prefer rt run font size over hps", () => {
    const ruby = {
      "a:rubyPr": { "@_algn": "ctr", "@_hps": "24" },
      "a:rt": { "a:r": { "a:rPr": { "@_sz": "800" }, "a:t": "test" } },
      "a:rubyBase": { "a:r": { "a:t": "base" } },
    };

    const result = parseRubyElement(ruby);
    // rt run has @_sz=800 (8pt), hps=24 (12pt) — rt size should win
    expect(result!.rubyFontSize).toBe(8);
  });

  it("should parse language from ruby text run properties", () => {
    const ruby = {
      "a:rubyPr": { "@_algn": "ctr" },
      "a:rt": {
        "a:r": { "a:rPr": { "@_lang": "zh-CN", "@_sz": "1000" }, "a:t": "pin yin" },
      },
      "a:rubyBase": {
        "a:r": { "a:rPr": { "@_lang": "zh-CN", "@_sz": "2000" }, "a:t": "拼音" },
      },
    };

    const result = parseRubyElement(ruby);
    expect(result!.rubyStyle?.language).toBe("zh-CN");
    expect(result!.style.language).toBe("zh-CN");
  });

  it("should handle a:rubyAlign nested element format", () => {
    const ruby = {
      "a:rubyPr": { "a:rubyAlign": { "@_val": "l" } },
      "a:rt": { "a:r": { "a:t": "abc" } },
      "a:rubyBase": { "a:r": { "a:t": "XYZ" } },
    };

    const result = parseRubyElement(ruby);
    expect(result!.rubyAlignment).toBe("l");
  });

  it("should inherit default style for base text", () => {
    const defaultStyle: TextStyle = { fontSize: 36, fontFamily: "Noto Sans" };
    const ruby = {
      "a:rt": { "a:r": { "a:t": "ruby" } },
      "a:rubyBase": { "a:r": { "a:t": "base" } },
    };

    const result = parseRubyElement(ruby, defaultStyle);
    expect(result!.style.fontSize).toBe(36);
    expect(result!.style.fontFamily).toBe("Noto Sans");
  });

  it("should handle numeric a:t values in runs", () => {
    const ruby = {
      "a:rt": { "a:r": { "a:t": 42 } },
      "a:rubyBase": { "a:r": { "a:t": 123 } },
    };

    const result = parseRubyElement(ruby);
    expect(result!.text).toBe("123");
    expect(result!.rubyText).toBe("42");
  });
});

// ---------------------------------------------------------------------------
// Tests: Ruby detection in paragraph content collection
// ---------------------------------------------------------------------------
describe("collectParagraphWithRuby", () => {
  it("should detect ruby element in a run and produce a ruby segment", () => {
    const p = {
      "a:r": {
        "a:rPr": { "@_lang": "ja-JP" },
        "a:ruby": {
          "a:rubyPr": { "@_algn": "ctr" },
          "a:rt": { "a:r": { "a:t": "とうきょう" } },
          "a:rubyBase": { "a:r": { "a:t": "東京" } },
        },
      },
    };

    const { parts, segments } = collectParagraphWithRuby(p);
    expect(parts).toEqual(["東京"]);
    expect(segments).toHaveLength(1);
    expect(segments[0].rubyText).toBe("とうきょう");
    expect(segments[0].text).toBe("東京");
  });

  it("should mix ruby and non-ruby runs", () => {
    const p = {
      "a:r": [
        { "a:t": "Location: " },
        {
          "a:ruby": {
            "a:rubyPr": { "@_algn": "ctr" },
            "a:rt": { "a:r": { "a:t": "とうきょう" } },
            "a:rubyBase": { "a:r": { "a:t": "東京" } },
          },
        },
        { "a:t": " is the capital." },
      ],
    };

    const { parts, segments } = collectParagraphWithRuby(p);
    expect(parts).toEqual(["Location: ", "東京", " is the capital."]);
    expect(segments).toHaveLength(3);
    // Only the second segment should be a ruby segment
    expect(segments[0].rubyText).toBeUndefined();
    expect(segments[1].rubyText).toBe("とうきょう");
    expect(segments[2].rubyText).toBeUndefined();
  });

  it("should handle a run without ruby as a normal run", () => {
    const p = {
      "a:r": { "a:t": "Normal text" },
    };

    const { parts, segments } = collectParagraphWithRuby(p);
    expect(parts).toEqual(["Normal text"]);
    expect(segments).toHaveLength(1);
    expect(segments[0].rubyText).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Tests: TextSegment ruby fields
// ---------------------------------------------------------------------------
describe("TextSegment ruby fields", () => {
  it("should allow creation of a TextSegment with ruby properties", () => {
    const segment: TextSegment = {
      text: "東京",
      style: { fontSize: 24, language: "ja-JP" },
      rubyText: "とうきょう",
      rubyAlignment: "ctr",
      rubyFontSize: 12,
      rubyStyle: { fontSize: 12, language: "ja-JP" },
    };

    expect(segment.text).toBe("東京");
    expect(segment.rubyText).toBe("とうきょう");
    expect(segment.rubyAlignment).toBe("ctr");
    expect(segment.rubyFontSize).toBe(12);
    expect(segment.rubyStyle?.fontSize).toBe(12);
  });

  it("should allow TextSegment without ruby (backward compat)", () => {
    const segment: TextSegment = {
      text: "Hello",
      style: { fontSize: 14 },
    };

    expect(segment.rubyText).toBeUndefined();
    expect(segment.rubyAlignment).toBeUndefined();
    expect(segment.rubyFontSize).toBeUndefined();
    expect(segment.rubyStyle).toBeUndefined();
  });
});
