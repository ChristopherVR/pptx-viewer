import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTableMergeHandlers } from "./table-merge-handlers";
import type { UseTableOperationsInput } from "./table-operation-types";
import type {
  PptxElement,
  PptxTableData,
  TablePptxElement,
} from "pptx-viewer-core";

// Mock the external utilities
vi.mock("../utils/table-parse", () => ({
  updateMergeAttrsInRawXml: vi.fn(() => "<merged-xml/>"),
}));

vi.mock("../utils/table-merge-utils", () => ({
  mergeCells: vi.fn((cells, td) => {
    // Simple mock: return tableData with anchor cell marked with gridSpan/rowSpan
    const newRows = td.rows.map(
      (row: PptxTableData["rows"][0], ri: number) => ({
        ...row,
        cells: row.cells.map(
          (cell: PptxTableData["rows"][0]["cells"][0], ci: number) => {
            if (ri === cells[0].row && ci === cells[0].col) {
              return { ...cell, gridSpan: 2, text: "merged" };
            }
            return cell;
          },
        ),
      }),
    );
    return { ...td, rows: newRows };
  }),
  splitCell: vi.fn((row, col, td) => {
    const newRows = td.rows.map(
      (r: PptxTableData["rows"][0], ri: number) => ({
        ...r,
        cells: r.cells.map(
          (c: PptxTableData["rows"][0]["cells"][0], ci: number) => {
            if (ri === row && ci === col) {
              return {
                ...c,
                gridSpan: undefined,
                rowSpan: undefined,
                text: "split",
              };
            }
            return c;
          },
        ),
      }),
    );
    return { ...td, rows: newRows };
  }),
}));

function createTableData(rows: number, cols: number): PptxTableData {
  return {
    columnWidths: Array.from({ length: cols }, () => 1 / cols),
    rows: Array.from({ length: rows }, () => ({
      cells: Array.from({ length: cols }, () => ({ text: "", style: {} })),
      height: 40,
    })),
  };
}

function createTableElement(
  tableData: PptxTableData,
  id = "table-1",
): TablePptxElement {
  return {
    id,
    type: "table",
    x: 0,
    y: 0,
    width: 400,
    height: 200,
    tableData,
  } as TablePptxElement;
}

function createMockInput(
  overrides: Partial<UseTableOperationsInput> = {},
): UseTableOperationsInput {
  const tableData = createTableData(3, 3);
  const tableEl = createTableElement(tableData);
  const lookup = new Map<string, PptxElement>();
  lookup.set(tableEl.id, tableEl);

  return {
    selectedElement: tableEl,
    tableEditorState: { rowIndex: 0, columnIndex: 0 },
    elementLookup: lookup,
    setTableEditorState: vi.fn(),
    ops: {
      updateElementById: vi.fn(),
      updateSelectedElement: vi.fn(),
    } as unknown as UseTableOperationsInput["ops"],
    history: {
      markDirty: vi.fn(),
    } as unknown as UseTableOperationsInput["history"],
    ...overrides,
  };
}

