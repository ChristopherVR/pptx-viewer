import { describe, it, expect } from "vitest";
import type { OmmlNode } from "./omml-helpers";
import type { ChildrenConverter } from "./omml-converters";
import {
  convertRun,
  convertFraction,
  convertRadical,
  convertSuperscript,
  convertSubscript,
  convertSubSup,
  convertPreSubSup,
  convertNary,
  convertDelimiter,
  convertMatrix,
  convertAccent,
  convertBar,
  convertLimLow,
  convertLimUpp,
  convertGroupChr,
  convertEqArr,
  convertBox,
  convertFunc,
} from "./omml-converters";

/**
 * Simple mock ChildrenConverter: extracts m:t text from m:r children,
 * or recursively looks for nested text.
 */
function mockCC(node: OmmlNode): string {
  if (!node || typeof node !== "object") return "";
  const parts: string[] = [];

  for (const key of Object.keys(node)) {
    if (key.startsWith("@_")) continue;
    const v = node[key];
    if (key === "m:r") {
      if (Array.isArray(v)) {
        for (const item of v) {
          const t = (item as OmmlNode)["m:t"];
          if (t !== undefined) parts.push(String(t));
        }
      } else if (v && typeof v === "object") {
        const t = (v as OmmlNode)["m:t"];
        if (t !== undefined) parts.push(String(t));
      }
    } else if (key === "m:f") {
      parts.push(convertFraction(v as OmmlNode, mockCC));
    } else if (key === "m:sSup") {
      parts.push(convertSuperscript(v as OmmlNode, mockCC));
    } else if (key === "m:sSub") {
      parts.push(convertSubscript(v as OmmlNode, mockCC));
    }
  }

  return parts.join("");
}

// ── convertRun ───────────────────────────────────────────────────────────

describe("convertRun", () => {
  it("converts numeric text to <mn>", () => {
    const node: OmmlNode = { "m:t": "42" };
    expect(convertRun(node)).toBe("<mn>42</mn>");
  });

  it("converts decimal numeric text to <mn>", () => {
    const node: OmmlNode = { "m:t": "3.14" };
    expect(convertRun(node)).toBe("<mn>3.14</mn>");
  });

  it("converts operator text to <mo>", () => {
    const node: OmmlNode = { "m:t": "+" };
    expect(convertRun(node)).toBe("<mo>+</mo>");
  });

  it("converts equals sign to <mo>", () => {
    const node: OmmlNode = { "m:t": "=" };
    expect(convertRun(node)).toBe("<mo>=</mo>");
  });

  it("converts single letter identifier to <mi>", () => {
    const node: OmmlNode = { "m:t": "x" };
    expect(convertRun(node)).toBe("<mi>x</mi>");
  });

  it("converts multi-letter text to <mi>", () => {
    const node: OmmlNode = { "m:t": "abc" };
    expect(convertRun(node)).toBe("<mi>abc</mi>");
  });

  it("converts normal text with m:nor=1 to <mi mathvariant=\"normal\">", () => {
    const node: OmmlNode = {
      "m:t": "sin",
      "m:rPr": { "m:nor": { "@_val": "1" } } as unknown as OmmlNode,
    };
    expect(convertRun(node)).toBe('<mi mathvariant="normal">sin</mi>');
  });

  it("treats m:nor=on as normal variant", () => {
    const node: OmmlNode = {
      "m:t": "x",
      "m:rPr": { "m:nor": { "@_val": "on" } } as unknown as OmmlNode,
    };
    expect(convertRun(node)).toBe('<mi mathvariant="normal">x</mi>');
  });

  it("treats m:nor=true as normal variant", () => {
    const node: OmmlNode = {
      "m:t": "x",
      "m:rPr": { "m:nor": { "@_val": "true" } } as unknown as OmmlNode,
    };
    expect(convertRun(node)).toBe('<mi mathvariant="normal">x</mi>');
  });

  it("returns empty string for empty text", () => {
    const node: OmmlNode = { "m:t": "" };
    expect(convertRun(node)).toBe("");
  });

  it("returns empty string for missing m:t", () => {
    const node: OmmlNode = {};
    expect(convertRun(node)).toBe("");
  });

  it("escapes XML entities in text", () => {
    const node: OmmlNode = { "m:t": "<" };
    expect(convertRun(node)).toBe("<mo>&lt;</mo>");
  });

  it("converts numeric m:t to string", () => {
    const node: OmmlNode = { "m:t": 5 };
    expect(convertRun(node)).toBe("<mn>5</mn>");
  });

  it("numeric check takes priority over operator for digit characters", () => {
    const node: OmmlNode = { "m:t": "123" };
    expect(convertRun(node)).toBe("<mn>123</mn>");
  });
});

