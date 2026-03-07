/**
 * Extracted construct-parsing functions for the LaTeX-to-OMML converter.
 * Handles nary operators, delimiters, function applications, and scripts.
 */
import type { OmmlNode } from "./omml-to-mathml";
import type { LatexParserContext } from "./latex-to-omml-constants";

// ── Scripts ──────────────────────────────────────────────────────────────

/** Try to parse trailing ^ and _ to wrap the base in superscript/subscript. */
export function tryParseScripts(
  ctx: LatexParserContext,
  base: OmmlNode,
): OmmlNode {
  let hasSup = false;
  let hasSub = false;
  let sup: OmmlNode[] = [];
  let sub: OmmlNode[] = [];

  // Allow ^ and _ in either order
  for (let round = 0; round < 2; round++) {
    const tok = ctx.peek();
    if (tok?.type === "superscript" && !hasSup) {
      ctx.next();
      sup = ctx.parseSingleOrGroup();
      hasSup = true;
    } else if (tok?.type === "subscript" && !hasSub) {
      ctx.next();
      sub = ctx.parseSingleOrGroup();
      hasSub = true;
    }
  }

  if (hasSup && hasSub) {
    return {
      "m:sSubSup": {
        "m:e": ctx.wrapE([base]),
        "m:sub": ctx.wrapE(sub),
        "m:sup": ctx.wrapE(sup),
      } as unknown as OmmlNode,
    };
  }
  if (hasSup) {
    return {
      "m:sSup": {
        "m:e": ctx.wrapE([base]),
        "m:sup": ctx.wrapE(sup),
      } as unknown as OmmlNode,
    };
  }
  if (hasSub) {
    return {
      "m:sSub": {
        "m:e": ctx.wrapE([base]),
        "m:sub": ctx.wrapE(sub),
      } as unknown as OmmlNode,
    };
  }
  return base;
}

// ── Nary ─────────────────────────────────────────────────────────────────

/** Parse an n-ary operator with optional sub/superscripts and body. */
export function parseNary(
  ctx: LatexParserContext,
  operatorChar: string,
): OmmlNode {
  let sub: OmmlNode[] = [];
  let sup: OmmlNode[] = [];
  let hasSub = false;
  let hasSup = false;

  // Parse limits
  for (let round = 0; round < 2; round++) {
    const tok = ctx.peek();
    if (tok?.type === "subscript" && !hasSub) {
      ctx.next();
      sub = ctx.parseSingleOrGroup();
      hasSub = true;
    } else if (tok?.type === "superscript" && !hasSup) {
      ctx.next();
      sup = ctx.parseSingleOrGroup();
      hasSup = true;
    }
  }

  // Parse the body (next group or atom)
  const body = ctx.parseSingleOrGroup();

  const naryPr: OmmlNode = {
    "m:chr": { "@_val": operatorChar } as unknown as OmmlNode,
  };
  if (!hasSub) {
    naryPr["m:subHide"] = { "@_val": "1" } as unknown as OmmlNode;
  }
  if (!hasSup) {
    naryPr["m:supHide"] = { "@_val": "1" } as unknown as OmmlNode;
  }

  return {
    "m:nary": {
      "m:naryPr": naryPr,
      "m:sub": hasSub ? ctx.wrapE(sub) : {},
      "m:sup": hasSup ? ctx.wrapE(sup) : {},
      "m:e": ctx.wrapE(body),
    } as unknown as OmmlNode,
  };
}

// ── Delimiter ────────────────────────────────────────────────────────────

/** Parse a \left...\right delimiter pair. */
export function parseDelimiter(ctx: LatexParserContext): OmmlNode {
  // Next token is the opening delimiter character
  const openTok = ctx.next();
  const openChar = openTok?.value === "." ? "" : (openTok?.value ?? "(");

  // Parse inner content until we hit \right
  const inner: OmmlNode[] = [];
  while (ctx.peek()) {
    if (ctx.peek()!.type === "command" && ctx.peek()!.value === "\\right") {
      ctx.next();
      break;
    }
    const node = ctx.parseAtom();
    if (node) inner.push(node);
  }

  // Next token is the closing delimiter
  const closeTok = ctx.next();
  const closeChar = closeTok?.value === "." ? "" : (closeTok?.value ?? ")");

  const dPr: OmmlNode = {};
  if (openChar !== "(") {
    dPr["m:begChr"] = { "@_val": openChar } as unknown as OmmlNode;
  }
  if (closeChar !== ")") {
    dPr["m:endChr"] = { "@_val": closeChar } as unknown as OmmlNode;
  }

  return {
    "m:d": {
      "m:dPr": Object.keys(dPr).length > 0 ? dPr : undefined,
      "m:e": ctx.wrapE(inner),
    } as unknown as OmmlNode,
  };
}

// ── Function application ─────────────────────────────────────────────────

/** Parse a function application like \sin{x} or \lim_{x \to 0}. */
export function parseFuncApplication(
  ctx: LatexParserContext,
  name: string,
): OmmlNode {
  const fNameNode = ctx.makeRun(name, true);

  // Check for subscript on the function name (e.g. \lim_{x \to 0})
  const withScripts = tryParseScripts(ctx, fNameNode);

  // Parse the argument (next group or atom)
  let body: OmmlNode[] = [];
  if (ctx.peek()?.type === "group_start") {
    body = ctx.parseGroup();
  } else if (ctx.peek() && ctx.peek()!.type !== "group_end") {
    const atom = ctx.parseAtom();
    if (atom) body = [atom];
  }

  if (body.length === 0) {
    return withScripts;
  }

  return {
    "m:func": {
      "m:fName": ctx.wrapE([withScripts]),
      "m:e": ctx.wrapE(body),
    } as unknown as OmmlNode,
  };
}
