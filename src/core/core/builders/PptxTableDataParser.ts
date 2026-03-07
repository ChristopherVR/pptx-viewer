import type {
  PptxTableCellStyle,
  PptxTableData,
  PptxTableRow,
  XmlObject,
} from "../../types";
import {
  applyCellFillStyle,
  applyCellBorderStyle,
  applyCellMarginStyle,
} from "./table-cell-fill-border-helpers";
import {
  applyCellAlignmentStyle,
  applyCellTextFormat,
} from "./table-cell-text-style-helpers";

export interface PptxTableDataParserContext {
  emuPerPx: number;
  ensureArray: (value: unknown) => unknown[];
  parseColor: (
    colorNode: XmlObject | undefined,
    placeholderColor?: string,
  ) => string | undefined;
  extractGradientFillCss?: (gradFill: XmlObject) => string | undefined;
  extractGradientStops?: (
    gradFill: XmlObject,
  ) => Array<{ color: string; position: number; opacity?: number }>;
  extractGradientType?: (gradFill: XmlObject) => "linear" | "radial";
  extractGradientAngle?: (gradFill: XmlObject) => number;
  extractGradientPathType?: (
    gradFill: XmlObject,
  ) => "circle" | "rect" | "shape" | undefined;
  extractGradientFocalPoint?: (
    gradFill: XmlObject,
  ) => { x: number; y: number } | undefined;
}

export interface IPptxTableDataParser {
  parseTableData(graphicData: XmlObject): PptxTableData | undefined;
}

export class PptxTableDataParser implements IPptxTableDataParser {
  private readonly context: PptxTableDataParserContext;

  public constructor(context: PptxTableDataParserContext) {
    this.context = context;
  }

  public parseTableData(graphicData: XmlObject): PptxTableData | undefined {
    try {
      const tableNode = graphicData["a:tbl"] as XmlObject | undefined;
      if (!tableNode) return undefined;

      const gridColumns = this.context.ensureArray(
        tableNode["a:tblGrid"]?.["a:gridCol"],
      ) as XmlObject[];
      const totalWidthEmu = gridColumns.reduce((sum, column) => {
        const width = parseInt(String(column?.["@_w"] || "0"), 10) || 0;
        return sum + width;
      }, 0);
      const columnWidths =
        totalWidthEmu > 0
          ? gridColumns.map((column) => {
              const width = parseInt(String(column?.["@_w"] || "0"), 10) || 0;
              return width / totalWidthEmu;
            })
          : gridColumns.map(() => 1 / Math.max(gridColumns.length, 1));

      const tableProperties = (tableNode["a:tblPr"] || {}) as XmlObject;
      const tableStyleNode = tableProperties["a:tblStyle"] as
        | XmlObject
        | undefined;
      const tableStyleId =
        String(
          tableStyleNode?.["@_val"] || tableProperties["@_tblStyle"] || "",
        ).trim() || undefined;

      const xmlRows = this.context.ensureArray(
        tableNode["a:tr"],
      ) as XmlObject[];
      const rows: PptxTableRow[] = xmlRows.map((rowNode) => {
        const rowHeightEmu = parseInt(String(rowNode?.["@_h"] || "0"), 10) || 0;
        const rowHeight = Math.round(rowHeightEmu / this.context.emuPerPx);
        const xmlCells = this.context.ensureArray(
          rowNode["a:tc"],
        ) as XmlObject[];

        return {
          height: rowHeight,
          cells: xmlCells.map((cellNode) => ({
            text: this.extractTableCellText(cellNode),
            style: this.extractTableCellStyleFromXml(cellNode),
            gridSpan: cellNode["@_gridSpan"]
              ? parseInt(String(cellNode["@_gridSpan"]), 10)
              : undefined,
            rowSpan: cellNode["@_rowSpan"]
              ? parseInt(String(cellNode["@_rowSpan"]), 10)
              : undefined,
            vMerge:
              cellNode["@_vMerge"] === "1" || cellNode["@_vMerge"] === true,
            hMerge:
              cellNode["@_hMerge"] === "1" || cellNode["@_hMerge"] === true,
          })),
        };
      });

      return {
        rows,
        columnWidths,
        bandedRows:
          tableProperties["@_bandRow"] === "1" ||
          tableProperties["@_bandRow"] === true,
        firstRowHeader:
          tableProperties["@_firstRow"] === "1" ||
          tableProperties["@_firstRow"] === true,
        bandedColumns:
          tableProperties["@_bandCol"] === "1" ||
          tableProperties["@_bandCol"] === true,
        lastRow:
          tableProperties["@_lastRow"] === "1" ||
          tableProperties["@_lastRow"] === true,
        firstCol:
          tableProperties["@_firstCol"] === "1" ||
          tableProperties["@_firstCol"] === true,
        lastCol:
          tableProperties["@_lastCol"] === "1" ||
          tableProperties["@_lastCol"] === true,
        tableStyleId,
        bandRowCycle: 1,
        bandColCycle: 1,
      };
    } catch {
      return undefined;
    }
  }

  private extractTableCellText(tableCell: XmlObject): string {
    const paragraphs = this.context.ensureArray(
      tableCell?.["a:txBody"]?.["a:p"],
    ) as XmlObject[];
    const lines: string[] = [];

    for (const paragraph of paragraphs) {
      const runs = this.context.ensureArray(paragraph["a:r"]) as XmlObject[];
      const fields = this.context.ensureArray(
        paragraph["a:fld"],
      ) as XmlObject[];
      let lineText = "";

      for (const run of runs) {
        lineText += String(run?.["a:t"] ?? "");
      }
      for (const field of fields) {
        lineText += String(field?.["a:t"] ?? "");
      }
      lines.push(lineText);
    }

    return lines.join("\n");
  }

  private extractTableCellStyleFromXml(
    tableCell: XmlObject,
  ): PptxTableCellStyle | undefined {
    try {
      const cellProperties = tableCell?.["a:tcPr"] as XmlObject | undefined;
      const style: PptxTableCellStyle = {};
      let hasStyle = false;

      hasStyle =
        applyCellFillStyle(cellProperties, style, this.context) || hasStyle;
      hasStyle =
        applyCellBorderStyle(cellProperties, style, this.context) || hasStyle;
      hasStyle =
        applyCellMarginStyle(cellProperties, style, this.context) || hasStyle;
      hasStyle = applyCellAlignmentStyle(cellProperties, style) || hasStyle;
      hasStyle =
        applyCellTextFormat(tableCell, style, this.context) || hasStyle;

      return hasStyle ? style : undefined;
    } catch {
      return undefined;
    }
  }
}

export type { TableCellFillBorderContext } from "./table-cell-fill-border-helpers";
export {
  applyCellFillStyle,
  applyCellBorderStyle,
  applyCellMarginStyle,
} from "./table-cell-fill-border-helpers";
export type { TableCellTextStyleContext } from "./table-cell-text-style-helpers";
export {
  applyCellAlignmentStyle,
  applyCellTextFormat,
} from "./table-cell-text-style-helpers";
