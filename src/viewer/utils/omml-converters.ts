/**
 * Individual OMML element converters (m:r, m:f, m:rad, m:nary, etc.).
 *
 * Each function converts a single OMML element to its MathML equivalent.
 * The `convertChildren` function is injected to avoid circular dependencies.
 */
import type { OmmlNode } from "./omml-helpers";
import {
  child,
  ensureArray,
  val,
  escapeXml,
  isOperator,
  isNumeric,
  ACCENT_MAP,
  NARY_CHAR_MAP,
  DELIM_BEGIN_MAP,
  DELIM_END_MAP,
} from "./omml-helpers";

// ── Converter type ───────────────────────────────────────────────────────

/** Function that converts all children of an OMML container to MathML. */
export type ChildrenConverter = (node: OmmlNode) => string;

// ── Element converters ───────────────────────────────────────────────────

/** m:r — text run: classify as identifier, number, or operator. */
export function convertRun(node: OmmlNode): string {
  const textNode = node["m:t"];
  const text =
    typeof textNode === "string"
      ? textNode
      : textNode !== undefined
        ? String(textNode)
        : "";
  if (text.length === 0) return "";

  const escaped = escapeXml(text);
  const rPr = child(node, "m:rPr");
  const norVal = val(child(rPr, "m:nor"));
  const isNormal = norVal === "1" || norVal === "on" || norVal === "true";

  if (isNumeric(text)) return `<mn>${escaped}</mn>`;
  if (isOperator(text)) return `<mo>${escaped}</mo>`;
  if (isNormal) return `<mi mathvariant="normal">${escaped}</mi>`;
  if (text.length === 1) return `<mi>${escaped}</mi>`;
  return `<mi>${escaped}</mi>`;
}

/** m:f — fraction. */
export function convertFraction(node: OmmlNode, cc: ChildrenConverter): string {
  const fPr = child(node, "m:fPr");
  const fracType = val(child(fPr, "m:type"));
  const num = `<mrow>${cc(child(node, "m:num"))}</mrow>`;
  const den = `<mrow>${cc(child(node, "m:den"))}</mrow>`;

  if (fracType === "lin") {
    return `<mrow>${num}<mo>/</mo>${den}</mrow>`;
  }
  if (fracType === "noBar") {
    return `<mfrac linethickness="0">${num}${den}</mfrac>`;
  }
  return `<mfrac>${num}${den}</mfrac>`;
}

/** m:rad — radical: square root or nth root. */
export function convertRadical(node: OmmlNode, cc: ChildrenConverter): string {
  const radPr = child(node, "m:radPr");
  const degHide = val(child(radPr, "m:degHide"));
  const base = cc(child(node, "m:e"));
  const degree = cc(child(node, "m:deg"));

  if (
    degHide === "1" ||
    degHide === "on" ||
    degHide === "true" ||
    degree.length === 0
  ) {
    return `<msqrt><mrow>${base}</mrow></msqrt>`;
  }
  return `<mroot><mrow>${base}</mrow><mrow>${degree}</mrow></mroot>`;
}

/** m:sSup — superscript. */
export function convertSuperscript(
  node: OmmlNode,
  cc: ChildrenConverter,
): string {
  const base = cc(child(node, "m:e"));
  const sup = cc(child(node, "m:sup"));
  return `<msup><mrow>${base}</mrow><mrow>${sup}</mrow></msup>`;
}

/** m:sSub — subscript. */
export function convertSubscript(
  node: OmmlNode,
  cc: ChildrenConverter,
): string {
  const base = cc(child(node, "m:e"));
  const sub = cc(child(node, "m:sub"));
  return `<msub><mrow>${base}</mrow><mrow>${sub}</mrow></msub>`;
}

/** m:sSubSup — simultaneous subscript and superscript. */
export function convertSubSup(node: OmmlNode, cc: ChildrenConverter): string {
  const base = cc(child(node, "m:e"));
  const sub = cc(child(node, "m:sub"));
  const sup = cc(child(node, "m:sup"));
  return `<msubsup><mrow>${base}</mrow><mrow>${sub}</mrow><mrow>${sup}</mrow></msubsup>`;
}

