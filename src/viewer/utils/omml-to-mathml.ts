/**
 * omml-to-mathml.ts — core conversion entry point.
 *
 * Converts Office MathML (OMML) XML objects into standard MathML markup.
 * Implementation split into:
 *   - omml-helpers.ts     (types, helper functions, lookup maps)
 *   - omml-converters.ts  (individual element converters)
 */
export type { OmmlNode } from "./omml-helpers";

// Re-export converters used only internally but keep the barrel clean.
// The public API is just `convertOmmlToMathMl`.

import type { OmmlNode } from "./omml-helpers";
import { ensureArray } from "./omml-helpers";
import {
  convertRun,
  convertFraction,
  convertRadical,
  convertSuperscript,
  convertSubscript,
  convertSubSup,
  convertPreSubSup,
  convertNary,
  convertDelimiter,
  convertMatrix,
  convertAccent,
  convertBar,
  convertLimLow,
  convertLimUpp,
  convertGroupChr,
  convertEqArr,
  convertBox,
  convertFunc,
} from "./omml-converters";

// ── Core conversion ──────────────────────────────────────────────────────

/**
 * Convert an OMML XML node (from fast-xml-parser) into a MathML string.
 *
 * Accepts the object at the `<a14:m>` level or directly at `<m:oMath>`.
 * Returns a `<math>` element string, or empty string if the input is empty.
 */
export function convertOmmlToMathMl(ommlNode: OmmlNode): string {
  if (!ommlNode || typeof ommlNode !== "object") return "";

  const oMaths = findOmathRoots(ommlNode);
  if (oMaths.length === 0) return "";

  const innerParts = oMaths.map((om) => convertChildren(om));
  const inner = innerParts.join("");
  if (inner.length === 0) return "";

  return `<math xmlns="http://www.w3.org/1998/Math/MathML" display="inline">${inner}</math>`;
}

/** Locate all `m:oMath` root elements inside an OMML wrapper node. */
function findOmathRoots(node: OmmlNode): OmmlNode[] {
  if (node["m:oMath"]) {
    return ensureArray(node["m:oMath"]);
  }
  const para = node["m:oMathPara"];
  if (para) {
    const paraNode = Array.isArray(para)
      ? (para[0] as OmmlNode)
      : (para as OmmlNode);
    if (paraNode["m:oMath"]) {
      return ensureArray(paraNode["m:oMath"]);
    }
  }
  if (
    node["m:r"] ||
    node["m:f"] ||
    node["m:rad"] ||
    node["m:sSup"] ||
    node["m:sSub"]
  ) {
    return [node];
  }
  return [];
}

/** Convert all child elements of an OMML container to MathML. */
function convertChildren(node: OmmlNode): string {
  if (!node || typeof node !== "object") return "";
  const parts: string[] = [];

  for (const key of Object.keys(node)) {
    if (key.startsWith("@_")) continue;
    if (key === "m:oMathPara") continue;

    const items = ensureArray(node[key]);
    for (const item of items) {
      const result = convertElement(key, item);
      if (result) parts.push(result);
    }
  }

  return parts.join("");
}

/** Convert a single OMML element by tag name. */
function convertElement(tag: string, node: OmmlNode): string {
  switch (tag) {
    case "m:r":
      return convertRun(node);
    case "m:f":
      return convertFraction(node, convertChildren);
    case "m:rad":
      return convertRadical(node, convertChildren);
    case "m:sSup":
      return convertSuperscript(node, convertChildren);
    case "m:sSub":
      return convertSubscript(node, convertChildren);
    case "m:sSubSup":
      return convertSubSup(node, convertChildren);
    case "m:sPre":
      return convertPreSubSup(node, convertChildren);
    case "m:nary":
      return convertNary(node, convertChildren);
    case "m:d":
      return convertDelimiter(node, convertChildren);
    case "m:m":
      return convertMatrix(node, convertChildren);
    case "m:acc":
      return convertAccent(node, convertChildren);
    case "m:bar":
      return convertBar(node, convertChildren);
    case "m:limLow":
      return convertLimLow(node, convertChildren);
    case "m:limUpp":
      return convertLimUpp(node, convertChildren);
    case "m:groupChr":
      return convertGroupChr(node, convertChildren);
    case "m:eqArr":
      return convertEqArr(node, convertChildren);
    case "m:box":
      return convertBox(node, convertChildren);
    case "m:borderBox":
      return convertBox(node, convertChildren);
    case "m:func":
      return convertFunc(node, convertChildren);
    case "m:oMath":
      return `<mrow>${convertChildren(node)}</mrow>`;
    default:
      return "";
  }
}
