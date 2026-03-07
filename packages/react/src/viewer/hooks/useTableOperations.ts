/**
 * useTableOperations — Cell editing, column / row resize, insert / delete
 * rows/columns, cell merge / split for table elements.
 */
export type {
  UseTableOperationsInput,
  TableOperationHandlers,
  TableStructHandlers,
  TableMergeHandlers,
} from "./table-operation-types";
import type {
  UseTableOperationsInput,
  TableOperationHandlers,
} from "./table-operation-types";
import { createTableStructHandlers } from "./table-struct-handlers";
import { createTableMergeHandlers } from "./table-merge-handlers";

export function useTableOperations(
  input: UseTableOperationsInput,
): TableOperationHandlers {
  const structHandlers = createTableStructHandlers(input);
  const mergeHandlers = createTableMergeHandlers(input);

  return {
    ...structHandlers,
    ...mergeHandlers,
  };
}
