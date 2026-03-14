import type {
  PptxElement,
  PptxTableData,
  XmlObject,
} from "pptx-viewer-core";
import { EMU_PER_PX } from "pptx-viewer-core";
import { ensureArrayValue } from "./geometry";

// ── Cell text update ─────────────────────────────────────────────────────

/**
 * Deep-clone an element's rawXml and update the text of a specific table cell.
 * Returns the new rawXml object, or `undefined` if the element doesn't contain
 * an XML-based table or the indices are out of range.
 */
export function updateCellTextInRawXml(
  element: PptxElement,
  rowIndex: number,
  colIndex: number,
  text: string,
): XmlObject | undefined {
  if (!element.rawXml) return undefined;

  // Deep-clone rawXml so the original is not mutated
  const newRawXml = structuredClone(element.rawXml) as XmlObject;

  const graphicData = (newRawXml["a:graphic"] as XmlObject | undefined)?.[
    "a:graphicData"
  ] as XmlObject | undefined;
  const table = graphicData?.["a:tbl"] as XmlObject | undefined;
  if (!table) return undefined;

  const rows = ensureArrayValue(
    table["a:tr"] as XmlObject | XmlObject[] | undefined,
  );
  if (rowIndex < 0 || rowIndex >= rows.length) return undefined;

  const cells = ensureArrayValue(
    rows[rowIndex]["a:tc"] as XmlObject | XmlObject[] | undefined,
  );
  if (colIndex < 0 || colIndex >= cells.length) return undefined;

  const cell = cells[colIndex];

  // Build a minimal text body with a single paragraph + run containing the
  // new text, preserving any existing run properties (font, colour, etc.).
  const existingTxBody = cell["a:txBody"] as XmlObject | undefined;
  const existingParagraphs = ensureArrayValue(
    existingTxBody?.["a:p"] as XmlObject | XmlObject[] | undefined,
  );
  const firstParagraph =
    existingParagraphs.length > 0 ? existingParagraphs[0] : undefined;
  const existingRuns = firstParagraph
    ? ensureArrayValue(
        firstParagraph["a:r"] as XmlObject | XmlObject[] | undefined,
      )
    : [];
  const firstRunProps =
    existingRuns.length > 0
      ? (existingRuns[0]["a:rPr"] as XmlObject | undefined)
      : undefined;

  const newRun: XmlObject = { "a:t": text };
  if (firstRunProps) {
    newRun["a:rPr"] = firstRunProps;
  }

  const newParagraph: XmlObject = {
    "a:r": newRun,
  };
  // Preserve paragraph properties if they existed
  if (firstParagraph?.["a:pPr"]) {
    newParagraph["a:pPr"] = firstParagraph["a:pPr"];
  }

  // Preserve body properties
  const bodyPr = existingTxBody?.["a:bodyPr"];
  const lstStyle = existingTxBody?.["a:lstStyle"];

  const newTxBody: XmlObject = {
    "a:p": newParagraph,
  };
  if (bodyPr !== undefined) newTxBody["a:bodyPr"] = bodyPr;
  if (lstStyle !== undefined) newTxBody["a:lstStyle"] = lstStyle;

  cell["a:txBody"] = newTxBody;

  return newRawXml;
}

// ── Merge attribute synchronisation ──────────────────────────────────────

/**
 * Deep-clone an element's rawXml and apply merge attributes from PptxTableData.
 * This synchronises the in-memory rawXml so that the XML-based rendering path
 * reflects merge/split changes immediately (without a save→reload cycle).
 *
 * Returns the new rawXml object, or `undefined` if the element doesn't contain
 * an XML-based table.
 */
export function updateMergeAttrsInRawXml(
  element: PptxElement,
  tableData: PptxTableData,
): XmlObject | undefined {
  if (!element.rawXml) return undefined;

  const newRawXml = structuredClone(element.rawXml) as XmlObject;

  const graphicData = (newRawXml["a:graphic"] as XmlObject | undefined)?.[
    "a:graphicData"
  ] as XmlObject | undefined;
  const table = graphicData?.["a:tbl"] as XmlObject | undefined;
  if (!table) return undefined;

  const xmlRows = ensureArrayValue(
    table["a:tr"] as XmlObject | XmlObject[] | undefined,
  );

  for (
    let rIdx = 0;
    rIdx < Math.min(tableData.rows.length, xmlRows.length);
    rIdx++
  ) {
    const dataRow = tableData.rows[rIdx];
    const xmlCells = ensureArrayValue(
      xmlRows[rIdx]["a:tc"] as XmlObject | XmlObject[] | undefined,
    );

    for (
      let cIdx = 0;
      cIdx < Math.min(dataRow.cells.length, xmlCells.length);
      cIdx++
    ) {
      const cell = dataRow.cells[cIdx];
      const xmlCell = xmlCells[cIdx];

      // gridSpan
      if (cell.gridSpan !== undefined && cell.gridSpan > 1) {
        xmlCell["@_gridSpan"] = String(cell.gridSpan);
      } else {
        delete xmlCell["@_gridSpan"];
      }

      // rowSpan
      if (cell.rowSpan !== undefined && cell.rowSpan > 1) {
        xmlCell["@_rowSpan"] = String(cell.rowSpan);
      } else {
        delete xmlCell["@_rowSpan"];
      }

      // hMerge
      if (cell.hMerge) {
        xmlCell["@_hMerge"] = "1";
      } else {
        delete xmlCell["@_hMerge"];
      }

      // vMerge
      if (cell.vMerge) {
        xmlCell["@_vMerge"] = "1";
      } else {
        delete xmlCell["@_vMerge"];
      }

      // Sync cell text for merged cells that were cleared
      if (cell.text !== undefined) {
        const existingTxBody = xmlCell["a:txBody"] as XmlObject | undefined;
        const existingParagraphs = existingTxBody
          ? ensureArrayValue(
              existingTxBody["a:p"] as XmlObject | XmlObject[] | undefined,
            )
          : [];
        const firstParagraph =
          existingParagraphs.length > 0 ? existingParagraphs[0] : undefined;
        const existingRuns = firstParagraph
          ? ensureArrayValue(
              firstParagraph["a:r"] as XmlObject | XmlObject[] | undefined,
            )
          : [];
        const firstRunProps =
          existingRuns.length > 0
            ? (existingRuns[0]["a:rPr"] as XmlObject | undefined)
            : undefined;

        const newRun: XmlObject = {
          "a:t": cell.text,
        };
        if (firstRunProps) {
          newRun["a:rPr"] = firstRunProps;
        }

        const newParagraph: XmlObject = {
          "a:r": newRun,
        };
        if (firstParagraph?.["a:pPr"]) {
          newParagraph["a:pPr"] = firstParagraph["a:pPr"];
        }

        const bodyPr = existingTxBody?.["a:bodyPr"];
        const lstStyle = existingTxBody?.["a:lstStyle"];

        const newTxBody: XmlObject = {
          "a:p": newParagraph,
        };
        if (bodyPr !== undefined) newTxBody["a:bodyPr"] = bodyPr;
        if (lstStyle !== undefined) newTxBody["a:lstStyle"] = lstStyle;

        xmlCell["a:txBody"] = newTxBody;
      }
    }
  }

  return newRawXml;
}