// ── convertFraction ──────────────────────────────────────────────────────

describe("convertFraction", () => {
  it("converts a regular fraction to <mfrac>", () => {
    const node: OmmlNode = {
      "m:num": { "m:r": { "m:t": "a" } },
      "m:den": { "m:r": { "m:t": "b" } },
    };
    const result = convertFraction(node, mockCC);
    expect(result).toBe("<mfrac><mrow>a</mrow><mrow>b</mrow></mfrac>");
  });

  it("converts linear fraction to <mrow> with /", () => {
    const node: OmmlNode = {
      "m:fPr": { "m:type": { "@_val": "lin" } } as unknown as OmmlNode,
      "m:num": { "m:r": { "m:t": "a" } },
      "m:den": { "m:r": { "m:t": "b" } },
    };
    const result = convertFraction(node, mockCC);
    expect(result).toBe(
      "<mrow><mrow>a</mrow><mo>/</mo><mrow>b</mrow></mrow>",
    );
  });

  it("converts noBar fraction to <mfrac> with linethickness=0", () => {
    const node: OmmlNode = {
      "m:fPr": { "m:type": { "@_val": "noBar" } } as unknown as OmmlNode,
      "m:num": { "m:r": { "m:t": "n" } },
      "m:den": { "m:r": { "m:t": "k" } },
    };
    const result = convertFraction(node, mockCC);
    expect(result).toBe(
      '<mfrac linethickness="0"><mrow>n</mrow><mrow>k</mrow></mfrac>',
    );
  });

  it("handles empty numerator and denominator", () => {
    const node: OmmlNode = {};
    const result = convertFraction(node, mockCC);
    expect(result).toBe("<mfrac><mrow></mrow><mrow></mrow></mfrac>");
  });
});

// ── convertRadical ───────────────────────────────────────────────────────

describe("convertRadical", () => {
  it("converts square root with degHide=1 to <msqrt>", () => {
    const node: OmmlNode = {
      "m:radPr": { "m:degHide": { "@_val": "1" } } as unknown as OmmlNode,
      "m:e": { "m:r": { "m:t": "x" } },
    };
    const result = convertRadical(node, mockCC);
    expect(result).toBe("<msqrt><mrow>x</mrow></msqrt>");
  });

  it("converts nth root to <mroot>", () => {
    const node: OmmlNode = {
      "m:e": { "m:r": { "m:t": "x" } },
      "m:deg": { "m:r": { "m:t": "3" } },
    };
    const result = convertRadical(node, mockCC);
    expect(result).toBe("<mroot><mrow>x</mrow><mrow>3</mrow></mroot>");
  });

  it("converts to <msqrt> when degree is empty", () => {
    const node: OmmlNode = {
      "m:e": { "m:r": { "m:t": "y" } },
    };
    const result = convertRadical(node, mockCC);
    expect(result).toBe("<msqrt><mrow>y</mrow></msqrt>");
  });

  it("treats degHide=on as square root", () => {
    const node: OmmlNode = {
      "m:radPr": { "m:degHide": { "@_val": "on" } } as unknown as OmmlNode,
      "m:e": { "m:r": { "m:t": "z" } },
    };
    const result = convertRadical(node, mockCC);
    expect(result).toBe("<msqrt><mrow>z</mrow></msqrt>");
  });
});

// ── convertSuperscript ───────────────────────────────────────────────────

