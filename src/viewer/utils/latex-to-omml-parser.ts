/**
 * LaTeX parser and convertLatexToOmml public entry point.
 */
import type { OmmlNode } from "./omml-to-mathml";
import type { LatexParserContext } from "./latex-to-omml-constants";
import {
  type Token,
  tokenize,
  GREEK_MAP,
  OPERATOR_MAP,
  NARY_MAP,
  FUNC_NAMES,
} from "./latex-to-omml-constants";
import {
  tryParseScripts,
  parseNary,
  parseDelimiter,
  parseFuncApplication,
} from "./latex-to-omml-constructs";

// ── Parser ───────────────────────────────────────────────────────────────

class LatexParser implements LatexParserContext {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  public peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  public next(): Token | undefined {
    return this.tokens[this.pos++];
  }

  private expect(type: Token["type"]): Token {
    const tok = this.next();
    if (!tok || tok.type !== type) {
      throw new Error(`Expected ${type}, got ${tok?.type ?? "EOF"}`);
    }
    return tok;
  }

  /** Parse a brace-delimited group, returning its OMML children. */
  public parseGroup(): OmmlNode[] {
    this.expect("group_start");
    const nodes: OmmlNode[] = [];
    while (this.peek() && this.peek()!.type !== "group_end") {
      const node = this.parseAtom();
      if (node) nodes.push(node);
    }
    this.expect("group_end");
    return nodes;
  }

  /** Parse a single group or a single token (for things like x^2 without braces). */
  public parseSingleOrGroup(): OmmlNode[] {
    if (this.peek()?.type === "group_start") {
      return this.parseGroup();
    }
    const atom = this.parseAtom();
    return atom ? [atom] : [];
  }

  /** Wrap nodes into a single m:e element. */
  public wrapE(nodes: OmmlNode[]): OmmlNode {
    if (nodes.length === 1)
      return {
        "m:r": nodes[0]["m:r"],
        "m:f": nodes[0]["m:f"],
        "m:rad": nodes[0]["m:rad"],
        "m:sSup": nodes[0]["m:sSup"],
        "m:sSub": nodes[0]["m:sSub"],
        "m:sSubSup": nodes[0]["m:sSubSup"],
        "m:nary": nodes[0]["m:nary"],
        "m:d": nodes[0]["m:d"],
        "m:func": nodes[0]["m:func"],
      };
    // Multiple children — flatten into the m:e
    const result: OmmlNode = {};
    for (const n of nodes) {
      for (const key of Object.keys(n)) {
        if (result[key]) {
          const existing = result[key];
          if (Array.isArray(existing)) {
            (existing as OmmlNode[]).push(n[key] as OmmlNode);
          } else {
            result[key] = [existing as OmmlNode, n[key] as OmmlNode];
          }
        } else {
          result[key] = n[key];
        }
      }
    }
    return result;
  }

  public makeRun(text: string, normal = false): OmmlNode {
    const run: OmmlNode = { "m:t": text };
    if (normal) {
      run["m:rPr"] = { "m:nor": { "@_val": "1" } } as unknown as OmmlNode;
    }
    return { "m:r": run };
  }