/** m:sPre — pre-sub-superscript (e.g. isotope notation). */
export function convertPreSubSup(
  node: OmmlNode,
  cc: ChildrenConverter,
): string {
  const base = cc(child(node, "m:e"));
  const sub = cc(child(node, "m:sub"));
  const sup = cc(child(node, "m:sup"));
  return `<mmultiscripts><mrow>${base}</mrow><mprescripts/><mrow>${sub}</mrow><mrow>${sup}</mrow></mmultiscripts>`;
}

/** m:nary — n-ary operator (sum, integral, product, etc.). */
export function convertNary(node: OmmlNode, cc: ChildrenConverter): string {
  const naryPr = child(node, "m:naryPr");
  const chrVal = val(child(naryPr, "m:chr"));
  const limLocVal = val(child(naryPr, "m:limLoc"));
  const subHide = val(child(naryPr, "m:subHide"));
  const supHide = val(child(naryPr, "m:supHide"));

  const operatorChar = chrVal ? NARY_CHAR_MAP[chrVal] || chrVal : "\u222B";

  const sub = cc(child(node, "m:sub"));
  const sup = cc(child(node, "m:sup"));
  const base = cc(child(node, "m:e"));

  const showSub =
    subHide !== "1" && subHide !== "on" && subHide !== "true" && sub.length > 0;
  const showSup =
    supHide !== "1" && supHide !== "on" && supHide !== "true" && sup.length > 0;

  let result: string;
  if (showSub && showSup) {
    if (limLocVal === "undOvr") {
      result = `<munderover><mo>${escapeXml(operatorChar)}</mo><mrow>${sub}</mrow><mrow>${sup}</mrow></munderover>`;
    } else {
      result = `<msubsup><mo>${escapeXml(operatorChar)}</mo><mrow>${sub}</mrow><mrow>${sup}</mrow></msubsup>`;
    }
  } else if (showSub) {
    if (limLocVal === "undOvr") {
      result = `<munder><mo>${escapeXml(operatorChar)}</mo><mrow>${sub}</mrow></munder>`;
    } else {
      result = `<msub><mo>${escapeXml(operatorChar)}</mo><mrow>${sub}</mrow></msub>`;
    }
  } else if (showSup) {
    if (limLocVal === "undOvr") {
      result = `<mover><mo>${escapeXml(operatorChar)}</mo><mrow>${sup}</mrow></mover>`;
    } else {
      result = `<msup><mo>${escapeXml(operatorChar)}</mo><mrow>${sup}</mrow></msup>`;
    }
  } else {
    result = `<mo>${escapeXml(operatorChar)}</mo>`;
  }

  return `<mrow>${result}<mrow>${base}</mrow></mrow>`;
}

/** m:d — delimiter (parentheses, brackets, pipes, etc.). */
export function convertDelimiter(
  node: OmmlNode,
  cc: ChildrenConverter,
): string {
  const dPr = child(node, "m:dPr");
  const begChrVal = val(child(dPr, "m:begChr"));
  const endChrVal = val(child(dPr, "m:endChr"));
  const sepChrVal = val(child(dPr, "m:sepChr"));

  const open = begChrVal.length > 0 ? begChrVal : "(";
  const close = endChrVal.length > 0 ? endChrVal : ")";
  const separator = sepChrVal.length > 0 ? sepChrVal : "";

  const openChar = DELIM_BEGIN_MAP[open] || open;
  const closeChar = DELIM_END_MAP[close] || close;

  const elements = ensureArray(node["m:e"]);
  const parts: string[] = [];
  for (let i = 0; i < elements.length; i++) {
    if (i > 0 && separator.length > 0) {
      parts.push(`<mo>${escapeXml(separator)}</mo>`);
    }
    parts.push(`<mrow>${cc(elements[i])}</mrow>`);
  }

  const openMo = open ? `<mo>${escapeXml(openChar)}</mo>` : "<mo></mo>";
  const closeMo = close ? `<mo>${escapeXml(closeChar)}</mo>` : "<mo></mo>";

  return `<mrow>${openMo}${parts.join("")}${closeMo}</mrow>`;
}