describe("convertSuperscript", () => {
  it("converts x^2 to <msup>", () => {
    const node: OmmlNode = {
      "m:e": { "m:r": { "m:t": "x" } },
      "m:sup": { "m:r": { "m:t": "2" } },
    };
    const result = convertSuperscript(node, mockCC);
    expect(result).toBe("<msup><mrow>x</mrow><mrow>2</mrow></msup>");
  });

  it("handles empty base and exponent", () => {
    const node: OmmlNode = {};
    const result = convertSuperscript(node, mockCC);
    expect(result).toBe("<msup><mrow></mrow><mrow></mrow></msup>");
  });
});

// ── convertSubscript ─────────────────────────────────────────────────────

describe("convertSubscript", () => {
  it("converts a_i to <msub>", () => {
    const node: OmmlNode = {
      "m:e": { "m:r": { "m:t": "a" } },
      "m:sub": { "m:r": { "m:t": "i" } },
    };
    const result = convertSubscript(node, mockCC);
    expect(result).toBe("<msub><mrow>a</mrow><mrow>i</mrow></msub>");
  });

  it("handles empty base and subscript", () => {
    const node: OmmlNode = {};
    const result = convertSubscript(node, mockCC);
    expect(result).toBe("<msub><mrow></mrow><mrow></mrow></msub>");
  });
});

// ── convertSubSup ────────────────────────────────────────────────────────

describe("convertSubSup", () => {
  it("converts x_i^2 to <msubsup>", () => {
    const node: OmmlNode = {
      "m:e": { "m:r": { "m:t": "x" } },
      "m:sub": { "m:r": { "m:t": "i" } },
      "m:sup": { "m:r": { "m:t": "2" } },
    };
    const result = convertSubSup(node, mockCC);
    expect(result).toBe(
      "<msubsup><mrow>x</mrow><mrow>i</mrow><mrow>2</mrow></msubsup>",
    );
  });
});

// ── convertPreSubSup ─────────────────────────────────────────────────────

describe("convertPreSubSup", () => {
  it("converts pre-subscript/superscript to <mmultiscripts>", () => {
    const node: OmmlNode = {
      "m:e": { "m:r": { "m:t": "C" } },
      "m:sub": { "m:r": { "m:t": "6" } },
      "m:sup": { "m:r": { "m:t": "12" } },
    };
    const result = convertPreSubSup(node, mockCC);
    expect(result).toBe(
      "<mmultiscripts><mrow>C</mrow><mprescripts/><mrow>6</mrow><mrow>12</mrow></mmultiscripts>",
    );
  });
});

// ── convertNary ──────────────────────────────────────────────────────────

