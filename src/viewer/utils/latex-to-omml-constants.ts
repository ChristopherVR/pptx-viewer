/**
 * Constants, token types, and tokenizer for LaTeX-to-OMML conversion.
 */
import type { OmmlNode } from "./omml-to-mathml";

// ── Greek letter map ─────────────────────────────────────────────────────

export const GREEK_MAP: Record<string, string> = {
  "\\alpha": "\u03B1",
  "\\beta": "\u03B2",
  "\\gamma": "\u03B3",
  "\\delta": "\u03B4",
  "\\epsilon": "\u03B5",
  "\\varepsilon": "\u03B5",
  "\\zeta": "\u03B6",
  "\\eta": "\u03B7",
  "\\theta": "\u03B8",
  "\\vartheta": "\u03D1",
  "\\iota": "\u03B9",
  "\\kappa": "\u03BA",
  "\\lambda": "\u03BB",
  "\\mu": "\u03BC",
  "\\nu": "\u03BD",
  "\\xi": "\u03BE",
  "\\pi": "\u03C0",
  "\\rho": "\u03C1",
  "\\sigma": "\u03C3",
  "\\tau": "\u03C4",
  "\\upsilon": "\u03C5",
  "\\phi": "\u03C6",
  "\\varphi": "\u03D5",
  "\\chi": "\u03C7",
  "\\psi": "\u03C8",
  "\\omega": "\u03C9",
  "\\Gamma": "\u0393",
  "\\Delta": "\u0394",
  "\\Theta": "\u0398",
  "\\Lambda": "\u039B",
  "\\Xi": "\u039E",
  "\\Pi": "\u03A0",
  "\\Sigma": "\u03A3",
  "\\Phi": "\u03A6",
  "\\Psi": "\u03A8",
  "\\Omega": "\u03A9",
};

// ── Operator map ─────────────────────────────────────────────────────────

export const OPERATOR_MAP: Record<string, string> = {
  "\\times": "\u00D7",
  "\\div": "\u00F7",
  "\\pm": "\u00B1",
  "\\mp": "\u2213",
  "\\cdot": "\u00B7",
  "\\leq": "\u2264",
  "\\geq": "\u2265",
  "\\neq": "\u2260",
  "\\approx": "\u2248",
  "\\equiv": "\u2261",
  "\\ll": "\u226A",
  "\\gg": "\u226B",
  "\\subset": "\u2282",
  "\\supset": "\u2283",
  "\\subseteq": "\u2286",
  "\\supseteq": "\u2287",
  "\\in": "\u2208",
  "\\notin": "\u2209",
  "\\cup": "\u222A",
  "\\cap": "\u2229",
  "\\to": "\u2192",
  "\\rightarrow": "\u2192",
  "\\leftarrow": "\u2190",
  "\\Rightarrow": "\u21D2",
  "\\Leftarrow": "\u21D0",
  "\\infty": "\u221E",
  "\\partial": "\u2202",
  "\\nabla": "\u2207",
  "\\forall": "\u2200",
  "\\exists": "\u2203",
  "\\ldots": "\u2026",
  "\\cdots": "\u22EF",
  "\\le": "\u2264",
  "\\ge": "\u2265",
  "\\ne": "\u2260",
};

// ── Nary operators ───────────────────────────────────────────────────────

export const NARY_MAP: Record<string, string> = {
  "\\sum": "\u2211",
  "\\prod": "\u220F",
  "\\int": "\u222B",
  "\\iint": "\u222C",
  "\\iiint": "\u222D",
  "\\oint": "\u222E",
  "\\coprod": "\u2210",
  "\\bigcup": "\u22C3",
  "\\bigcap": "\u22C2",
};

// ── Known function names ─────────────────────────────────────────────────

export const FUNC_NAMES = new Set([
  "sin",
  "cos",
  "tan",
  "cot",
  "sec",
  "csc",
  "arcsin",
  "arccos",
  "arctan",
  "sinh",
  "cosh",
  "tanh",
  "coth",
  "log",
  "ln",
  "exp",
  "lim",
  "min",
  "max",
  "sup",
  "inf",
  "det",
  "dim",
  "mod",
  "gcd",
  "deg",
  "hom",
  "ker",
]);

// ── Token ────────────────────────────────────────────────────────────────

export interface Token {
  type:
    | "command"
    | "text"
    | "group_start"
    | "group_end"
    | "superscript"
    | "subscript"
    | "whitespace";
  value: string;
}

// ── Tokenizer ────────────────────────────────────────────────────────────

export function tokenize(latex: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < latex.length) {
    const ch = latex[i];
    if (ch === "{") {
      tokens.push({ type: "group_start", value: "{" });
      i++;
    } else if (ch === "}") {
      tokens.push({ type: "group_end", value: "}" });
      i++;
    } else if (ch === "^") {
      tokens.push({ type: "superscript", value: "^" });
      i++;
    } else if (ch === "_") {
      tokens.push({ type: "subscript", value: "_" });
      i++;
    } else if (ch === "\\") {
      let cmd = "\\";
      i++;
      if (i < latex.length && /[a-zA-Z]/.test(latex[i])) {
        while (i < latex.length && /[a-zA-Z]/.test(latex[i])) {
          cmd += latex[i];
          i++;
        }
      } else if (i < latex.length) {
        cmd += latex[i];
        i++;
      }
      tokens.push({ type: "command", value: cmd });
    } else if (/\s/.test(ch)) {
      i++;
      tokens.push({ type: "whitespace", value: " " });
    } else {
      tokens.push({ type: "text", value: ch });
      i++;
    }
  }
  return tokens;
}

// ── Parser interface (for cross-file function parameters) ────────────────

export interface LatexParserContext {
  peek(): Token | undefined;
  next(): Token | undefined;
  parseGroup(): OmmlNode[];
  parseSingleOrGroup(): OmmlNode[];
  parseAtom(): OmmlNode | null;
  wrapE(nodes: OmmlNode[]): OmmlNode;
  makeRun(text: string, normal?: boolean): OmmlNode;
}