describe("createTableMergeHandlers", () => {
  // ── handleMergeCellRight ──────────────────────────────────────────────

  describe("handleMergeCellRight", () => {
    it("should merge the current cell with the cell to the right", () => {
      const input = createMockInput();
      const handlers = createTableMergeHandlers(input);
      handlers.handleMergeCellRight();
      expect(input.ops.updateSelectedElement).toHaveBeenCalled();
      expect(input.history.markDirty).toHaveBeenCalled();
    });

    it("should do nothing if no selected element", () => {
      const input = createMockInput({ selectedElement: null });
      const handlers = createTableMergeHandlers(input);
      handlers.handleMergeCellRight();
      expect(input.ops.updateSelectedElement).not.toHaveBeenCalled();
    });

    it("should do nothing if element is not a table", () => {
      const input = createMockInput({
        selectedElement: {
          id: "s1",
          type: "shape",
          x: 0,
          y: 0,
          width: 100,
          height: 100,
        } as PptxElement,
      });
      const handlers = createTableMergeHandlers(input);
      handlers.handleMergeCellRight();
      expect(input.ops.updateSelectedElement).not.toHaveBeenCalled();
    });

    it("should do nothing if table editor state is null", () => {
      const input = createMockInput({ tableEditorState: null });
      const handlers = createTableMergeHandlers(input);
      handlers.handleMergeCellRight();
      expect(input.ops.updateSelectedElement).not.toHaveBeenCalled();
    });

    it("should do nothing if next cell is hMerge continuation", () => {
      const tableData = createTableData(3, 3);
      tableData.rows[0].cells[1] = { text: "", hMerge: true };
      const tableEl = createTableElement(tableData);
      const input = createMockInput({ selectedElement: tableEl });
      const handlers = createTableMergeHandlers(input);
      handlers.handleMergeCellRight();
      expect(input.ops.updateSelectedElement).not.toHaveBeenCalled();
    });

    it("should do nothing if next cell is vMerge continuation", () => {
      const tableData = createTableData(3, 3);
      tableData.rows[0].cells[1] = { text: "", vMerge: true };
      const tableEl = createTableElement(tableData);
      const input = createMockInput({ selectedElement: tableEl });
      const handlers = createTableMergeHandlers(input);
      handlers.handleMergeCellRight();
      expect(input.ops.updateSelectedElement).not.toHaveBeenCalled();
    });
  });

  // ── handleMergeCellDown ───────────────────────────────────────────────

  describe("handleMergeCellDown", () => {
    it("should merge the current cell with the cell below", () => {
      const input = createMockInput();
      const handlers = createTableMergeHandlers(input);
      handlers.handleMergeCellDown();
      expect(input.ops.updateSelectedElement).toHaveBeenCalled();
      expect(input.history.markDirty).toHaveBeenCalled();
    });

    it("should do nothing if at the last row", () => {
      const input = createMockInput({
        tableEditorState: { rowIndex: 2, columnIndex: 0 },
      });
      const handlers = createTableMergeHandlers(input);
      handlers.handleMergeCellDown();
      expect(input.ops.updateSelectedElement).not.toHaveBeenCalled();
    });

    it("should do nothing if target cell is an hMerge continuation", () => {
      const tableData = createTableData(3, 3);
      tableData.rows[1].cells[0] = { text: "", hMerge: true };
      const tableEl = createTableElement(tableData);
      const input = createMockInput({ selectedElement: tableEl });
      const handlers = createTableMergeHandlers(input);
      handlers.handleMergeCellDown();
      expect(input.ops.updateSelectedElement).not.toHaveBeenCalled();
    });
  });

  // ── handleMergeSelectedCells ──────────────────────────────────────────

  describe("handleMergeSelectedCells", () => {
    it("should merge multiple selected cells", () => {
      const input = createMockInput({
        tableEditorState: {
          rowIndex: 0,
          columnIndex: 0,
          selectedCells: [
            { row: 0, col: 0 },
            { row: 0, col: 1 },
          ],
        },
      });
      const handlers = createTableMergeHandlers(input);
      handlers.handleMergeSelectedCells();
      expect(input.ops.updateSelectedElement).toHaveBeenCalled();
      expect(input.history.markDirty).toHaveBeenCalled();
    });

    it("should do nothing if less than 2 cells selected", () => {
      const input = createMockInput({
        tableEditorState: {
          rowIndex: 0,
          columnIndex: 0,
          selectedCells: [{ row: 0, col: 0 }],
        },
      });
      const handlers = createTableMergeHandlers(input);
      handlers.handleMergeSelectedCells();
      expect(input.ops.updateSelectedElement).not.toHaveBeenCalled();
    });

    it("should do nothing when no selectedCells array", () => {
      const input = createMockInput({
        tableEditorState: { rowIndex: 0, columnIndex: 0 },
      });
      const handlers = createTableMergeHandlers(input);
      handlers.handleMergeSelectedCells();
      expect(input.ops.updateSelectedElement).not.toHaveBeenCalled();
    });

    it("should update table editor state after merge", () => {
      const input = createMockInput({
        tableEditorState: {
          rowIndex: 1,
          columnIndex: 1,
          selectedCells: [
            { row: 1, col: 1 },
            { row: 1, col: 2 },
          ],
        },
      });
      const handlers = createTableMergeHandlers(input);
      handlers.handleMergeSelectedCells();
      expect(input.setTableEditorState).toHaveBeenCalledWith(
        expect.objectContaining({
          rowIndex: 1,
          columnIndex: 1,
        }),
      );
    });
  });

  // ── handleSplitCell ───────────────────────────────────────────────────

  describe("handleSplitCell", () => {
    it("should split a merged cell", () => {
      const input = createMockInput();
      const handlers = createTableMergeHandlers(input);
      handlers.handleSplitCell();
      expect(input.ops.updateSelectedElement).toHaveBeenCalled();
      expect(input.history.markDirty).toHaveBeenCalled();
    });

    it("should do nothing if no table editor state", () => {
      const input = createMockInput({ tableEditorState: null });
      const handlers = createTableMergeHandlers(input);
      handlers.handleSplitCell();
      expect(input.ops.updateSelectedElement).not.toHaveBeenCalled();
    });

    it("should do nothing if selected element is null", () => {
      const input = createMockInput({ selectedElement: null });
      const handlers = createTableMergeHandlers(input);
      handlers.handleSplitCell();
      expect(input.ops.updateSelectedElement).not.toHaveBeenCalled();
    });
  });
});