describe("convertNary", () => {
  it("converts summation with sub and sup limits (subSup default)", () => {
    const node: OmmlNode = {
      "m:naryPr": {
        "m:chr": { "@_val": "\u2211" },
      } as unknown as OmmlNode,
      "m:sub": { "m:r": { "m:t": "i" } },
      "m:sup": { "m:r": { "m:t": "n" } },
      "m:e": { "m:r": { "m:t": "x" } },
    };
    const result = convertNary(node, mockCC);
    expect(result).toContain("<msubsup>");
    expect(result).toContain("\u2211");
    expect(result).toContain("i");
    expect(result).toContain("n");
    expect(result).toContain("x");
  });

  it("converts summation with undOvr limLoc", () => {
    const node: OmmlNode = {
      "m:naryPr": {
        "m:chr": { "@_val": "\u2211" },
        "m:limLoc": { "@_val": "undOvr" },
      } as unknown as OmmlNode,
      "m:sub": { "m:r": { "m:t": "i" } },
      "m:sup": { "m:r": { "m:t": "n" } },
      "m:e": { "m:r": { "m:t": "x" } },
    };
    const result = convertNary(node, mockCC);
    expect(result).toContain("<munderover>");
  });

  it("hides subscript when subHide=1", () => {
    const node: OmmlNode = {
      "m:naryPr": {
        "m:chr": { "@_val": "\u222B" },
        "m:subHide": { "@_val": "1" },
      } as unknown as OmmlNode,
      "m:sub": {},
      "m:sup": { "m:r": { "m:t": "b" } },
      "m:e": { "m:r": { "m:t": "f" } },
    };
    const result = convertNary(node, mockCC);
    expect(result).toContain("<msup>");
    expect(result).not.toContain("<msubsup>");
  });

  it("hides superscript when supHide=1", () => {
    const node: OmmlNode = {
      "m:naryPr": {
        "m:chr": { "@_val": "\u222B" },
        "m:supHide": { "@_val": "1" },
      } as unknown as OmmlNode,
      "m:sub": { "m:r": { "m:t": "a" } },
      "m:sup": {},
      "m:e": { "m:r": { "m:t": "f" } },
    };
    const result = convertNary(node, mockCC);
    expect(result).toContain("<msub>");
    expect(result).not.toContain("<msubsup>");
  });

  it("renders bare operator when both sub and sup are hidden", () => {
    const node: OmmlNode = {
      "m:naryPr": {
        "m:chr": { "@_val": "\u222B" },
        "m:subHide": { "@_val": "1" },
        "m:supHide": { "@_val": "1" },
      } as unknown as OmmlNode,
      "m:sub": {},
      "m:sup": {},
      "m:e": { "m:r": { "m:t": "f" } },
    };
    const result = convertNary(node, mockCC);
    expect(result).toContain("<mo>\u222B</mo>");
    expect(result).not.toContain("<msub>");
    expect(result).not.toContain("<msup>");
  });

  it("defaults to integral when no m:chr is provided", () => {
    const node: OmmlNode = {
      "m:naryPr": {} as unknown as OmmlNode,
      "m:sub": {},
      "m:sup": {},
      "m:e": { "m:r": { "m:t": "f" } },
    };
    const result = convertNary(node, mockCC);
    expect(result).toContain("\u222B");
  });

  it("uses undOvr with sub-only limit", () => {
    const node: OmmlNode = {
      "m:naryPr": {
        "m:chr": { "@_val": "\u2211" },
        "m:limLoc": { "@_val": "undOvr" },
      } as unknown as OmmlNode,
      "m:sub": { "m:r": { "m:t": "i" } },
      "m:sup": {},
      "m:e": { "m:r": { "m:t": "x" } },
    };
    const result = convertNary(node, mockCC);
    expect(result).toContain("<munder>");
  });

  it("uses undOvr with sup-only limit", () => {
    const node: OmmlNode = {
      "m:naryPr": {
        "m:chr": { "@_val": "\u2211" },
        "m:limLoc": { "@_val": "undOvr" },
      } as unknown as OmmlNode,
      "m:sub": {},
      "m:sup": { "m:r": { "m:t": "n" } },
      "m:e": { "m:r": { "m:t": "x" } },
    };
    const result = convertNary(node, mockCC);
    expect(result).toContain("<mover>");
  });
});

// ── convertDelimiter ─────────────────────────────────────────────────────

describe("convertDelimiter", () => {
  it("converts parenthesized expression", () => {
    const node: OmmlNode = {
      "m:e": { "m:r": { "m:t": "x" } },
    };
    const result = convertDelimiter(node, mockCC);
    expect(result).toContain("<mo>(</mo>");
    expect(result).toContain("<mo>)</mo>");
    expect(result).toContain("x");
  });

  it("converts with custom begin and end characters", () => {
    const node: OmmlNode = {
      "m:dPr": {
        "m:begChr": { "@_val": "[" },
        "m:endChr": { "@_val": "]" },
      } as unknown as OmmlNode,
      "m:e": { "m:r": { "m:t": "x" } },
    };
    const result = convertDelimiter(node, mockCC);
    expect(result).toContain("<mo>[</mo>");
    expect(result).toContain("<mo>]</mo>");
  });

  it("converts with pipe delimiters", () => {
    const node: OmmlNode = {
      "m:dPr": {
        "m:begChr": { "@_val": "|" },
        "m:endChr": { "@_val": "|" },
      } as unknown as OmmlNode,
      "m:e": { "m:r": { "m:t": "x" } },
    };
    const result = convertDelimiter(node, mockCC);
    expect(result).toContain("<mo>|</mo>");
  });

  it("handles multiple elements with separator", () => {
    const node: OmmlNode = {
      "m:dPr": {
        "m:sepChr": { "@_val": "," },
      } as unknown as OmmlNode,
      "m:e": [
        { "m:r": { "m:t": "a" } } as OmmlNode,
        { "m:r": { "m:t": "b" } } as OmmlNode,
      ],
    };
    const result = convertDelimiter(node, mockCC);
    expect(result).toContain("a");
    expect(result).toContain("b");
    expect(result).toContain("<mo>,</mo>");
  });

  it("uses default parentheses when no dPr is provided", () => {
    const node: OmmlNode = {
      "m:e": { "m:r": { "m:t": "y" } },
    };
    const result = convertDelimiter(node, mockCC);
    expect(result).toContain("<mo>(</mo>");
    expect(result).toContain("<mo>)</mo>");
  });
});

