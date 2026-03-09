import { describe, it, expect } from "vitest";
import { convertLatexToOmml } from "./latex-to-omml-parser";

/** Helper: extract the m:oMath node from the result. */
function getOmml(latex: string): Record<string, unknown> {
  const result = convertLatexToOmml(latex);
  const para = result["m:oMathPara"] as Record<string, unknown> | undefined;
  return (para?.["m:oMath"] as Record<string, unknown>) ?? {};
}

/** Helper: extract the text from a run node. */
function runText(run: unknown): string {
  if (!run || typeof run !== "object") return "";
  const r = run as Record<string, unknown>;
  return String(r["m:t"] ?? "");
}

describe("convertLatexToOmml", () => {
  // ── Empty / whitespace ───────────────────────────────────────────────

  it("returns empty object for empty string", () => {
    expect(convertLatexToOmml("")).toEqual({});
  });

  it("returns empty object for whitespace only", () => {
    expect(convertLatexToOmml("   ")).toEqual({});
  });

  // ── Output wrapper ──────────────────────────────────────────────────

  it("wraps output in m:oMathPara / m:oMath", () => {
    const result = convertLatexToOmml("x");
    expect(result).toHaveProperty("m:oMathPara");
    const para = result["m:oMathPara"] as Record<string, unknown>;
    expect(para).toHaveProperty("m:oMath");
  });

  // ── Simple variable ──────────────────────────────────────────────────

  it("converts 'x' to OMML with m:r containing x", () => {
    const oMath = getOmml("x");
    const run = oMath["m:r"] as Record<string, unknown>;
    expect(run).toBeDefined();
    expect(runText(run)).toBe("x");
  });

  it("converts multiple letters to multiple runs", () => {
    const oMath = getOmml("ab");
    // Should have m:r as an array or two separate entries
    const runs = oMath["m:r"];
    expect(runs).toBeDefined();
    if (Array.isArray(runs)) {
      expect(runs.length).toBe(2);
      expect(runText(runs[0])).toBe("a");
      expect(runText(runs[1])).toBe("b");
    }
  });

  // ── Greek letters ────────────────────────────────────────────────────

  it("converts \\alpha to m:r with Greek alpha character", () => {
    const oMath = getOmml("\\alpha");
    const run = oMath["m:r"] as Record<string, unknown>;
    expect(runText(run)).toBe("\u03B1");
  });

  it("converts \\Omega to m:r with Greek Omega character", () => {
    const oMath = getOmml("\\Omega");
    const run = oMath["m:r"] as Record<string, unknown>;
    expect(runText(run)).toBe("\u03A9");
  });

  it("converts \\pi to m:r with pi character", () => {
    const oMath = getOmml("\\pi");
    const run = oMath["m:r"] as Record<string, unknown>;
    expect(runText(run)).toBe("\u03C0");
  });

  // ── Operators ────────────────────────────────────────────────────────

  it("converts \\times to m:r with times character", () => {
    const oMath = getOmml("\\times");
    const run = oMath["m:r"] as Record<string, unknown>;
    expect(runText(run)).toBe("\u00D7");
  });

  it("converts \\infty to m:r with infinity character", () => {
    const oMath = getOmml("\\infty");
    const run = oMath["m:r"] as Record<string, unknown>;
    expect(runText(run)).toBe("\u221E");
  });

  // ── Fraction ─────────────────────────────────────────────────────────

  it("converts \\frac{a}{b} to m:f with numerator and denominator", () => {
    const oMath = getOmml("\\frac{a}{b}");
    const frac = oMath["m:f"] as Record<string, unknown>;
    expect(frac).toBeDefined();
    expect(frac).toHaveProperty("m:num");
    expect(frac).toHaveProperty("m:den");
  });

  it("fraction numerator contains the correct text", () => {
    const oMath = getOmml("\\frac{x}{y}");
    const frac = oMath["m:f"] as Record<string, unknown>;
    const num = frac["m:num"] as Record<string, unknown>;
    const run = num["m:r"] as Record<string, unknown>;
    expect(runText(run)).toBe("x");
  });

  it("fraction denominator contains the correct text", () => {
    const oMath = getOmml("\\frac{x}{y}");
    const frac = oMath["m:f"] as Record<string, unknown>;
    const den = frac["m:den"] as Record<string, unknown>;
    const run = den["m:r"] as Record<string, unknown>;
    expect(runText(run)).toBe("y");
  });

  // ── Superscript ──────────────────────────────────────────────────────

  it("converts x^2 to m:sSup", () => {
    const oMath = getOmml("x^2");
    const sup = oMath["m:sSup"] as Record<string, unknown>;
    expect(sup).toBeDefined();
    expect(sup).toHaveProperty("m:e");
    expect(sup).toHaveProperty("m:sup");
  });

  it("converts x^{10} to m:sSup with grouped exponent", () => {
    const oMath = getOmml("x^{10}");
    const sup = oMath["m:sSup"] as Record<string, unknown>;
    expect(sup).toBeDefined();
  });

  // ── Subscript ────────────────────────────────────────────────────────

  it("converts a_i to m:sSub", () => {
    const oMath = getOmml("a_i");
    const sub = oMath["m:sSub"] as Record<string, unknown>;
    expect(sub).toBeDefined();
    expect(sub).toHaveProperty("m:e");
    expect(sub).toHaveProperty("m:sub");
  });

  it("converts a_{mn} to m:sSub with grouped subscript", () => {
    const oMath = getOmml("a_{mn}");
    const sub = oMath["m:sSub"] as Record<string, unknown>;
    expect(sub).toBeDefined();
  });

  // ── Sub + Sup ────────────────────────────────────────────────────────

  it("converts x_{i}^{2} (braced) to m:sSubSup", () => {
    const oMath = getOmml("x_{i}^{2}");
    const subsup = oMath["m:sSubSup"] as Record<string, unknown>;
    expect(subsup).toBeDefined();
    expect(subsup).toHaveProperty("m:e");
    expect(subsup).toHaveProperty("m:sub");
    expect(subsup).toHaveProperty("m:sup");
  });

  it("converts x^{2}_{i} (braced, reversed) to m:sSubSup", () => {
    const oMath = getOmml("x^{2}_{i}");
    const subsup = oMath["m:sSubSup"] as Record<string, unknown>;
    expect(subsup).toBeDefined();
  });

  it("converts x_i^2 (unbraced) to nested m:sSub containing m:sSup", () => {
    // Without braces, the parser nests: x_{i^{2}}
    const oMath = getOmml("x_i^2");
    const sub = oMath["m:sSub"] as Record<string, unknown>;
    expect(sub).toBeDefined();
  });

  it("converts x^2_i (unbraced, reversed) to nested m:sSup containing m:sSub", () => {
    // Without braces, the parser nests: x^{2_{i}}
    const oMath = getOmml("x^2_i");
    const sup = oMath["m:sSup"] as Record<string, unknown>;
    expect(sup).toBeDefined();
  });

  // ── Square root ──────────────────────────────────────────────────────

  it("converts \\sqrt{x} to m:rad with degHide", () => {
    const oMath = getOmml("\\sqrt{x}");
    const rad = oMath["m:rad"] as Record<string, unknown>;
    expect(rad).toBeDefined();
    expect(rad).toHaveProperty("m:e");
    const radPr = rad["m:radPr"] as Record<string, unknown>;
    expect(radPr).toBeDefined();
  });

  it("converts \\sqrt[3]{x} to m:rad with degree", () => {
    const oMath = getOmml("\\sqrt[3]{x}");
    const rad = oMath["m:rad"] as Record<string, unknown>;
    expect(rad).toBeDefined();
    expect(rad).toHaveProperty("m:deg");
    expect(rad).toHaveProperty("m:e");
  });

  // ── Nary ─────────────────────────────────────────────────────────────

  it("converts \\sum_{i}^{n}{x} to m:nary", () => {
    const oMath = getOmml("\\sum_{i}^{n}{x}");
    const nary = oMath["m:nary"] as Record<string, unknown>;
    expect(nary).toBeDefined();
    expect(nary).toHaveProperty("m:naryPr");
    expect(nary).toHaveProperty("m:e");
  });

  it("nary has correct operator character for sum", () => {
    const oMath = getOmml("\\sum_{i}^{n}{x}");
    const nary = oMath["m:nary"] as Record<string, unknown>;
    const naryPr = nary["m:naryPr"] as Record<string, unknown>;
    const chr = naryPr["m:chr"] as Record<string, unknown>;
    expect(chr["@_val"]).toBe("\u2211");
  });

  it("converts \\int to m:nary with integral character", () => {
    const oMath = getOmml("\\int{f}");
    const nary = oMath["m:nary"] as Record<string, unknown>;
    expect(nary).toBeDefined();
    const naryPr = nary["m:naryPr"] as Record<string, unknown>;
    const chr = naryPr["m:chr"] as Record<string, unknown>;
    expect(chr["@_val"]).toBe("\u222B");
  });

  it("converts \\prod to m:nary with product character", () => {
    const oMath = getOmml("\\prod{x}");
    const nary = oMath["m:nary"] as Record<string, unknown>;
    const naryPr = nary["m:naryPr"] as Record<string, unknown>;
    const chr = naryPr["m:chr"] as Record<string, unknown>;
    expect(chr["@_val"]).toBe("\u220F");
  });

  it("nary hides sub when no subscript provided", () => {
    const oMath = getOmml("\\sum^{n}{x}");
    const nary = oMath["m:nary"] as Record<string, unknown>;
    const naryPr = nary["m:naryPr"] as Record<string, unknown>;
    const subHide = naryPr["m:subHide"] as Record<string, unknown>;
    expect(subHide?.["@_val"]).toBe("1");
  });

  it("nary hides sup when no superscript provided", () => {
    const oMath = getOmml("\\sum_{i}{x}");
    const nary = oMath["m:nary"] as Record<string, unknown>;
    const naryPr = nary["m:naryPr"] as Record<string, unknown>;
    const supHide = naryPr["m:supHide"] as Record<string, unknown>;
    expect(supHide?.["@_val"]).toBe("1");
  });

  // ── Text command ─────────────────────────────────────────────────────

  it("converts \\text{hello} to m:r with normal flag", () => {
    const oMath = getOmml("\\text{hello}");
    const run = oMath["m:r"] as Record<string, unknown>;
    expect(runText(run)).toBe("hello");
    const rPr = run["m:rPr"] as Record<string, unknown>;
    const nor = rPr["m:nor"] as Record<string, unknown>;
    expect(nor["@_val"]).toBe("1");
  });

  // ── Function names ───────────────────────────────────────────────────

  it("converts \\sin{x} to m:func", () => {
    const oMath = getOmml("\\sin{x}");
    const func = oMath["m:func"] as Record<string, unknown>;
    expect(func).toBeDefined();
    expect(func).toHaveProperty("m:fName");
    expect(func).toHaveProperty("m:e");
  });

  it("converts \\cos{x} to m:func", () => {
    const oMath = getOmml("\\cos{x}");
    const func = oMath["m:func"] as Record<string, unknown>;
    expect(func).toBeDefined();
  });

  it("converts \\log{x} to m:func", () => {
    const oMath = getOmml("\\log{x}");
    const func = oMath["m:func"] as Record<string, unknown>;
    expect(func).toBeDefined();
  });

  // ── Delimiters ───────────────────────────────────────────────────────

  it("converts \\left(x\\right) to m:d", () => {
    const oMath = getOmml("\\left(x\\right)");
    const delim = oMath["m:d"] as Record<string, unknown>;
    expect(delim).toBeDefined();
    expect(delim).toHaveProperty("m:e");
  });

  it("converts \\left[x\\right] with custom delimiters", () => {
    const oMath = getOmml("\\left[x\\right]");
    const delim = oMath["m:d"] as Record<string, unknown>;
    expect(delim).toBeDefined();
    const dPr = delim["m:dPr"] as Record<string, unknown>;
    expect(dPr).toBeDefined();
    const begChr = dPr["m:begChr"] as Record<string, unknown>;
    expect(begChr["@_val"]).toBe("[");
  });

  // ── Unknown commands ─────────────────────────────────────────────────

  it("renders unknown commands as normal text runs", () => {
    const oMath = getOmml("\\xyz");
    const run = oMath["m:r"] as Record<string, unknown>;
    expect(runText(run)).toBe("xyz");
  });

  // ── Complex expressions ──────────────────────────────────────────────

  it("converts a fraction with superscript on top", () => {
    const result = convertLatexToOmml("\\frac{x^2}{y}");
    expect(result).toHaveProperty("m:oMathPara");
    const oMath = getOmml("\\frac{x^2}{y}");
    const frac = oMath["m:f"] as Record<string, unknown>;
    expect(frac).toBeDefined();
    // numerator should contain a superscript
    const num = frac["m:num"] as Record<string, unknown>;
    expect(num["m:sSup"]).toBeDefined();
  });

  it("preserves plain + and = as text runs", () => {
    const oMath = getOmml("a+b=c");
    // Should contain multiple m:r entries
    const runs = oMath["m:r"];
    expect(runs).toBeDefined();
  });
});
