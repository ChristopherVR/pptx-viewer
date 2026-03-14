// Barrel re-export — all table parsing helpers.
// Split into domain-focused modules for maintainability (max 300 lines each).

export {
  parseGradientFillCss,
  parsePatternFillCss,
  parseCellBorders,
} from "./table-cell-fill";

export {
  extractCellText,
  parseParagraphAlignment,
  extractTableCellStyle,
} from "./table-cell-style";

export {
  type TableStyleContext,
  getTableCellBandStyle,
} from "./table-band-style";

export {
  getGraphicDataFromElement,
  getTableXmlFromElement,
  parseTableElementData,
} from "./table-data-parse";

export {
  updateCellTextInRawXml,
  updateMergeAttrsInRawXml,
  rebuildTableStructureInRawXml,
} from "./table-xml-ops";
