import { describe, it, expect } from "vitest";
import {
  child,
  ensureArray,
  attr,
  val,
  escapeXml,
  isOperator,
  isNumeric,
  ACCENT_MAP,
  NARY_CHAR_MAP,
  DELIM_BEGIN_MAP,
  DELIM_END_MAP,
} from "./omml-helpers";
import type { OmmlNode } from "./omml-helpers";

// ── child ────────────────────────────────────────────────────────────────

describe("child", () => {
  it("returns the child node when it exists and is an object", () => {
    const node: OmmlNode = { "m:rPr": { "m:nor": { "@_val": "1" } } };
    const result = child(node, "m:rPr");
    expect(result).toEqual({ "m:nor": { "@_val": "1" } });
  });

  it("returns empty object for missing key", () => {
    const node: OmmlNode = { "m:t": "hello" };
    expect(child(node, "m:rPr")).toEqual({});
  });

  it("returns empty object for undefined node", () => {
    expect(child(undefined, "m:rPr")).toEqual({});
  });

  it("returns empty object if value is a string", () => {
    const node: OmmlNode = { "m:t": "hello" };
    expect(child(node, "m:t")).toEqual({});
  });

  it("returns empty object if value is an array", () => {
    const node: OmmlNode = { "m:r": [{ "m:t": "a" }, { "m:t": "b" }] };
    expect(child(node, "m:r")).toEqual({});
  });

  it("returns empty object if value is a number", () => {
    const node: OmmlNode = { "@_val": 42 };
    expect(child(node, "@_val")).toEqual({});
  });
});

// ── ensureArray ──────────────────────────────────────────────────────────

describe("ensureArray", () => {
  it("wraps a single object into an array", () => {
    const node: OmmlNode = { "m:t": "x" };
    expect(ensureArray(node)).toEqual([{ "m:t": "x" }]);
  });

  it("passes an existing array through unchanged", () => {
    const arr: OmmlNode[] = [{ "m:t": "a" }, { "m:t": "b" }];
    expect(ensureArray(arr)).toBe(arr);
  });

  it("returns empty array for undefined", () => {
    expect(ensureArray(undefined)).toEqual([]);
  });

  it("returns empty array for null", () => {
    expect(ensureArray(null as unknown as undefined)).toEqual([]);
  });

  it("returns empty array for a string value", () => {
    expect(ensureArray("text" as unknown as undefined)).toEqual([]);
  });

  it("returns empty array for a number value", () => {
    expect(ensureArray(42 as unknown as undefined)).toEqual([]);
  });

  it("returns empty array for a boolean value", () => {
    expect(ensureArray(true as unknown as undefined)).toEqual([]);
  });
});

// ── attr ─────────────────────────────────────────────────────────────────

describe("attr", () => {
  it("reads a string attribute with @_ prefix", () => {
    const node: OmmlNode = { "@_val": "1" };
    expect(attr(node, "val")).toBe("1");
  });

  it("converts a numeric attribute to string", () => {
    const node: OmmlNode = { "@_val": 42 };
    expect(attr(node, "val")).toBe("42");
  });

  it("returns empty string for missing attribute", () => {
    const node: OmmlNode = { "m:t": "x" };
    expect(attr(node, "val")).toBe("");
  });

  it("returns empty string for undefined node", () => {
    expect(attr(undefined, "val")).toBe("");
  });

  it("returns empty string for boolean true attribute", () => {
    const node: OmmlNode = { "@_val": true };
    expect(attr(node, "val")).toBe("true");
  });
});

// ── val ──────────────────────────────────────────────────────────────────

describe("val", () => {
  it("reads @_val attribute", () => {
    const node: OmmlNode = { "@_val": "on" };
    expect(val(node)).toBe("on");
  });

  it("returns empty string for missing @_val", () => {
    const node: OmmlNode = { "m:t": "x" };
    expect(val(node)).toBe("");
  });

  it("returns empty string for undefined node", () => {
    expect(val(undefined)).toBe("");
  });
});

// ── escapeXml ────────────────────────────────────────────────────────────

