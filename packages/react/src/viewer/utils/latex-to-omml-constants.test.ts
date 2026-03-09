import { describe, it, expect } from "vitest";
import {
  GREEK_MAP,
  OPERATOR_MAP,
  NARY_MAP,
  FUNC_NAMES,
  tokenize,
} from "./latex-to-omml-constants";

// ── GREEK_MAP ────────────────────────────────────────────────────────────

describe("GREEK_MAP", () => {
  it("maps \\alpha to α", () => {
    expect(GREEK_MAP["\\alpha"]).toBe("\u03B1");
  });

  it("maps \\beta to β", () => {
    expect(GREEK_MAP["\\beta"]).toBe("\u03B2");
  });

  it("maps \\gamma to γ", () => {
    expect(GREEK_MAP["\\gamma"]).toBe("\u03B3");
  });

  it("maps \\delta to δ", () => {
    expect(GREEK_MAP["\\delta"]).toBe("\u03B4");
  });

  it("maps \\theta to θ", () => {
    expect(GREEK_MAP["\\theta"]).toBe("\u03B8");
  });

  it("maps \\lambda to λ", () => {
    expect(GREEK_MAP["\\lambda"]).toBe("\u03BB");
  });

  it("maps \\pi to π", () => {
    expect(GREEK_MAP["\\pi"]).toBe("\u03C0");
  });

  it("maps \\sigma to σ", () => {
    expect(GREEK_MAP["\\sigma"]).toBe("\u03C3");
  });

  it("maps \\omega to ω", () => {
    expect(GREEK_MAP["\\omega"]).toBe("\u03C9");
  });

  it("maps \\Gamma to Γ (uppercase)", () => {
    expect(GREEK_MAP["\\Gamma"]).toBe("\u0393");
  });

  it("maps \\Delta to Δ (uppercase)", () => {
    expect(GREEK_MAP["\\Delta"]).toBe("\u0394");
  });

  it("maps \\Omega to Ω (uppercase)", () => {
    expect(GREEK_MAP["\\Omega"]).toBe("\u03A9");
  });

  it("maps \\Sigma to Σ (uppercase)", () => {
    expect(GREEK_MAP["\\Sigma"]).toBe("\u03A3");
  });

  it("maps \\Phi to Φ (uppercase)", () => {
    expect(GREEK_MAP["\\Phi"]).toBe("\u03A6");
  });

  it("maps \\varepsilon to ε (variant)", () => {
    expect(GREEK_MAP["\\varepsilon"]).toBe("\u03B5");
  });

  it("maps \\varphi to ϕ (variant)", () => {
    expect(GREEK_MAP["\\varphi"]).toBe("\u03D5");
  });

  it("does not contain non-Greek commands", () => {
    expect(GREEK_MAP["\\frac"]).toBeUndefined();
    expect(GREEK_MAP["\\sum"]).toBeUndefined();
  });
});

// ── OPERATOR_MAP ─────────────────────────────────────────────────────────

describe("OPERATOR_MAP", () => {
  it("maps \\times to ×", () => {
    expect(OPERATOR_MAP["\\times"]).toBe("\u00D7");
  });

  it("maps \\div to ÷", () => {
    expect(OPERATOR_MAP["\\div"]).toBe("\u00F7");
  });

  it("maps \\pm to ±", () => {
    expect(OPERATOR_MAP["\\pm"]).toBe("\u00B1");
  });

  it("maps \\leq to ≤", () => {
    expect(OPERATOR_MAP["\\leq"]).toBe("\u2264");
  });

  it("maps \\geq to ≥", () => {
    expect(OPERATOR_MAP["\\geq"]).toBe("\u2265");
  });

  it("maps \\neq to ≠", () => {
    expect(OPERATOR_MAP["\\neq"]).toBe("\u2260");
  });

  it("maps \\approx to ≈", () => {
    expect(OPERATOR_MAP["\\approx"]).toBe("\u2248");
  });

  it("maps \\in to ∈", () => {
    expect(OPERATOR_MAP["\\in"]).toBe("\u2208");
  });

  it("maps \\infty to ∞", () => {
    expect(OPERATOR_MAP["\\infty"]).toBe("\u221E");
  });

  it("maps \\to to →", () => {
    expect(OPERATOR_MAP["\\to"]).toBe("\u2192");
  });

  it("maps \\Rightarrow to ⇒", () => {
    expect(OPERATOR_MAP["\\Rightarrow"]).toBe("\u21D2");
  });

  it("maps \\partial to ∂", () => {
    expect(OPERATOR_MAP["\\partial"]).toBe("\u2202");
  });

  it("maps \\forall to ∀", () => {
    expect(OPERATOR_MAP["\\forall"]).toBe("\u2200");
  });

  it("maps \\exists to ∃", () => {
    expect(OPERATOR_MAP["\\exists"]).toBe("\u2203");
  });

  it("maps short aliases \\le and \\ge", () => {
    expect(OPERATOR_MAP["\\le"]).toBe("\u2264");
    expect(OPERATOR_MAP["\\ge"]).toBe("\u2265");
  });

  it("maps \\cdot to ·", () => {
    expect(OPERATOR_MAP["\\cdot"]).toBe("\u00B7");
  });
});

