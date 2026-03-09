import { describe, it, expect } from "vitest";
import { convertOmmlToLatex } from "./latex-to-omml-reverse";

describe("convertOmmlToLatex", () => {
  // ── Null / empty inputs ──────────────────────────────────────────────

  it("returns empty string for null input", () => {
    expect(convertOmmlToLatex(null as unknown as Record<string, unknown>)).toBe(
      "",
    );
  });

  it("returns empty string for undefined input", () => {
    expect(
      convertOmmlToLatex(undefined as unknown as Record<string, unknown>),
    ).toBe("");
  });

  it("returns empty string for empty object", () => {
    expect(convertOmmlToLatex({})).toBe("");
  });

  it("returns empty string for non-object input", () => {
    expect(
      convertOmmlToLatex("text" as unknown as Record<string, unknown>),
    ).toBe("");
  });

  // ── Simple run ───────────────────────────────────────────────────────

  it("converts a simple text run to the letter", () => {
    const omml = {
      "m:oMath": {
        "m:r": { "m:t": "x" },
      },
    };
    expect(convertOmmlToLatex(omml)).toBe("x");
  });

  it("converts a numeric run", () => {
    const omml = {
      "m:oMath": {
        "m:r": { "m:t": "42" },
      },
    };
    expect(convertOmmlToLatex(omml)).toBe("42");
  });

  // ── Greek characters ─────────────────────────────────────────────────

  it("converts Greek alpha back to \\alpha", () => {
    const omml = {
      "m:oMath": {
        "m:r": { "m:t": "\u03B1" },
      },
    };
    const result = convertOmmlToLatex(omml);
    expect(result.trim()).toBe("\\alpha");
  });

  it("converts Greek beta back to \\beta", () => {
    const omml = {
      "m:oMath": {
        "m:r": { "m:t": "\u03B2" },
      },
    };
    const result = convertOmmlToLatex(omml);
    expect(result.trim()).toBe("\\beta");
  });

  it("converts Greek Omega back to \\Omega", () => {
    const omml = {
      "m:oMath": {
        "m:r": { "m:t": "\u03A9" },
      },
    };
    const result = convertOmmlToLatex(omml);
    expect(result.trim()).toBe("\\Omega");
  });

  // ── Operators ────────────────────────────────────────────────────────

  it("converts times operator back to \\times", () => {
    const omml = {
      "m:oMath": {
        "m:r": { "m:t": "\u00D7" },
      },
    };
    const result = convertOmmlToLatex(omml);
    expect(result.trim()).toBe("\\times");
  });

  it("converts infinity back to \\infty", () => {
    const omml = {
      "m:oMath": {
        "m:r": { "m:t": "\u221E" },
      },
    };
    const result = convertOmmlToLatex(omml);
    expect(result.trim()).toBe("\\infty");
  });

  // ── Fraction ─────────────────────────────────────────────────────────

  it("converts fraction to \\frac{a}{b}", () => {
    const omml = {
      "m:oMath": {
        "m:f": {
          "m:num": { "m:r": { "m:t": "a" } },
          "m:den": { "m:r": { "m:t": "b" } },
        },
      },
    };
    expect(convertOmmlToLatex(omml)).toBe("\\frac{a}{b}");
  });

  it("converts nested fraction", () => {
    const omml = {
      "m:oMath": {
        "m:f": {
          "m:num": {
            "m:r": { "m:t": "1" },
          },
          "m:den": {
            "m:f": {
              "m:num": { "m:r": { "m:t": "a" } },
              "m:den": { "m:r": { "m:t": "b" } },
            },
          },
        },
      },
    };
    expect(convertOmmlToLatex(omml)).toBe("\\frac{1}{\\frac{a}{b}}");
  });

  // ── Superscript ──────────────────────────────────────────────────────

  it("converts superscript to x^{2}", () => {
    const omml = {
      "m:oMath": {
        "m:sSup": {
          "m:e": { "m:r": { "m:t": "x" } },
          "m:sup": { "m:r": { "m:t": "2" } },
        },
      },
    };
    expect(convertOmmlToLatex(omml)).toBe("x^{2}");
  });

  // ── Subscript ────────────────────────────────────────────────────────

  it("converts subscript to a_{i}", () => {
    const omml = {
      "m:oMath": {
        "m:sSub": {
          "m:e": { "m:r": { "m:t": "a" } },
          "m:sub": { "m:r": { "m:t": "i" } },
        },
      },
    };
    expect(convertOmmlToLatex(omml)).toBe("a_{i}");
  });

  // ── SubSup ───────────────────────────────────────────────────────────

  it("converts sub+sup to x_{i}^{2}", () => {
    const omml = {
      "m:oMath": {
        "m:sSubSup": {
          "m:e": { "m:r": { "m:t": "x" } },
          "m:sub": { "m:r": { "m:t": "i" } },
          "m:sup": { "m:r": { "m:t": "2" } },
        },
      },
    };
    expect(convertOmmlToLatex(omml)).toBe("x_{i}^{2}");
  });

  // ── Radical ──────────────────────────────────────────────────────────

  it("converts square root to \\sqrt{x}", () => {
    const omml = {
      "m:oMath": {
        "m:rad": {
          "m:radPr": {
            "m:degHide": { "@_val": "1" },
          },
          "m:e": { "m:r": { "m:t": "x" } },
        },
      },
    };
    expect(convertOmmlToLatex(omml)).toBe("\\sqrt{x}");
  });

  it("converts nth root to \\sqrt[n]{x}", () => {
    const omml = {
      "m:oMath": {
        "m:rad": {
          "m:deg": { "m:r": { "m:t": "3" } },
          "m:e": { "m:r": { "m:t": "x" } },
        },
      },
    };
    expect(convertOmmlToLatex(omml)).toBe("\\sqrt[3]{x}");
  });

  // ── Nary ─────────────────────────────────────────────────────────────

  it("converts summation to \\sum", () => {
    const omml = {
      "m:oMath": {
        "m:nary": {
          "m:naryPr": {
            "m:chr": { "@_val": "\u2211" },
          },
          "m:sub": { "m:r": { "m:t": "i" } },
          "m:sup": { "m:r": { "m:t": "n" } },
          "m:e": { "m:r": { "m:t": "x" } },
        },
      },
    };
    const result = convertOmmlToLatex(omml);
    expect(result).toContain("\\sum");
    expect(result).toContain("_{i}");
    expect(result).toContain("^{n}");
    expect(result).toContain("{x}");
  });

  it("converts integral to \\int", () => {
    const omml = {
      "m:oMath": {
        "m:nary": {
          "m:naryPr": {
            "m:chr": { "@_val": "\u222B" },
          },
          "m:sub": { "m:r": { "m:t": "0" } },
          "m:sup": { "m:r": { "m:t": "1" } },
          "m:e": { "m:r": { "m:t": "f" } },
        },
      },
    };
    const result = convertOmmlToLatex(omml);
    expect(result).toContain("\\int");
  });

  it("hides subscript when subHide=1", () => {
    const omml = {
      "m:oMath": {
        "m:nary": {
          "m:naryPr": {
            "m:chr": { "@_val": "\u222B" },
            "m:subHide": { "@_val": "1" },
          },
          "m:sub": { "m:r": { "m:t": "0" } },
          "m:sup": { "m:r": { "m:t": "1" } },
          "m:e": { "m:r": { "m:t": "f" } },
        },
      },
    };
    const result = convertOmmlToLatex(omml);
    expect(result).not.toContain("_{0}");
  });

  // ── Delimiter ────────────────────────────────────────────────────────

  it("converts delimiter to \\left(...)\\right...)", () => {
    const omml = {
      "m:oMath": {
        "m:d": {
          "m:dPr": {
            "m:begChr": { "@_val": "[" },
            "m:endChr": { "@_val": "]" },
          },
          "m:e": { "m:r": { "m:t": "x" } },
        },
      },
    };
    const result = convertOmmlToLatex(omml);
    expect(result).toContain("\\left[");
    expect(result).toContain("\\right]");
  });

  it("uses default parens when no dPr delimiters specified", () => {
    const omml = {
      "m:oMath": {
        "m:d": {
          "m:e": { "m:r": { "m:t": "x" } },
        },
      },
    };
    const result = convertOmmlToLatex(omml);
    expect(result).toContain("\\left(");
    expect(result).toContain("\\right)");
  });

  // ── Function ─────────────────────────────────────────────────────────

  it("converts function application", () => {
    const omml = {
      "m:oMath": {
        "m:func": {
          "m:fName": { "m:r": { "m:t": "sin" } },
          "m:e": { "m:r": { "m:t": "x" } },
        },
      },
    };
    const result = convertOmmlToLatex(omml);
    expect(result).toContain("sin");
    expect(result).toContain("{x}");
  });

  // ── Normal text ──────────────────────────────────────────────────────

  it("converts normal text to \\text{}", () => {
    const omml = {
      "m:oMath": {
        "m:r": {
          "m:t": "hello",
          "m:rPr": { "m:nor": { "@_val": "1" } },
        },
      },
    };
    expect(convertOmmlToLatex(omml)).toBe("\\text{hello}");
  });

  // ── oMathPara wrapper ────────────────────────────────────────────────

  it("navigates through m:oMathPara to find m:oMath", () => {
    const omml = {
      "m:oMathPara": {
        "m:oMath": {
          "m:r": { "m:t": "z" },
        },
      },
    };
    expect(convertOmmlToLatex(omml)).toBe("z");
  });

  // ── Direct oMath node ────────────────────────────────────────────────

  it("treats the object itself as oMath if no wrapper found", () => {
    const omml = {
      "m:r": { "m:t": "y" },
    };
    expect(convertOmmlToLatex(omml)).toBe("y");
  });

  // ── Empty run ────────────────────────────────────────────────────────

  it("skips empty text runs", () => {
    const omml = {
      "m:oMath": {
        "m:r": { "m:t": "" },
      },
    };
    expect(convertOmmlToLatex(omml)).toBe("");
  });
});