describe("escapeXml", () => {
  it("escapes ampersand", () => {
    expect(escapeXml("a&b")).toBe("a&amp;b");
  });

  it("escapes less-than sign", () => {
    expect(escapeXml("a<b")).toBe("a&lt;b");
  });

  it("escapes greater-than sign", () => {
    expect(escapeXml("a>b")).toBe("a&gt;b");
  });

  it("escapes all special characters together", () => {
    expect(escapeXml("<x&y>")).toBe("&lt;x&amp;y&gt;");
  });

  it("returns plain text unchanged", () => {
    expect(escapeXml("hello")).toBe("hello");
  });

  it("handles empty string", () => {
    expect(escapeXml("")).toBe("");
  });

  it("escapes multiple ampersands", () => {
    expect(escapeXml("a&&b")).toBe("a&amp;&amp;b");
  });
});

// ── isOperator ───────────────────────────────────────────────────────────

describe("isOperator", () => {
  it("recognizes +", () => {
    expect(isOperator("+")).toBe(true);
  });

  it("recognizes -", () => {
    expect(isOperator("-")).toBe(true);
  });

  it("recognizes ×", () => {
    expect(isOperator("×")).toBe(true);
  });

  it("recognizes ÷", () => {
    expect(isOperator("÷")).toBe(true);
  });

  it("recognizes =", () => {
    expect(isOperator("=")).toBe(true);
  });

  it("recognizes ≤", () => {
    expect(isOperator("≤")).toBe(true);
  });

  it("recognizes ≥", () => {
    expect(isOperator("≥")).toBe(true);
  });

  it("recognizes ∈", () => {
    expect(isOperator("∈")).toBe(true);
  });

  it("recognizes comma", () => {
    expect(isOperator(",")).toBe(true);
  });

  it("recognizes parentheses as operators", () => {
    expect(isOperator("(")).toBe(true);
    expect(isOperator(")")).toBe(true);
  });

  it("recognizes brackets as operators", () => {
    expect(isOperator("[")).toBe(true);
    expect(isOperator("]")).toBe(true);
  });

  it("recognizes pipe", () => {
    expect(isOperator("|")).toBe(true);
  });

  it("rejects letters", () => {
    expect(isOperator("x")).toBe(false);
    expect(isOperator("a")).toBe(false);
  });

  it("rejects digits", () => {
    expect(isOperator("0")).toBe(false);
    expect(isOperator("9")).toBe(false);
  });

  it("handles whitespace trimming", () => {
    expect(isOperator(" + ")).toBe(true);
  });

  it("rejects empty string", () => {
    expect(isOperator("")).toBe(false);
  });
});

// ── isNumeric ────────────────────────────────────────────────────────────

describe("isNumeric", () => {
  it("recognizes integer", () => {
    expect(isNumeric("123")).toBe(true);
  });

  it("recognizes decimal number", () => {
    expect(isNumeric("3.14")).toBe(true);
  });

  it("recognizes comma-separated number", () => {
    expect(isNumeric("1,000")).toBe(true);
  });

  it("rejects alphabetic text", () => {
    expect(isNumeric("abc")).toBe(false);
  });

  it("rejects mixed alphanumeric", () => {
    expect(isNumeric("12a")).toBe(false);
  });

  it("recognizes single digit", () => {
    expect(isNumeric("0")).toBe(true);
  });

  it("rejects empty string", () => {
    expect(isNumeric("")).toBe(false);
  });

  it("trims whitespace before testing", () => {
    expect(isNumeric(" 42 ")).toBe(true);
  });

  it("rejects a dot alone", () => {
    expect(isNumeric(".")).toBe(false);
  });

  it("rejects negative numbers (minus sign not in regex)", () => {
    expect(isNumeric("-5")).toBe(false);
  });
});

// ── ACCENT_MAP ───────────────────────────────────────────────────────────

