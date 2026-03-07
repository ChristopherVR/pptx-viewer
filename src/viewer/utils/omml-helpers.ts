/**
 * Types, helper functions, and lookup maps for OMML-to-MathML conversion.
 */

// ── Types ────────────────────────────────────────────────────────────────

/** Parsed XML node from fast-xml-parser (attributes prefixed with `@_`). */
export interface OmmlNode {
  [key: string]: OmmlNode | OmmlNode[] | string | number | boolean | undefined;
}

// ── Helpers ──────────────────────────────────────────────────────────────

/** Safely retrieve a child node, always returning an object (never undefined). */
export function child(node: OmmlNode | undefined, key: string): OmmlNode {
  if (!node) return {};
  const v = node[key];
  if (v && typeof v === "object" && !Array.isArray(v)) return v as OmmlNode;
  return {};
}

/** Ensure a value is an array of OmmlNode. */
export function ensureArray(val: OmmlNode[keyof OmmlNode]): OmmlNode[] {
  if (val === undefined || val === null) return [];
  if (Array.isArray(val)) return val as OmmlNode[];
  if (typeof val === "object") return [val as OmmlNode];
  return [];
}

/** Read a string attribute from a node. */
export function attr(node: OmmlNode | undefined, name: string): string {
  if (!node) return "";
  const v = node[`@_${name}`];
  return typeof v === "string" ? v : v !== undefined ? String(v) : "";
}

/** Read the `@_val` attribute (extremely common in OMML property nodes). */
export function val(node: OmmlNode | undefined): string {
  return attr(node, "val");
}

/** Escape angle brackets and ampersands for safe embedding in MathML. */
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ── Character classification ─────────────────────────────────────────────

/** Set of characters treated as mathematical operators. */
const OPERATOR_CHARS = new Set([
  "+",
  "-",
  "−",
  "±",
  "∓",
  "×",
  "÷",
  "·",
  "=",
  "≠",
  "≈",
  "≡",
  "≤",
  "≥",
  "<",
  ">",
  "≪",
  "≫",
  "∈",
  "∉",
  "⊂",
  "⊃",
  "⊆",
  "⊇",
  "∪",
  "∩",
  "→",
  "←",
  "↔",
  "⇒",
  "⇐",
  "⇔",
  "∞",
  "∴",
  "∵",
  "∝",
  "∀",
  "∃",
  ",",
  ";",
  ":",
  "!",
  "?",
  ".",
  "|",
  "/",
  "\\",
  "'",
  "(",
  ")",
  "[",
  "]",
  "{",
  "}",
  "⟨",
  "⟩",
]);

export function isOperator(ch: string): boolean {
  return OPERATOR_CHARS.has(ch.trim());
}

export function isNumeric(text: string): boolean {
  return /^[0-9]+([.,][0-9]+)?$/.test(text.trim());
}

// ── Unicode accent map (m:acc) ───────────────────────────────────────────

export const ACCENT_MAP: Record<string, string> = {
  "\u0302": "\u005E", // combining circumflex → hat
  "\u0303": "\u007E", // combining tilde
  "\u0304": "\u00AF", // combining macron → bar
  "\u0305": "\u00AF", // combining overline → bar
  "\u0307": "\u02D9", // combining dot above
  "\u0308": "\u00A8", // combining diaeresis
  "\u030C": "\u02C7", // combining caron
  "\u0332": "_", // combining underbar
  "\u20D7": "\u2192", // combining right arrow above → →
  "\u005E": "\u005E",
  "\u007E": "\u007E",
  "\u00AF": "\u00AF",
  "\u02D9": "\u02D9",
  "\u00A8": "\u00A8",
  "\u02C7": "\u02C7",
};

// ── Nary operator map ────────────────────────────────────────────────────

export const NARY_CHAR_MAP: Record<string, string> = {
  "\u2211": "\u2211", // ∑
  "\u220F": "\u220F", // ∏
  "\u222B": "\u222B", // ∫
  "\u222C": "\u222C", // ∬
  "\u222D": "\u222D", // ∭
  "\u222E": "\u222E", // ∮
  "\u2210": "\u2210", // ∐
  "\u22C0": "\u22C0", // ⋀
  "\u22C1": "\u22C1", // ⋁
  "\u22C2": "\u22C2", // ⋂
  "\u22C3": "\u22C3", // ⋃
};

// ── Delimiter bracket maps ───────────────────────────────────────────────

export const DELIM_BEGIN_MAP: Record<string, string> = {
  "(": "(",
  "[": "[",
  "{": "{",
  "|": "|",
  "‖": "‖",
  "⟨": "\u27E8",
  "⌈": "\u2308",
  "⌊": "\u230A",
};

export const DELIM_END_MAP: Record<string, string> = {
  ")": ")",
  "]": "]",
  "}": "}",
  "|": "|",
  "‖": "‖",
  "⟩": "\u27E9",
  "⌉": "\u2309",
  "⌋": "\u230B",
};
