import { describe, it, expect } from "vitest";
import { convertOmmlToMathMl } from "./omml-to-mathml";
import type { OmmlNode } from "./omml-to-mathml";

const MATH_NS = 'xmlns="http://www.w3.org/1998/Math/MathML"';

describe("convertOmmlToMathMl", () => {
  // ── Null / empty inputs ──────────────────────────────────────────────

  it("returns empty string for null input", () => {
    expect(convertOmmlToMathMl(null as unknown as OmmlNode)).toBe("");
  });

  it("returns empty string for undefined input", () => {
    expect(convertOmmlToMathMl(undefined as unknown as OmmlNode)).toBe("");
  });

  it("returns empty string for empty object", () => {
    expect(convertOmmlToMathMl({})).toBe("");
  });

  it("returns empty string for non-object input", () => {
    expect(convertOmmlToMathMl("hello" as unknown as OmmlNode)).toBe("");
  });

  // ── Simple run ───────────────────────────────────────────────────────

  it("converts a simple identifier run", () => {
    const omml: OmmlNode = {
      "m:oMath": { "m:r": { "m:t": "x" } },
    };
    const result = convertOmmlToMathMl(omml);
    expect(result).toContain(MATH_NS);
    expect(result).toContain("<mi>x</mi>");
  });

  it("converts a numeric run", () => {
    const omml: OmmlNode = {
      "m:oMath": { "m:r": { "m:t": "42" } },
    };
    const result = convertOmmlToMathMl(omml);
    expect(result).toContain("<mn>42</mn>");
  });

  it("converts an operator run", () => {
    const omml: OmmlNode = {
      "m:oMath": { "m:r": { "m:t": "+" } },
    };
    const result = convertOmmlToMathMl(omml);
    expect(result).toContain("<mo>+</mo>");
  });

  // ── Fraction ─────────────────────────────────────────────────────────

  it("converts a fraction a/b", () => {
    const omml: OmmlNode = {
      "m:oMath": {
        "m:f": {
          "m:num": { "m:r": { "m:t": "a" } },
          "m:den": { "m:r": { "m:t": "b" } },
        },
      },
    };
    const result = convertOmmlToMathMl(omml);
    expect(result).toContain("<mfrac>");
    expect(result).toContain("<mi>a</mi>");
    expect(result).toContain("<mi>b</mi>");
  });

  it("converts a linear fraction", () => {
    const omml: OmmlNode = {
      "m:oMath": {
        "m:f": {
          "m:fPr": { "m:type": { "@_val": "lin" } } as unknown as OmmlNode,
          "m:num": { "m:r": { "m:t": "a" } },
          "m:den": { "m:r": { "m:t": "b" } },
        },
      },
    };
    const result = convertOmmlToMathMl(omml);
    expect(result).toContain("<mo>/</mo>");
    expect(result).not.toContain("<mfrac>");
  });

  // ── Superscript ──────────────────────────────────────────────────────

  it("converts a superscript x^2", () => {
    const omml: OmmlNode = {
      "m:oMath": {
        "m:sSup": {
          "m:e": { "m:r": { "m:t": "x" } },
          "m:sup": { "m:r": { "m:t": "2" } },
        },
      },
    };
    const result = convertOmmlToMathMl(omml);
    expect(result).toContain("<msup>");
    expect(result).toContain("<mi>x</mi>");
    expect(result).toContain("<mn>2</mn>");
  });

  // ── Subscript ────────────────────────────────────────────────────────

  it("converts a subscript a_i", () => {
    const omml: OmmlNode = {
      "m:oMath": {
        "m:sSub": {
          "m:e": { "m:r": { "m:t": "a" } },
          "m:sub": { "m:r": { "m:t": "i" } },
        },
      },
    };
    const result = convertOmmlToMathMl(omml);
    expect(result).toContain("<msub>");
    expect(result).toContain("<mi>a</mi>");
    expect(result).toContain("<mi>i</mi>");
  });

  // ── Sub + Sup ────────────────────────────────────────────────────────

  it("converts simultaneous subscript and superscript", () => {
    const omml: OmmlNode = {
      "m:oMath": {
        "m:sSubSup": {
          "m:e": { "m:r": { "m:t": "x" } },
          "m:sub": { "m:r": { "m:t": "i" } },
          "m:sup": { "m:r": { "m:t": "2" } },
        },
      },
    };
    const result = convertOmmlToMathMl(omml);
    expect(result).toContain("<msubsup>");
  });

  // ── Radical ──────────────────────────────────────────────────────────

  it("converts a square root", () => {
    const omml: OmmlNode = {
      "m:oMath": {
        "m:rad": {
          "m:radPr": {
            "m:degHide": { "@_val": "1" },
          } as unknown as OmmlNode,
          "m:e": { "m:r": { "m:t": "x" } },
        },
      },
    };
    const result = convertOmmlToMathMl(omml);
    expect(result).toContain("<msqrt>");
    expect(result).toContain("<mi>x</mi>");
  });

  it("converts an nth root", () => {
    const omml: OmmlNode = {
      "m:oMath": {
        "m:rad": {
          "m:deg": { "m:r": { "m:t": "3" } },
          "m:e": { "m:r": { "m:t": "x" } },
        },
      },
    };
    const result = convertOmmlToMathMl(omml);
    expect(result).toContain("<mroot>");
  });

  // ── Nary (integral / sum) ────────────────────────────────────────────

  it("converts an integral with limits", () => {
    const omml: OmmlNode = {
      "m:oMath": {
        "m:nary": {
          "m:naryPr": {
            "m:chr": { "@_val": "\u222B" },
          } as unknown as OmmlNode,
          "m:sub": { "m:r": { "m:t": "0" } },
          "m:sup": { "m:r": { "m:t": "1" } },
          "m:e": { "m:r": { "m:t": "f" } },
        },
      },
    };
    const result = convertOmmlToMathMl(omml);
    expect(result).toContain("\u222B");
    expect(result).toContain("<mn>0</mn>");
    expect(result).toContain("<mn>1</mn>");
    expect(result).toContain("<mi>f</mi>");
  });

  it("converts a summation with undOvr limits", () => {
    const omml: OmmlNode = {
      "m:oMath": {
        "m:nary": {
          "m:naryPr": {
            "m:chr": { "@_val": "\u2211" },
            "m:limLoc": { "@_val": "undOvr" },
          } as unknown as OmmlNode,
          "m:sub": { "m:r": { "m:t": "i" } },
          "m:sup": { "m:r": { "m:t": "n" } },
          "m:e": { "m:r": { "m:t": "x" } },
        },
      },
    };
    const result = convertOmmlToMathMl(omml);
    expect(result).toContain("<munderover>");
  });

  // ── Delimiter ────────────────────────────────────────────────────────

  it("converts parenthesized content", () => {
    const omml: OmmlNode = {
      "m:oMath": {
        "m:d": {
          "m:e": { "m:r": { "m:t": "x" } },
        },
      },
    };
    const result = convertOmmlToMathMl(omml);
    expect(result).toContain("<mo>(</mo>");
    expect(result).toContain("<mo>)</mo>");
    expect(result).toContain("<mi>x</mi>");
  });

  // ── Accent ───────────────────────────────────────────────────────────

  it("converts an accent", () => {
    const omml: OmmlNode = {
      "m:oMath": {
        "m:acc": {
          "m:accPr": {
            "m:chr": { "@_val": "\u0302" },
          } as unknown as OmmlNode,
          "m:e": { "m:r": { "m:t": "x" } },
        },
      },
    };
    const result = convertOmmlToMathMl(omml);
    expect(result).toContain('<mover accent="true">');
  });

  // ── Bar ──────────────────────────────────────────────────────────────

  it("converts an overbar", () => {
    const omml: OmmlNode = {
      "m:oMath": {
        "m:bar": {
          "m:e": { "m:r": { "m:t": "x" } },
        },
      },
    };
    const result = convertOmmlToMathMl(omml);
    expect(result).toContain("<mover>");
    expect(result).toContain("\u00AF");
  });

  // ── Matrix ───────────────────────────────────────────────────────────

  it("converts a matrix", () => {
    const omml: OmmlNode = {
      "m:oMath": {
        "m:m": {
          "m:mr": [
            {
              "m:e": [
                { "m:r": { "m:t": "1" } } as OmmlNode,
                { "m:r": { "m:t": "0" } } as OmmlNode,
              ],
            } as OmmlNode,
            {
              "m:e": [
                { "m:r": { "m:t": "0" } } as OmmlNode,
                { "m:r": { "m:t": "1" } } as OmmlNode,
              ],
            } as OmmlNode,
          ],
        },
      },
    };
    const result = convertOmmlToMathMl(omml);
    expect(result).toContain("<mtable>");
    expect(result).toContain("<mn>1</mn>");
  });

  // ── Function ─────────────────────────────────────────────────────────

  it("converts a function application", () => {
    const omml: OmmlNode = {
      "m:oMath": {
        "m:func": {
          "m:fName": { "m:r": { "m:t": "sin" } },
          "m:e": { "m:r": { "m:t": "x" } },
        },
      },
    };
    const result = convertOmmlToMathMl(omml);
    expect(result).toContain("sin");
    expect(result).toContain("&#x2061;");
  });

  // ── oMathPara wrapper ────────────────────────────────────────────────

  it("finds m:oMath inside m:oMathPara", () => {
    const omml: OmmlNode = {
      "m:oMathPara": {
        "m:oMath": { "m:r": { "m:t": "x" } },
      },
    };
    const result = convertOmmlToMathMl(omml);
    expect(result).toContain("<mi>x</mi>");
  });

  // ── Direct node with m:r (fallback) ──────────────────────────────────

  it("handles a direct node that has m:r without m:oMath wrapper", () => {
    const omml: OmmlNode = {
      "m:r": { "m:t": "y" },
    };
    const result = convertOmmlToMathMl(omml);
    expect(result).toContain("<mi>y</mi>");
  });

  // ── Nested structures ────────────────────────────────────────────────

  it("converts nested fraction inside superscript", () => {
    const omml: OmmlNode = {
      "m:oMath": {
        "m:sSup": {
          "m:e": { "m:r": { "m:t": "e" } },
          "m:sup": {
            "m:f": {
              "m:num": { "m:r": { "m:t": "1" } },
              "m:den": { "m:r": { "m:t": "2" } },
            },
          },
        },
      },
    };
    const result = convertOmmlToMathMl(omml);
    expect(result).toContain("<msup>");
    expect(result).toContain("<mfrac>");
    expect(result).toContain("<mi>e</mi>");
  });

  // ── Multiple runs ────────────────────────────────────────────────────

  it("converts multiple runs in sequence", () => {
    const omml: OmmlNode = {
      "m:oMath": {
        "m:r": [
          { "m:t": "a" } as OmmlNode,
          { "m:t": "+" } as OmmlNode,
          { "m:t": "b" } as OmmlNode,
        ],
      },
    };
    const result = convertOmmlToMathMl(omml);
    expect(result).toContain("<mi>a</mi>");
    expect(result).toContain("<mo>+</mo>");
    expect(result).toContain("<mi>b</mi>");
  });

  // ── Output format ────────────────────────────────────────────────────

  it("wraps output in <math> with correct namespace and display", () => {
    const omml: OmmlNode = {
      "m:oMath": { "m:r": { "m:t": "x" } },
    };
    const result = convertOmmlToMathMl(omml);
    expect(result).toMatch(/^<math xmlns="http:\/\/www\.w3\.org\/1998\/Math\/MathML" display="inline">.*<\/math>$/);
  });

  // ── LimLow ───────────────────────────────────────────────────────────

  it("converts limLow", () => {
    const omml: OmmlNode = {
      "m:oMath": {
        "m:limLow": {
          "m:e": { "m:r": { "m:t": "lim" } },
          "m:lim": { "m:r": { "m:t": "n" } },
        },
      },
    };
    const result = convertOmmlToMathMl(omml);
    expect(result).toContain("<munder>");
  });

  // ── LimUpp ───────────────────────────────────────────────────────────

  it("converts limUpp", () => {
    const omml: OmmlNode = {
      "m:oMath": {
        "m:limUpp": {
          "m:e": { "m:r": { "m:t": "max" } },
          "m:lim": { "m:r": { "m:t": "k" } },
        },
      },
    };
    const result = convertOmmlToMathMl(omml);
    expect(result).toContain("<mover>");
  });

  // ── EqArr ────────────────────────────────────────────────────────────

  it("converts equation array", () => {
    const omml: OmmlNode = {
      "m:oMath": {
        "m:eqArr": {
          "m:e": [
            { "m:r": { "m:t": "a" } } as OmmlNode,
            { "m:r": { "m:t": "b" } } as OmmlNode,
          ],
        },
      },
    };
    const result = convertOmmlToMathMl(omml);
    expect(result).toContain('<mtable columnalign="left">');
  });

  // ── Box / borderBox ──────────────────────────────────────────────────

  it("converts box", () => {
    const omml: OmmlNode = {
      "m:oMath": {
        "m:box": {
          "m:e": { "m:r": { "m:t": "z" } },
        },
      },
    };
    const result = convertOmmlToMathMl(omml);
    expect(result).toContain("<mi>z</mi>");
  });

  it("converts borderBox", () => {
    const omml: OmmlNode = {
      "m:oMath": {
        "m:borderBox": {
          "m:e": { "m:r": { "m:t": "w" } },
        },
      },
    };
    const result = convertOmmlToMathMl(omml);
    expect(result).toContain("<mi>w</mi>");
  });

  // ── GroupChr ─────────────────────────────────────────────────────────

  it("converts groupChr", () => {
    const omml: OmmlNode = {
      "m:oMath": {
        "m:groupChr": {
          "m:groupChrPr": {
            "m:chr": { "@_val": "\u23DF" },
          } as unknown as OmmlNode,
          "m:e": { "m:r": { "m:t": "abc" } },
        },
      },
    };
    const result = convertOmmlToMathMl(omml);
    expect(result).toContain("<munder>");
  });

  // ── Pre sub/sup ──────────────────────────────────────────────────────

  it("converts pre-subscript/superscript", () => {
    const omml: OmmlNode = {
      "m:oMath": {
        "m:sPre": {
          "m:e": { "m:r": { "m:t": "C" } },
          "m:sub": { "m:r": { "m:t": "6" } },
          "m:sup": { "m:r": { "m:t": "12" } },
        },
      },
    };
    const result = convertOmmlToMathMl(omml);
    expect(result).toContain("<mmultiscripts>");
  });

  // ── Multiple oMath in oMathPara ──────────────────────────────────────

  it("handles node with m:f fallback (no m:oMath wrapper)", () => {
    const omml: OmmlNode = {
      "m:f": {
        "m:num": { "m:r": { "m:t": "x" } },
        "m:den": { "m:r": { "m:t": "y" } },
      },
    };
    const result = convertOmmlToMathMl(omml);
    expect(result).toContain("<mfrac>");
  });
});