// ── NARY_MAP ─────────────────────────────────────────────────────────────

describe("NARY_MAP", () => {
  it("maps \\sum to ∑", () => {
    expect(NARY_MAP["\\sum"]).toBe("\u2211");
  });

  it("maps \\prod to ∏", () => {
    expect(NARY_MAP["\\prod"]).toBe("\u220F");
  });

  it("maps \\int to ∫", () => {
    expect(NARY_MAP["\\int"]).toBe("\u222B");
  });

  it("maps \\iint to ∬", () => {
    expect(NARY_MAP["\\iint"]).toBe("\u222C");
  });

  it("maps \\iiint to ∭", () => {
    expect(NARY_MAP["\\iiint"]).toBe("\u222D");
  });

  it("maps \\oint to ∮", () => {
    expect(NARY_MAP["\\oint"]).toBe("\u222E");
  });

  it("maps \\coprod to ∐", () => {
    expect(NARY_MAP["\\coprod"]).toBe("\u2210");
  });

  it("maps \\bigcup to ⋃", () => {
    expect(NARY_MAP["\\bigcup"]).toBe("\u22C3");
  });

  it("maps \\bigcap to ⋂", () => {
    expect(NARY_MAP["\\bigcap"]).toBe("\u22C2");
  });
});

// ── FUNC_NAMES ───────────────────────────────────────────────────────────

describe("FUNC_NAMES", () => {
  it("contains trigonometric functions", () => {
    expect(FUNC_NAMES.has("sin")).toBe(true);
    expect(FUNC_NAMES.has("cos")).toBe(true);
    expect(FUNC_NAMES.has("tan")).toBe(true);
    expect(FUNC_NAMES.has("cot")).toBe(true);
    expect(FUNC_NAMES.has("sec")).toBe(true);
    expect(FUNC_NAMES.has("csc")).toBe(true);
  });

  it("contains inverse trig functions", () => {
    expect(FUNC_NAMES.has("arcsin")).toBe(true);
    expect(FUNC_NAMES.has("arccos")).toBe(true);
    expect(FUNC_NAMES.has("arctan")).toBe(true);
  });

  it("contains hyperbolic functions", () => {
    expect(FUNC_NAMES.has("sinh")).toBe(true);
    expect(FUNC_NAMES.has("cosh")).toBe(true);
    expect(FUNC_NAMES.has("tanh")).toBe(true);
  });

  it("contains logarithmic functions", () => {
    expect(FUNC_NAMES.has("log")).toBe(true);
    expect(FUNC_NAMES.has("ln")).toBe(true);
    expect(FUNC_NAMES.has("exp")).toBe(true);
  });

  it("contains limit-related functions", () => {
    expect(FUNC_NAMES.has("lim")).toBe(true);
    expect(FUNC_NAMES.has("min")).toBe(true);
    expect(FUNC_NAMES.has("max")).toBe(true);
    expect(FUNC_NAMES.has("sup")).toBe(true);
    expect(FUNC_NAMES.has("inf")).toBe(true);
  });

  it("contains algebraic functions", () => {
    expect(FUNC_NAMES.has("det")).toBe(true);
    expect(FUNC_NAMES.has("dim")).toBe(true);
    expect(FUNC_NAMES.has("gcd")).toBe(true);
    expect(FUNC_NAMES.has("mod")).toBe(true);
    expect(FUNC_NAMES.has("ker")).toBe(true);
    expect(FUNC_NAMES.has("hom")).toBe(true);
    expect(FUNC_NAMES.has("deg")).toBe(true);
  });

  it("does not contain non-function names", () => {
    expect(FUNC_NAMES.has("frac")).toBe(false);
    expect(FUNC_NAMES.has("sqrt")).toBe(false);
    expect(FUNC_NAMES.has("alpha")).toBe(false);
  });
});