// ── convertMatrix ────────────────────────────────────────────────────────

describe("convertMatrix", () => {
  it("converts a 2x2 matrix", () => {
    const node: OmmlNode = {
      "m:mr": [
        {
          "m:e": [
            { "m:r": { "m:t": "a" } } as OmmlNode,
            { "m:r": { "m:t": "b" } } as OmmlNode,
          ],
        } as OmmlNode,
        {
          "m:e": [
            { "m:r": { "m:t": "c" } } as OmmlNode,
            { "m:r": { "m:t": "d" } } as OmmlNode,
          ],
        } as OmmlNode,
      ],
    };
    const result = convertMatrix(node, mockCC);
    expect(result).toContain("<mtable>");
    expect(result).toContain("<mtr>");
    expect(result).toContain("<mtd>");
    expect(result).toContain("a");
    expect(result).toContain("d");
    expect(result).toContain("<mo>[</mo>");
    expect(result).toContain("<mo>]</mo>");
  });

  it("handles a single row matrix", () => {
    const node: OmmlNode = {
      "m:mr": {
        "m:e": { "m:r": { "m:t": "x" } },
      } as OmmlNode,
    };
    const result = convertMatrix(node, mockCC);
    expect(result).toContain("<mtr>");
    expect(result).toContain("x");
  });
});

// ── convertAccent ────────────────────────────────────────────────────────

describe("convertAccent", () => {
  it("converts a hat accent", () => {
    const node: OmmlNode = {
      "m:accPr": {
        "m:chr": { "@_val": "\u0302" },
      } as unknown as OmmlNode,
      "m:e": { "m:r": { "m:t": "x" } },
    };
    const result = convertAccent(node, mockCC);
    expect(result).toContain('<mover accent="true">');
    expect(result).toContain("x");
    expect(result).toContain("\u005E");
  });

  it("uses default accent when no chr is specified", () => {
    const node: OmmlNode = {
      "m:accPr": {} as unknown as OmmlNode,
      "m:e": { "m:r": { "m:t": "a" } },
    };
    const result = convertAccent(node, mockCC);
    expect(result).toContain('<mover accent="true">');
  });

  it("converts tilde accent", () => {
    const node: OmmlNode = {
      "m:accPr": {
        "m:chr": { "@_val": "\u0303" },
      } as unknown as OmmlNode,
      "m:e": { "m:r": { "m:t": "x" } },
    };
    const result = convertAccent(node, mockCC);
    expect(result).toContain("\u007E");
  });
});

// ── convertBar ───────────────────────────────────────────────────────────

describe("convertBar", () => {
  it("converts overbar (default position)", () => {
    const node: OmmlNode = {
      "m:e": { "m:r": { "m:t": "x" } },
    };
    const result = convertBar(node, mockCC);
    expect(result).toContain("<mover>");
    expect(result).toContain("\u00AF");
    expect(result).toContain("x");
  });

  it("converts underbar when pos=bot", () => {
    const node: OmmlNode = {
      "m:barPr": {
        "m:pos": { "@_val": "bot" },
      } as unknown as OmmlNode,
      "m:e": { "m:r": { "m:t": "x" } },
    };
    const result = convertBar(node, mockCC);
    expect(result).toContain("<munder>");
    expect(result).toContain("\u00AF");
  });
});

// ── convertLimLow ────────────────────────────────────────────────────────

describe("convertLimLow", () => {
  it("converts lower limit", () => {
    const node: OmmlNode = {
      "m:e": { "m:r": { "m:t": "lim" } },
      "m:lim": { "m:r": { "m:t": "n" } },
    };
    const result = convertLimLow(node, mockCC);
    expect(result).toBe(
      "<munder><mrow>lim</mrow><mrow>n</mrow></munder>",
    );
  });
});