/** m:m — matrix / array layout. */
export function convertMatrix(node: OmmlNode, cc: ChildrenConverter): string {
  const rows = ensureArray(node["m:mr"]);
  const tableRows: string[] = [];

  for (const row of rows) {
    const cells = ensureArray(row["m:e"]);
    const tdParts: string[] = [];
    for (const cell of cells) {
      tdParts.push(`<mtd><mrow>${cc(cell)}</mrow></mtd>`);
    }
    tableRows.push(`<mtr>${tdParts.join("")}</mtr>`);
  }

  return `<mrow><mo>[</mo><mtable>${tableRows.join("")}</mtable><mo>]</mo></mrow>`;
}

/** m:acc — accent mark (hat, bar, tilde, dot, etc.). */
export function convertAccent(node: OmmlNode, cc: ChildrenConverter): string {
  const accPr = child(node, "m:accPr");
  const chrVal = val(child(accPr, "m:chr"));
  const base = cc(child(node, "m:e"));

  const accentChar =
    chrVal.length > 0 ? ACCENT_MAP[chrVal] || chrVal : "\u0302";

  return `<mover accent="true"><mrow>${base}</mrow><mo>${escapeXml(accentChar)}</mo></mover>`;
}

/** m:bar — overbar or underbar. */
export function convertBar(node: OmmlNode, cc: ChildrenConverter): string {
  const barPr = child(node, "m:barPr");
  const posVal = val(child(barPr, "m:pos"));
  const base = cc(child(node, "m:e"));

  if (posVal === "bot") {
    return `<munder><mrow>${base}</mrow><mo>\u00AF</mo></munder>`;
  }
  return `<mover><mrow>${base}</mrow><mo>\u00AF</mo></mover>`;
}

/** m:limLow — lower limit. */
export function convertLimLow(node: OmmlNode, cc: ChildrenConverter): string {
  const base = cc(child(node, "m:e"));
  const lim = cc(child(node, "m:lim"));
  return `<munder><mrow>${base}</mrow><mrow>${lim}</mrow></munder>`;
}

/** m:limUpp — upper limit. */
export function convertLimUpp(node: OmmlNode, cc: ChildrenConverter): string {
  const base = cc(child(node, "m:e"));
  const lim = cc(child(node, "m:lim"));
  return `<mover><mrow>${base}</mrow><mrow>${lim}</mrow></mover>`;
}

/** m:groupChr — grouping character (brace under/over). */
export function convertGroupChr(node: OmmlNode, cc: ChildrenConverter): string {
  const grpPr = child(node, "m:groupChrPr");
  const chrVal = val(child(grpPr, "m:chr"));
  const posVal = val(child(grpPr, "m:pos"));
  const base = cc(child(node, "m:e"));

  const chr = chrVal.length > 0 ? chrVal : "\u23DF";

  if (posVal === "top") {
    return `<mover><mrow>${base}</mrow><mo>${escapeXml(chr)}</mo></mover>`;
  }
  return `<munder><mrow>${base}</mrow><mo>${escapeXml(chr)}</mo></munder>`;
}

/** m:eqArr — equation array (aligned equations). */
export function convertEqArr(node: OmmlNode, cc: ChildrenConverter): string {
  const elements = ensureArray(node["m:e"]);
  const rows: string[] = [];

  for (const el of elements) {
    rows.push(`<mtr><mtd><mrow>${cc(el)}</mrow></mtd></mtr>`);
  }

  return `<mtable columnalign="left">${rows.join("")}</mtable>`;
}

/** m:box / m:borderBox — grouping box (transparent container). */
export function convertBox(node: OmmlNode, cc: ChildrenConverter): string {
  return `<mrow>${cc(child(node, "m:e"))}</mrow>`;
}

/** m:func — function application (sin, cos, log, lim, etc.). */
export function convertFunc(node: OmmlNode, cc: ChildrenConverter): string {
  const fName = cc(child(node, "m:fName"));
  const base = cc(child(node, "m:e"));
  return `<mrow>${fName}<mo>&#x2061;</mo><mrow>${base}</mrow></mrow>`;
}