// ── tokenize ─────────────────────────────────────────────────────────────

describe("tokenize", () => {
  it("tokenizes a single text character", () => {
    expect(tokenize("x")).toEqual([{ type: "text", value: "x" }]);
  });

  it("tokenizes multiple text characters individually", () => {
    expect(tokenize("ab")).toEqual([
      { type: "text", value: "a" },
      { type: "text", value: "b" },
    ]);
  });

  it("tokenizes a backslash command", () => {
    expect(tokenize("\\alpha")).toEqual([
      { type: "command", value: "\\alpha" },
    ]);
  });

  it("tokenizes multiple commands", () => {
    const tokens = tokenize("\\alpha\\beta");
    expect(tokens).toEqual([
      { type: "command", value: "\\alpha" },
      { type: "command", value: "\\beta" },
    ]);
  });

  it("tokenizes group start and end", () => {
    expect(tokenize("{x}")).toEqual([
      { type: "group_start", value: "{" },
      { type: "text", value: "x" },
      { type: "group_end", value: "}" },
    ]);
  });

  it("tokenizes superscript", () => {
    expect(tokenize("x^2")).toEqual([
      { type: "text", value: "x" },
      { type: "superscript", value: "^" },
      { type: "text", value: "2" },
    ]);
  });

  it("tokenizes subscript", () => {
    expect(tokenize("a_i")).toEqual([
      { type: "text", value: "a" },
      { type: "subscript", value: "_" },
      { type: "text", value: "i" },
    ]);
  });

  it("tokenizes \\frac{a}{b} correctly", () => {
    expect(tokenize("\\frac{a}{b}")).toEqual([
      { type: "command", value: "\\frac" },
      { type: "group_start", value: "{" },
      { type: "text", value: "a" },
      { type: "group_end", value: "}" },
      { type: "group_start", value: "{" },
      { type: "text", value: "b" },
      { type: "group_end", value: "}" },
    ]);
  });

  it("tokenizes whitespace as whitespace tokens", () => {
    const tokens = tokenize("x y");
    expect(tokens).toEqual([
      { type: "text", value: "x" },
      { type: "whitespace", value: " " },
      { type: "text", value: "y" },
    ]);
  });

  it("tokenizes special escaped characters like \\{", () => {
    expect(tokenize("\\{")).toEqual([{ type: "command", value: "\\{" }]);
  });

  it("tokenizes double backslash \\\\", () => {
    expect(tokenize("\\\\")).toEqual([{ type: "command", value: "\\\\" }]);
  });

  it("tokenizes complex expression with mixed elements", () => {
    const tokens = tokenize("x^{2}+y");
    expect(tokens).toEqual([
      { type: "text", value: "x" },
      { type: "superscript", value: "^" },
      { type: "group_start", value: "{" },
      { type: "text", value: "2" },
      { type: "group_end", value: "}" },
      { type: "text", value: "+" },
      { type: "text", value: "y" },
    ]);
  });

  it("tokenizes an empty string to an empty array", () => {
    expect(tokenize("")).toEqual([]);
  });

  it("tokenizes subscript and superscript together", () => {
    const tokens = tokenize("x_i^2");
    expect(tokens).toEqual([
      { type: "text", value: "x" },
      { type: "subscript", value: "_" },
      { type: "text", value: "i" },
      { type: "superscript", value: "^" },
      { type: "text", value: "2" },
    ]);
  });

  it("tokenizes nested groups", () => {
    const tokens = tokenize("{a{b}}");
    expect(tokens).toEqual([
      { type: "group_start", value: "{" },
      { type: "text", value: "a" },
      { type: "group_start", value: "{" },
      { type: "text", value: "b" },
      { type: "group_end", value: "}" },
      { type: "group_end", value: "}" },
    ]);
  });

  it("tokenizes a trailing backslash as an empty command", () => {
    // Lone backslash at end — no following char
    const tokens = tokenize("\\");
    expect(tokens).toEqual([{ type: "command", value: "\\" }]);
  });

  it("tokenizes consecutive whitespace as separate tokens", () => {
    const tokens = tokenize("a  b");
    expect(tokens.length).toBe(4);
    expect(tokens[1]).toEqual({ type: "whitespace", value: " " });
    expect(tokens[2]).toEqual({ type: "whitespace", value: " " });
  });
});