  /** Parse a single atom (letter, command, group). */
  public parseAtom(): OmmlNode | null {
    const tok = this.peek();
    if (!tok) return null;

    // Skip whitespace
    if (tok.type === "whitespace") {
      this.next();
      return this.parseAtom();
    }

    // Plain text character
    if (tok.type === "text") {
      this.next();
      const base = this.makeRun(tok.value);
      return tryParseScripts(this, base);
    }

    // Braced group
    if (tok.type === "group_start") {
      const group = this.parseGroup();
      if (group.length === 0) return null;
      const base = group.length === 1 ? group[0] : this.wrapE(group);
      return tryParseScripts(this, base);
    }

    // Command
    if (tok.type === "command") {
      this.next();
      const cmd = tok.value;

      if (GREEK_MAP[cmd]) {
        const base = this.makeRun(GREEK_MAP[cmd]);
        return tryParseScripts(this, base);
      }

      if (OPERATOR_MAP[cmd]) {
        return this.makeRun(OPERATOR_MAP[cmd]);
      }

      if (NARY_MAP[cmd]) {
        return parseNary(this, NARY_MAP[cmd]);
      }

      // Fractions
      if (cmd === "\\frac") {
        const num = this.parseGroup();
        const den = this.parseGroup();
        const frac: OmmlNode = {
          "m:f": {
            "m:num": this.wrapE(num),
            "m:den": this.wrapE(den),
          } as unknown as OmmlNode,
        };
        return tryParseScripts(this, frac);
      }

      // Square root
      if (cmd === "\\sqrt") {
        // Check for optional argument [n]
        if (this.peek()?.type === "text" && this.peek()?.value === "[") {
          this.next(); // consume '['
          let degree = "";
          while (
            this.peek() &&
            !(this.peek()!.type === "text" && this.peek()!.value === "]")
          ) {
            degree += this.next()!.value;
          }
          if (this.peek()?.value === "]") this.next(); // consume ']'
          const body = this.parseGroup();
          const rad: OmmlNode = {
            "m:rad": {
              "m:deg": this.wrapE([this.makeRun(degree)]),
              "m:e": this.wrapE(body),
            } as unknown as OmmlNode,
          };
          return tryParseScripts(this, rad);
        }
        const body = this.parseGroup();
        const rad: OmmlNode = {
          "m:rad": {
            "m:radPr": { "m:degHide": { "@_val": "1" } } as unknown as OmmlNode,
            "m:e": this.wrapE(body),
          } as unknown as OmmlNode,
        };
        return tryParseScripts(this, rad);
      }

      // \text{...}
      if (cmd === "\\text") {
        const textNodes = this.parseGroup();
        const text = textNodes
          .map((n) => {
            const r = n["m:r"] as OmmlNode | undefined;
            return r ? String(r["m:t"] ?? "") : "";
          })
          .join("");
        return this.makeRun(text, true);
      }

      // \left and \right delimiters
      if (cmd === "\\left") {
        return parseDelimiter(this);
      }
      if (cmd === "\\right") {
        return null;
      }

      // Known function names
      const funcName = cmd.slice(1); // strip backslash
      if (FUNC_NAMES.has(funcName)) {
        return parseFuncApplication(this, funcName);
      }

      // Unknown command — render as text
      const base = this.makeRun(cmd.slice(1), true);
      return tryParseScripts(this, base);
    }

    // Superscript/subscript without a base — skip
    if (tok.type === "superscript" || tok.type === "subscript") {
      this.next();
      const arg = this.parseSingleOrGroup();
      const empty = this.makeRun("");
      if (tok.type === "superscript") {
        return {
          "m:sSup": {
            "m:e": this.wrapE([empty]),
            "m:sup": this.wrapE(arg),
          } as unknown as OmmlNode,
        };
      }
      return {
        "m:sSub": {
          "m:e": this.wrapE([empty]),
          "m:sub": this.wrapE(arg),
        } as unknown as OmmlNode,
      };
    }

    return null;
  }

  /** Parse the full expression and return an array of OMML nodes. */
  public parseAll(): OmmlNode[] {
    const nodes: OmmlNode[] = [];
    while (this.peek()) {
      const node = this.parseAtom();
      if (node) nodes.push(node);
    }
    return nodes;
  }
}

// ── Public API ───────────────────────────────────────────────────────────

/**
 * Convert a LaTeX math string into an OMML XML object (fast-xml-parser shape).
 *
 * The returned object has the shape:
 *   { "m:oMathPara": { "m:oMath": { ... } } }
 *
 * which matches the structure expected by PptxHandlerRuntimeShapeParsing
 * when stored as `equationXml` on a TextSegment.
 */
export function convertLatexToOmml(latex: string): Record<string, unknown> {
  const trimmed = latex.trim();
  if (trimmed.length === 0) return {};

  const tokens = tokenize(trimmed);
  const parser = new LatexParser(tokens);
  const nodes = parser.parseAll();

  if (nodes.length === 0) return {};

  // Build the m:oMath element with all parsed nodes
  const oMath: OmmlNode = {};
  for (const node of nodes) {
    for (const key of Object.keys(node)) {
      if (oMath[key]) {
        const existing = oMath[key];
        if (Array.isArray(existing)) {
          (existing as OmmlNode[]).push(node[key] as OmmlNode);
        } else {
          oMath[key] = [existing as OmmlNode, node[key] as OmmlNode];
        }
      } else {
        oMath[key] = node[key];
      }
    }
  }

  return {
    "m:oMathPara": {
      "m:oMath": oMath,
    },
  };
}
