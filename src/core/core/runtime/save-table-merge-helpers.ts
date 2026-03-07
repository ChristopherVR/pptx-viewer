import type { XmlObject } from "../../types";

/**
 * Merge-attribute shape expected by {@link serializeCellMergeAttributes}.
 * Mirrors the relevant fields of `PptxTableCell`.
 */
interface CellMergeInfo {
  gridSpan?: number;
  rowSpan?: number;
  hMerge?: boolean;
  vMerge?: boolean;
}

/**
 * Write / clear merge attributes (`gridSpan`, `rowSpan`, `hMerge`, `vMerge`)
 * on a `<a:tc>` XML element to reflect the current cell merge state.
 */
export function serializeCellMergeAttributes(
  xmlCell: XmlObject,
  cell: CellMergeInfo,
): void {
  if (cell.gridSpan !== undefined && cell.gridSpan > 1) {
    xmlCell["@_gridSpan"] = String(cell.gridSpan);
  } else {
    delete xmlCell["@_gridSpan"];
  }
  if (cell.rowSpan !== undefined && cell.rowSpan > 1) {
    xmlCell["@_rowSpan"] = String(cell.rowSpan);
  } else {
    delete xmlCell["@_rowSpan"];
  }
  if (cell.hMerge) {
    xmlCell["@_hMerge"] = "1";
  } else {
    delete xmlCell["@_hMerge"];
  }
  if (cell.vMerge) {
    xmlCell["@_vMerge"] = "1";
  } else {
    delete xmlCell["@_vMerge"];
  }
}

/**
 * Write table-level property flags (`bandRow`, `bandCol`, etc.) onto
 * the `<a:tblPr>` XML object from the given table data.
 */
export function serializeTablePropertyFlags(
  tbl: XmlObject,
  tableData: {
    bandedRows?: boolean;
    bandedColumns?: boolean;
    firstRowHeader?: boolean;
    lastRow?: boolean;
    firstCol?: boolean;
    lastCol?: boolean;
  },
): void {
  const tblPr = ((tbl as XmlObject)["a:tblPr"] ?? {}) as XmlObject;
  tblPr["@_bandRow"] = tableData.bandedRows ? "1" : "0";
  tblPr["@_bandCol"] = tableData.bandedColumns ? "1" : "0";
  tblPr["@_firstRow"] = tableData.firstRowHeader ? "1" : "0";
  tblPr["@_lastRow"] = tableData.lastRow ? "1" : "0";
  tblPr["@_firstCol"] = tableData.firstCol ? "1" : "0";
  tblPr["@_lastCol"] = tableData.lastCol ? "1" : "0";
  (tbl as XmlObject)["a:tblPr"] = tblPr;
}

/**
 * Recursively replace the first text value whose local name matches
 * `localName` somewhere in the node tree.
 *
 * @param getXmlLocalName - Callback that strips the namespace prefix from an XML key.
 */
export function replaceFirstTextValueInTree(
  node: unknown,
  localName: string,
  newValue: string,
  getXmlLocalName: (key: string) => string,
): boolean {
  if (node === null || node === undefined) return false;
  if (Array.isArray(node)) {
    for (const entry of node) {
      if (
        replaceFirstTextValueInTree(entry, localName, newValue, getXmlLocalName)
      )
        return true;
    }
    return false;
  }
  if (typeof node !== "object") return false;

  const objectNode = node as XmlObject;
  for (const [key, value] of Object.entries(objectNode)) {
    if (getXmlLocalName(key) === localName) {
      if (typeof value === "string" || typeof value === "number") {
        objectNode[key] = newValue;
        return true;
      }
    }
    if (
      replaceFirstTextValueInTree(value, localName, newValue, getXmlLocalName)
    )
      return true;
  }
  return false;
}

/** Build the `<c:pt>` array for a chart cache from string values. */
export function buildChartPoints(
  values: string[],
): Array<{ "@_idx": string; "c:v": string }> {
  return values.map((val, idx) => ({ "@_idx": String(idx), "c:v": val }));
}
