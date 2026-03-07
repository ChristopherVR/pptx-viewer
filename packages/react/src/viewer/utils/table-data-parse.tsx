import React from "react";

import type { PptxElement, XmlObject } from "pptx-viewer-core";
import type { ParsedTableCell, ParsedTableData } from "../types";
import { ensureArrayValue } from "./geometry";
import { extractCellText, extractTableCellStyle } from "./table-cell-style";

// ── XML element accessors ────────────────────────────────────────────────

export function getGraphicDataFromElement(
  element: PptxElement,
): XmlObject | undefined {
  return (element.rawXml?.["a:graphic"] as XmlObject | undefined)?.[
    "a:graphicData"
  ] as XmlObject | undefined;
}

export function getTableXmlFromElement(
  element: PptxElement,
): XmlObject | undefined {
  return getGraphicDataFromElement(element)?.["a:tbl"] as XmlObject | undefined;
}

// ── Full table parsing ───────────────────────────────────────────────────

export function parseTableElementData(
  element: PptxElement,
  fallbackTextStyle: React.CSSProperties,
): ParsedTableData | null {
  const table = getTableXmlFromElement(element);
  if (!table) return null;

  const rows = ensureArrayValue(
    table["a:tr"] as XmlObject | XmlObject[] | undefined,
  );
  if (rows.length === 0) return null;

  const tableGrid = table["a:tblGrid"] as XmlObject | undefined;
  const gridColumns = ensureArrayValue(
    tableGrid?.["a:gridCol"] as XmlObject | XmlObject[] | undefined,
  );
  const columnWidths = gridColumns.map((column) => {
    const width = Number.parseInt(String(column?.["@_w"] || ""), 10);
    return Number.isFinite(width) && width > 0 ? width : 0;
  });
  const totalColumnWidth = columnWidths.reduce((sum, width) => sum + width, 0);
  const columnPercentages =
    totalColumnWidth > 0
      ? columnWidths.map((width) => (width / totalColumnWidth) * 100)
      : [];

  const cells: ParsedTableCell[] = [];
  rows.forEach((row, rowIndex) => {
    const rowCells = ensureArrayValue(
      row["a:tc"] as XmlObject | XmlObject[] | undefined,
    );
    rowCells.forEach((cell, columnIndex) => {
      cells.push({
        rowIndex,
        columnIndex,
        text: extractCellText(cell),
        style: extractTableCellStyle(cell, fallbackTextStyle),
        rawCell: cell,
      });
    });
  });

  const columnCount = Math.max(
    columnPercentages.length,
    rows.reduce((maxCount, row) => {
      const rowCells = ensureArrayValue(
        row["a:tc"] as XmlObject | XmlObject[] | undefined,
      );
      return Math.max(maxCount, rowCells.length);
    }, 0),
  );

  return {
    rowCount: rows.length,
    columnCount,
    rows,
    columnPercentages,
    cells,
  };
}