describe("ACCENT_MAP", () => {
  it("maps combining circumflex to hat", () => {
    expect(ACCENT_MAP["\u0302"]).toBe("\u005E");
  });

  it("maps combining tilde to tilde", () => {
    expect(ACCENT_MAP["\u0303"]).toBe("\u007E");
  });

  it("maps combining macron to bar", () => {
    expect(ACCENT_MAP["\u0304"]).toBe("\u00AF");
  });

  it("maps combining overline to bar", () => {
    expect(ACCENT_MAP["\u0305"]).toBe("\u00AF");
  });

  it("maps combining dot above to dot", () => {
    expect(ACCENT_MAP["\u0307"]).toBe("\u02D9");
  });

  it("maps combining diaeresis to diaeresis", () => {
    expect(ACCENT_MAP["\u0308"]).toBe("\u00A8");
  });

  it("maps combining caron to caron", () => {
    expect(ACCENT_MAP["\u030C"]).toBe("\u02C7");
  });

  it("maps combining underbar to underscore", () => {
    expect(ACCENT_MAP["\u0332"]).toBe("_");
  });

  it("maps combining right arrow above to arrow", () => {
    expect(ACCENT_MAP["\u20D7"]).toBe("\u2192");
  });

  it("maps standalone hat to itself", () => {
    expect(ACCENT_MAP["\u005E"]).toBe("\u005E");
  });

  it("maps standalone tilde to itself", () => {
    expect(ACCENT_MAP["\u007E"]).toBe("\u007E");
  });
});

// ── NARY_CHAR_MAP ────────────────────────────────────────────────────────

describe("NARY_CHAR_MAP", () => {
  it("maps ∑ to itself", () => {
    expect(NARY_CHAR_MAP["\u2211"]).toBe("\u2211");
  });

  it("maps ∏ to itself", () => {
    expect(NARY_CHAR_MAP["\u220F"]).toBe("\u220F");
  });

  it("maps ∫ to itself", () => {
    expect(NARY_CHAR_MAP["\u222B"]).toBe("\u222B");
  });

  it("maps ∬ to itself", () => {
    expect(NARY_CHAR_MAP["\u222C"]).toBe("\u222C");
  });

  it("maps ∮ to itself", () => {
    expect(NARY_CHAR_MAP["\u222E"]).toBe("\u222E");
  });

  it("maps ⋃ to itself", () => {
    expect(NARY_CHAR_MAP["\u22C3"]).toBe("\u22C3");
  });

  it("maps ⋂ to itself", () => {
    expect(NARY_CHAR_MAP["\u22C2"]).toBe("\u22C2");
  });
});

// ── DELIM_BEGIN_MAP / DELIM_END_MAP ──────────────────────────────────────

describe("DELIM_BEGIN_MAP", () => {
  it("maps ( to (", () => {
    expect(DELIM_BEGIN_MAP["("]).toBe("(");
  });

  it("maps [ to [", () => {
    expect(DELIM_BEGIN_MAP["["]).toBe("[");
  });

  it("maps { to {", () => {
    expect(DELIM_BEGIN_MAP["{"]).toBe("{");
  });

  it("maps | to |", () => {
    expect(DELIM_BEGIN_MAP["|"]).toBe("|");
  });

  it("maps ⟨ to angle bracket", () => {
    expect(DELIM_BEGIN_MAP["⟨"]).toBe("\u27E8");
  });

  it("maps ⌈ to ceiling bracket", () => {
    expect(DELIM_BEGIN_MAP["⌈"]).toBe("\u2308");
  });

  it("maps ⌊ to floor bracket", () => {
    expect(DELIM_BEGIN_MAP["⌊"]).toBe("\u230A");
  });
});

describe("DELIM_END_MAP", () => {
  it("maps ) to )", () => {
    expect(DELIM_END_MAP[")"]).toBe(")");
  });

  it("maps ] to ]", () => {
    expect(DELIM_END_MAP["]"]).toBe("]");
  });

  it("maps } to }", () => {
    expect(DELIM_END_MAP["}"]).toBe("}");
  });

  it("maps | to |", () => {
    expect(DELIM_END_MAP["|"]).toBe("|");
  });

  it("maps ⟩ to angle bracket", () => {
    expect(DELIM_END_MAP["⟩"]).toBe("\u27E9");
  });

  it("maps ⌉ to ceiling bracket", () => {
    expect(DELIM_END_MAP["⌉"]).toBe("\u2309");
  });

  it("maps ⌋ to floor bracket", () => {
    expect(DELIM_END_MAP["⌋"]).toBe("\u230B");
  });
});
