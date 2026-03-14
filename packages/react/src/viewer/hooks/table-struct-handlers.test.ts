import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTableStructHandlers } from "./table-struct-handlers";
import type { UseTableOperationsInput } from "./table-operation-types";
import type {
  PptxElement,
  PptxTableData,
  TablePptxElement,
} from "pptx-viewer-core";

// Mock the table-parse utilities so we don't depend on XML parsing
vi.mock("../utils/table-parse", () => ({
  updateCellTextInRawXml: vi.fn(() => "<new-xml/>"),
  rebuildTableStructureInRawXml: vi.fn(() => "<rebuilt-xml/>"),
}));

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

function createSimpleTableData(
  rows: number,
  cols: number,
): PptxTableData {
  const columnWidths = Array.from({ length: cols }, () => 1 / cols);
  return {
    columnWidths,
    rows: Array.from({ length: rows }, () => ({
      cells: Array.from({ length: cols }, () => ({ text: "", style: {} })),
      height: 40,
    })),
  };
}

function createMockInput(
  overrides: Partial<UseTableOperationsInput> = {},
): UseTableOperationsInput {
  const tableData = createSimpleTableData(3, 3);
  const tableEl = createTableElement(tableData);
  const lookup = new Map<string, PptxElement>();
  lookup.set(tableEl.id, tableEl);

  return {
    selectedElement: tableEl,
    tableEditorState: { rowIndex: 1, columnIndex: 1 },
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

describe("createTableStructHandlers", () => {
  // ── handleCommitCellEdit ──────────────────────────────────────────────

  describe("handleCommitCellEdit", () => {
    it("should update cell text in tableData", () => {
      const input = createMockInput();
      const handlers = createTableStructHandlers(input);
      handlers.handleCommitCellEdit("table-1", 0, 0, "hello");
      expect(input.ops.updateElementById).toHaveBeenCalledWith(
        "table-1",
        expect.objectContaining({
          tableData: expect.objectContaining({
            rows: expect.arrayContaining([
              expect.objectContaining({
                cells: expect.arrayContaining([
                  expect.objectContaining({ text: "hello" }),
                ]),
              }),
            ]),
          }),
        }),
      );
    });

    it("should mark history dirty after edit", () => {
      const input = createMockInput();
      const handlers = createTableStructHandlers(input);
      handlers.handleCommitCellEdit("table-1", 0, 0, "test");
      expect(input.history.markDirty).toHaveBeenCalled();
    });

    it("should update table editor state after edit", () => {
      const input = createMockInput();
      const handlers = createTableStructHandlers(input);
      handlers.handleCommitCellEdit("table-1", 1, 2, "text");
      expect(input.setTableEditorState).toHaveBeenCalledWith(
        expect.objectContaining({
          rowIndex: 1,
          columnIndex: 2,
          elementId: "table-1",
        }),
      );
    });

    it("should do nothing if element not found", () => {
      const input = createMockInput();
      const handlers = createTableStructHandlers(input);
      handlers.handleCommitCellEdit("nonexistent", 0, 0, "test");
      expect(input.ops.updateElementById).not.toHaveBeenCalled();
    });

    it("should do nothing if element is not a table", () => {
      const input = createMockInput();
      input.elementLookup.set("shape-1", {
        id: "shape-1",
        type: "shape",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      } as PptxElement);
      const handlers = createTableStructHandlers(input);
      handlers.handleCommitCellEdit("shape-1", 0, 0, "test");
      expect(input.ops.updateElementById).not.toHaveBeenCalled();
    });
  });

  // ── handleResizeTableColumns ──────────────────────────────────────────

  describe("handleResizeTableColumns", () => {
    it("should update column widths", () => {
      const input = createMockInput();
      const handlers = createTableStructHandlers(input);
      const newWidths = [0.2, 0.3, 0.5];
      handlers.handleResizeTableColumns("table-1", newWidths);
      expect(input.ops.updateElementById).toHaveBeenCalledWith(
        "table-1",
        expect.objectContaining({
          tableData: expect.objectContaining({
            columnWidths: newWidths,
          }),
        }),
      );
      expect(input.history.markDirty).toHaveBeenCalled();
    });

    it("should do nothing if element is missing", () => {
      const input = createMockInput();
      const handlers = createTableStructHandlers(input);
      handlers.handleResizeTableColumns("missing", [0.5, 0.5]);
      expect(input.ops.updateElementById).not.toHaveBeenCalled();
    });
  });

  // ── handleResizeTableRow ──────────────────────────────────────────────

  describe("handleResizeTableRow", () => {
    it("should update row height", () => {
      const input = createMockInput();
      const handlers = createTableStructHandlers(input);
      handlers.handleResizeTableRow("table-1", 1, 60);
      expect(input.ops.updateElementById).toHaveBeenCalledWith(
        "table-1",
        expect.objectContaining({
          tableData: expect.objectContaining({
            rows: expect.arrayContaining([
              expect.objectContaining({ height: 60 }),
            ]),
          }),
        }),
      );
    });

    it("should only change the specified row", () => {
      const input = createMockInput();
      const handlers = createTableStructHandlers(input);
      handlers.handleResizeTableRow("table-1", 0, 80);
      const call = (input.ops.updateElementById as ReturnType<typeof vi.fn>).mock
        .calls[0];
      const updatedTableData = call[1].tableData as PptxTableData;
      expect(updatedTableData.rows[0].height).toBe(80);
      expect(updatedTableData.rows[1].height).toBe(40);
      expect(updatedTableData.rows[2].height).toBe(40);
    });
  });

  // ── handleInsertTableRow ──────────────────────────────────────────────

  describe("handleInsertTableRow", () => {
    it("should insert row below the selected row", () => {
      const input = createMockInput();
      const handlers = createTableStructHandlers(input);
      handlers.handleInsertTableRow("below");
      expect(input.ops.updateSelectedElement).toHaveBeenCalled();
      const call = (input.ops.updateSelectedElement as ReturnType<typeof vi.fn>)
        .mock.calls[0][0];
      const td = call.tableData as PptxTableData;
      expect(td.rows).toHaveLength(4); // was 3, now 4
    });

    it("should insert row above the selected row", () => {
      const input = createMockInput();
      const handlers = createTableStructHandlers(input);
      handlers.handleInsertTableRow("above");
      expect(input.ops.updateSelectedElement).toHaveBeenCalled();
      const call = (input.ops.updateSelectedElement as ReturnType<typeof vi.fn>)
        .mock.calls[0][0];
      const td = call.tableData as PptxTableData;
      expect(td.rows).toHaveLength(4);
    });

    it("should create new row with correct number of cells", () => {
      const input = createMockInput();
      const handlers = createTableStructHandlers(input);
      handlers.handleInsertTableRow("below");
      const call = (input.ops.updateSelectedElement as ReturnType<typeof vi.fn>)
        .mock.calls[0][0];
      const td = call.tableData as PptxTableData;
      // Row inserted at index 2 (below rowIndex=1)
      const insertedRow = td.rows[2];
      expect(insertedRow.cells).toHaveLength(3); // 3 columns
    });

    it("should do nothing if selected element is not a table", () => {
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
      const handlers = createTableStructHandlers(input);
      handlers.handleInsertTableRow("below");
      expect(input.ops.updateSelectedElement).not.toHaveBeenCalled();
    });

    it("should mark history dirty", () => {
      const input = createMockInput();
      const handlers = createTableStructHandlers(input);
      handlers.handleInsertTableRow("below");
      expect(input.history.markDirty).toHaveBeenCalled();
    });
  });

  // ── handleDeleteTableRow ──────────────────────────────────────────────

  describe("handleDeleteTableRow", () => {
    it("should remove the selected row", () => {
      const input = createMockInput();
      const handlers = createTableStructHandlers(input);
      handlers.handleDeleteTableRow();
      const call = (input.ops.updateSelectedElement as ReturnType<typeof vi.fn>)
        .mock.calls[0][0];
      const td = call.tableData as PptxTableData;
      expect(td.rows).toHaveLength(2); // was 3, now 2
    });

    it("should not delete when only one row remains", () => {
      const tableData = createSimpleTableData(1, 3);
      const tableEl = createTableElement(tableData);
      const input = createMockInput({ selectedElement: tableEl });
      const handlers = createTableStructHandlers(input);
      handlers.handleDeleteTableRow();
      expect(input.ops.updateSelectedElement).not.toHaveBeenCalled();
    });

    it("should do nothing for out-of-bounds row index", () => {
      const input = createMockInput({
        tableEditorState: { rowIndex: 10, columnIndex: 0 },
      });
      const handlers = createTableStructHandlers(input);
      handlers.handleDeleteTableRow();
      expect(input.ops.updateSelectedElement).not.toHaveBeenCalled();
    });
  });

  // ── handleInsertTableColumn ───────────────────────────────────────────

  describe("handleInsertTableColumn", () => {
    it("should insert column to the right", () => {
      const input = createMockInput();
      const handlers = createTableStructHandlers(input);
      handlers.handleInsertTableColumn("right");
      const call = (input.ops.updateSelectedElement as ReturnType<typeof vi.fn>)
        .mock.calls[0][0];
      const td = call.tableData as PptxTableData;
      expect(td.columnWidths).toHaveLength(4); // was 3
      expect(td.rows[0].cells).toHaveLength(4);
    });

    it("should insert column to the left", () => {
      const input = createMockInput();
      const handlers = createTableStructHandlers(input);
      handlers.handleInsertTableColumn("left");
      const call = (input.ops.updateSelectedElement as ReturnType<typeof vi.fn>)
        .mock.calls[0][0];
      const td = call.tableData as PptxTableData;
      expect(td.columnWidths).toHaveLength(4);
    });

    it("should normalize column widths to sum to 1", () => {
      const input = createMockInput();
      const handlers = createTableStructHandlers(input);
      handlers.handleInsertTableColumn("right");
      const call = (input.ops.updateSelectedElement as ReturnType<typeof vi.fn>)
        .mock.calls[0][0];
      const td = call.tableData as PptxTableData;
      const sum = td.columnWidths.reduce((a: number, b: number) => a + b, 0);
      expect(Math.abs(sum - 1)).toBeLessThan(0.0001);
    });
  });

  // ── handleDeleteTableColumn ───────────────────────────────────────────

  describe("handleDeleteTableColumn", () => {
    it("should remove the selected column", () => {
      const input = createMockInput();
      const handlers = createTableStructHandlers(input);
      handlers.handleDeleteTableColumn();
      const call = (input.ops.updateSelectedElement as ReturnType<typeof vi.fn>)
        .mock.calls[0][0];
      const td = call.tableData as PptxTableData;
      expect(td.columnWidths).toHaveLength(2); // was 3
      expect(td.rows[0].cells).toHaveLength(2);
    });

    it("should not delete when only one column remains", () => {
      const tableData = createSimpleTableData(3, 1);
      const tableEl = createTableElement(tableData);
      const input = createMockInput({ selectedElement: tableEl });
      const handlers = createTableStructHandlers(input);
      handlers.handleDeleteTableColumn();
      expect(input.ops.updateSelectedElement).not.toHaveBeenCalled();
    });

    it("should normalize column widths after deletion", () => {
      const input = createMockInput();
      const handlers = createTableStructHandlers(input);
      handlers.handleDeleteTableColumn();
      const call = (input.ops.updateSelectedElement as ReturnType<typeof vi.fn>)
        .mock.calls[0][0];
      const td = call.tableData as PptxTableData;
      const sum = td.columnWidths.reduce((a: number, b: number) => a + b, 0);
      expect(Math.abs(sum - 1)).toBeLessThan(0.0001);
    });
  });
});