// ── convertLimUpp ────────────────────────────────────────────────────────

describe("convertLimUpp", () => {
  it("converts upper limit", () => {
    const node: OmmlNode = {
      "m:e": { "m:r": { "m:t": "max" } },
      "m:lim": { "m:r": { "m:t": "k" } },
    };
    const result = convertLimUpp(node, mockCC);
    expect(result).toBe(
      "<mover><mrow>max</mrow><mrow>k</mrow></mover>",
    );
  });
});

// ── convertGroupChr ──────────────────────────────────────────────────────

describe("convertGroupChr", () => {
  it("converts underbrace (default position)", () => {
    const node: OmmlNode = {
      "m:groupChrPr": {
        "m:chr": { "@_val": "\u23DF" },
      } as unknown as OmmlNode,
      "m:e": { "m:r": { "m:t": "abc" } },
    };
    const result = convertGroupChr(node, mockCC);
    expect(result).toContain("<munder>");
    expect(result).toContain("\u23DF");
  });

  it("converts overbrace when pos=top", () => {
    const node: OmmlNode = {
      "m:groupChrPr": {
        "m:chr": { "@_val": "\u23DE" },
        "m:pos": { "@_val": "top" },
      } as unknown as OmmlNode,
      "m:e": { "m:r": { "m:t": "abc" } },
    };
    const result = convertGroupChr(node, mockCC);
    expect(result).toContain("<mover>");
    expect(result).toContain("\u23DE");
  });

  it("uses default character when chr is empty", () => {
    const node: OmmlNode = {
      "m:groupChrPr": {} as unknown as OmmlNode,
      "m:e": { "m:r": { "m:t": "x" } },
    };
    const result = convertGroupChr(node, mockCC);
    expect(result).toContain("\u23DF");
  });
});

// ── convertEqArr ─────────────────────────────────────────────────────────

describe("convertEqArr", () => {
  it("converts an equation array", () => {
    const node: OmmlNode = {
      "m:e": [
        { "m:r": { "m:t": "x=1" } } as OmmlNode,
        { "m:r": { "m:t": "y=2" } } as OmmlNode,
      ],
    };
    const result = convertEqArr(node, mockCC);
    expect(result).toContain('<mtable columnalign="left">');
    expect(result).toContain("<mtr>");
    expect(result).toContain("<mtd>");
    expect(result).toContain("x=1");
    expect(result).toContain("y=2");
  });

  it("handles single equation in array", () => {
    const node: OmmlNode = {
      "m:e": { "m:r": { "m:t": "x=1" } },
    };
    const result = convertEqArr(node, mockCC);
    expect(result).toContain("<mtr>");
    expect(result).toContain("x=1");
  });
});

// ── convertBox ───────────────────────────────────────────────────────────

describe("convertBox", () => {
  it("wraps content in <mrow>", () => {
    const node: OmmlNode = {
      "m:e": { "m:r": { "m:t": "x" } },
    };
    const result = convertBox(node, mockCC);
    expect(result).toBe("<mrow>x</mrow>");
  });

  it("handles empty content", () => {
    const node: OmmlNode = {};
    const result = convertBox(node, mockCC);
    expect(result).toBe("<mrow></mrow>");
  });
});

// ── convertFunc ──────────────────────────────────────────────────────────

describe("convertFunc", () => {
  it("converts function application with apply operator", () => {
    const node: OmmlNode = {
      "m:fName": { "m:r": { "m:t": "sin" } },
      "m:e": { "m:r": { "m:t": "x" } },
    };
    const result = convertFunc(node, mockCC);
    expect(result).toContain("sin");
    expect(result).toContain("&#x2061;");
    expect(result).toContain("x");
  });

  it("wraps the argument in <mrow>", () => {
    const node: OmmlNode = {
      "m:fName": { "m:r": { "m:t": "log" } },
      "m:e": { "m:r": { "m:t": "y" } },
    };
    const result = convertFunc(node, mockCC);
    expect(result).toBe(
      "<mrow>log<mo>&#x2061;</mo><mrow>y</mrow></mrow>",
    );
  });
});
