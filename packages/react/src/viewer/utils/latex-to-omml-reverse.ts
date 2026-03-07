/**
 * OMML-to-LaTeX reverse conversion utilities.
 *
 * Best-effort reverse of the OMML structure back to LaTeX notation.
 * Complex equations may not round-trip perfectly.
 */
import { GREEK_MAP, OPERATOR_MAP, NARY_MAP } from "./latex-to-omml-constants";

// ── Reverse maps ─────────────────────────────────────────────────────────

const REVERSE_GREEK: Record<string, string> = {};
for (const [cmd, ch] of Object.entries(GREEK_MAP)) {
  REVERSE_GREEK[ch] = cmd;
}

const REVERSE_OPERATOR: Record<string, string> = {};
for (const [cmd, ch] of Object.entries(OPERATOR_MAP)) {
  if (!REVERSE_OPERATOR[ch]) REVERSE_OPERATOR[ch] = cmd;
}

const REVERSE_NARY: Record<string, string> = {};
for (const [cmd, ch] of Object.entries(NARY_MAP)) {
  if (!REVERSE_NARY[ch]) REVERSE_NARY[ch] = cmd;
}

// ── Helpers ──────────────────────────────────────────────────────────────

function ensureArr(val: unknown): Array<Record<string, unknown>> {
  if (val === undefined || val === null) return [];
  if (Array.isArray(val)) return val as Array<Record<string, unknown>>;
  if (typeof val === "object") return [val as Record<string, unknown>];
  return [];
}

function childNode(
  node: Record<string, unknown> | undefined,
  key: string,
): Record<string, unknown> {
  if (!node) return {};
  const v = node[key];
  if (v && typeof v === "object" && !Array.isArray(v))
    return v as Record<string, unknown>;
  return {};
}

function attrVal(node: Record<string, unknown> | undefined): string {
  if (!node) return "";
  const v = node["@_val"];
  return typeof v === "string" ? v : v !== undefined ? String(v) : "";
}

// ── Tree walkers ─────────────────────────────────────────────────────────

function ommlChildrenToLatex(
  node: Record<string, unknown> | undefined,
): string {
  if (!node || typeof node !== "object") return "";
  const parts: string[] = [];

  for (const key of Object.keys(node)) {
    if (key.startsWith("@_")) continue;
    const items = ensureArr(node[key]);
    for (const item of items) {
      const result = ommlElementToLatex(key, item);
      if (result) parts.push(result);
    }
  }

  return parts.join("");
}

function ommlElementToLatex(
  tag: string,
  node: Record<string, unknown>,
): string {
  switch (tag) {
    case "m:r": {
      const text =
        typeof node["m:t"] === "string"
          ? node["m:t"]
          : node["m:t"] !== undefined
            ? String(node["m:t"])
            : "";
      if (text.length === 0) return "";
      // Check if it's a Greek letter or operator
      if (REVERSE_GREEK[text]) return REVERSE_GREEK[text] + " ";
      if (REVERSE_OPERATOR[text]) return REVERSE_OPERATOR[text] + " ";
      // Check if it's normal text
      const rPr = childNode(node, "m:rPr");
      const norVal = attrVal(childNode(rPr, "m:nor"));
      if (norVal === "1" || norVal === "on" || norVal === "true") {
        return `\\text{${text}}`;
      }
      return text;
    }
    case "m:f": {
      const num = ommlChildrenToLatex(childNode(node, "m:num"));
      const den = ommlChildrenToLatex(childNode(node, "m:den"));
      return `\\frac{${num}}{${den}}`;
    }
    case "m:rad": {
      const radPr = childNode(node, "m:radPr");
      const degHide = attrVal(childNode(radPr, "m:degHide"));
      const base = ommlChildrenToLatex(childNode(node, "m:e"));
      if (degHide === "1" || degHide === "on" || degHide === "true") {
        return `\\sqrt{${base}}`;
      }
      const deg = ommlChildrenToLatex(childNode(node, "m:deg"));
      if (deg) {
        return `\\sqrt[${deg}]{${base}}`;
      }
      return `\\sqrt{${base}}`;
    }
    case "m:sSup": {
      const base = ommlChildrenToLatex(childNode(node, "m:e"));
      const sup = ommlChildrenToLatex(childNode(node, "m:sup"));
      return `${base}^{${sup}}`;
    }
    case "m:sSub": {
      const base = ommlChildrenToLatex(childNode(node, "m:e"));
      const sub = ommlChildrenToLatex(childNode(node, "m:sub"));
      return `${base}_{${sub}}`;
    }
    case "m:sSubSup": {
      const base = ommlChildrenToLatex(childNode(node, "m:e"));
      const sub = ommlChildrenToLatex(childNode(node, "m:sub"));
      const sup = ommlChildrenToLatex(childNode(node, "m:sup"));
      return `${base}_{${sub}}^{${sup}}`;
    }
    case "m:nary": {
      const naryPr = childNode(node, "m:naryPr");
      const chrVal = attrVal(childNode(naryPr, "m:chr"));
      const operatorCmd = REVERSE_NARY[chrVal] ?? "\\int";
      const subHide = attrVal(childNode(naryPr, "m:subHide"));
      const supHide = attrVal(childNode(naryPr, "m:supHide"));
      const sub = ommlChildrenToLatex(childNode(node, "m:sub"));
      const sup = ommlChildrenToLatex(childNode(node, "m:sup"));
      const body = ommlChildrenToLatex(childNode(node, "m:e"));
      let result = operatorCmd;
      if (sub && subHide !== "1") result += `_{${sub}}`;
      if (sup && supHide !== "1") result += `^{${sup}}`;
      result += `{${body}}`;
      return result;
    }
    case "m:d": {
      const dPr = childNode(node, "m:dPr");
      const begChr = attrVal(childNode(dPr, "m:begChr")) || "(";
      const endChr = attrVal(childNode(dPr, "m:endChr")) || ")";
      const inner = ommlChildrenToLatex(childNode(node, "m:e"));
      return `\\left${begChr}${inner}\\right${endChr}`;
    }
    case "m:func": {
      const fName = ommlChildrenToLatex(childNode(node, "m:fName"));
      const body = ommlChildrenToLatex(childNode(node, "m:e"));
      return `${fName}{${body}}`;
    }
    case "m:oMath":
      return ommlChildrenToLatex(node);
    default:
      return "";
  }
}

// ── Public API ───────────────────────────────────────────────────────────

/**
 * Attempt to reverse-convert an OMML node back to LaTeX for editing.
 * This is best-effort — complex equations may not round-trip perfectly.
 */
export function convertOmmlToLatex(omml: Record<string, unknown>): string {
  if (!omml || typeof omml !== "object") return "";

  // Navigate to m:oMath
  let oMath: Record<string, unknown> | undefined;
  const para = omml["m:oMathPara"] as Record<string, unknown> | undefined;
  if (para?.["m:oMath"]) {
    oMath = para["m:oMath"] as Record<string, unknown>;
  } else if (omml["m:oMath"]) {
    oMath = omml["m:oMath"] as Record<string, unknown>;
  } else {
    // The node itself might be an oMath
    oMath = omml;
  }

  return ommlChildrenToLatex(oMath);
}