// ── Structural XML synchronisation ────────────────────────────────────────

/** Default row height in EMU for new XML rows. */
const DEFAULT_ROW_HEIGHT_EMU = 40 * EMU_PER_PX;

/** Create a default XML cell element (<a:tc>). */
function createDefaultXmlCell(): XmlObject {
  return {
    "a:txBody": {
      "a:bodyPr": {},
      "a:lstStyle": {},
      "a:p": {
        "a:endParaRPr": { "@_lang": "en-US" },
      },
    },
    "a:tcPr": {},
  };
}

/**
 * Deep-clone an element's rawXml and rebuild the table XML structure to match
 * the given `PptxTableData`. This handles adding/removing rows and columns
 * by rebuilding `<a:tblGrid>` and `<a:tr>` elements.
 *
 * Used when structural table operations (insert/delete row/column) change
 * the dimensions of the table.
 *
 * Returns the new rawXml object, or `undefined` if the element doesn't contain
 * an XML-based table.
 */
export function rebuildTableStructureInRawXml(
  element: PptxElement,
  tableData: PptxTableData,
): XmlObject | undefined {
  if (!element.rawXml) return undefined;

  const newRawXml = structuredClone(element.rawXml) as XmlObject;

  const graphicData = (newRawXml["a:graphic"] as XmlObject | undefined)?.[
    "a:graphicData"
  ] as XmlObject | undefined;
  const table = graphicData?.["a:tbl"] as XmlObject | undefined;
  if (!table) return undefined;

  // ── Compute total table width from existing grid ──
  const existingGridCols = ensureArrayValue(
    (table["a:tblGrid"] as XmlObject | undefined)?.["a:gridCol"] as
      | XmlObject
      | XmlObject[]
      | undefined,
  );
  const totalWidthEmu =
    existingGridCols.reduce((sum, col) => {
      return sum + (parseInt(String(col?.["@_w"] || "0"), 10) || 0);
    }, 0) || 9144000; // fallback: ~960px

  // ── Rebuild a:tblGrid ──
  const newGridCols: XmlObject[] = tableData.columnWidths.map((w) => ({
    "@_w": String(Math.round(w * totalWidthEmu)),
  }));
  if (!table["a:tblGrid"]) table["a:tblGrid"] = {};
  (table["a:tblGrid"] as XmlObject)["a:gridCol"] =
    newGridCols.length === 1 ? newGridCols[0] : newGridCols;

  // ── Rebuild a:tr ──
  const existingXmlRows = ensureArrayValue(
    table["a:tr"] as XmlObject | XmlObject[] | undefined,
  );

  const newXmlRows: XmlObject[] = tableData.rows.map((dataRow, ri) => {
    const existingRow =
      ri < existingXmlRows.length ? existingXmlRows[ri] : undefined;
    const existingCells = existingRow
      ? ensureArrayValue(
          existingRow["a:tc"] as XmlObject | XmlObject[] | undefined,
        )
      : [];

    const heightEmu = dataRow.height
      ? Math.round(dataRow.height * EMU_PER_PX)
      : existingRow?.["@_h"]
        ? parseInt(String(existingRow["@_h"]), 10)
        : DEFAULT_ROW_HEIGHT_EMU;

    const newXmlCells: XmlObject[] = dataRow.cells.map((cell, ci) => {
      // Try to reuse existing cell XML for preserved cells
      let xmlCell: XmlObject;
      if (ci < existingCells.length) {
        xmlCell = structuredClone(existingCells[ci]) as XmlObject;
      } else {
        xmlCell = createDefaultXmlCell();
      }

      // Update merge attributes
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

      return xmlCell;
    });

    return {
      "@_h": String(heightEmu),
      "a:tc": newXmlCells.length === 1 ? newXmlCells[0] : newXmlCells,
    } as XmlObject;
  });

  table["a:tr"] = newXmlRows.length === 1 ? newXmlRows[0] : newXmlRows;

  return newRawXml;
}
