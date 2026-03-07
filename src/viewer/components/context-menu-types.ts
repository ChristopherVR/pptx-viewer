import type { PptxElement } from "../../core";
import type {
  ElementContextMenuAction,
  ElementContextMenuState,
  TableCellEditorState,
} from "../types";

export interface ContextMenuProps {
  contextMenuState: ElementContextMenuState;
  mode: string;
  selectedElement: PptxElement | null;
  tableEditorState: TableCellEditorState | null;
  hasMultiSelection?: boolean;
  onAction: (action: ElementContextMenuAction) => void;
  onInsertTableRow: (position: "above" | "below") => void;
  onDeleteTableRow: () => void;
  onInsertTableColumn: (position: "left" | "right") => void;
  onDeleteTableColumn: () => void;
  onMergeCellRight?: () => void;
  onMergeCellDown?: () => void;
  onMergeSelectedCells?: () => void;
  onSplitCell?: () => void;
  onClose: () => void;
}
