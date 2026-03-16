import { createTableMergeHandlers } from './table-merge-handlers';
/**
 * useTableOperations — Cell editing, column / row resize, insert / delete
 * rows/columns, cell merge / split for table elements.
 */
import type { UseTableOperationsInput, TableOperationHandlers } from './table-operation-types';
import { createTableStructHandlers } from './table-struct-handlers';
export type {
	UseTableOperationsInput,
	TableOperationHandlers,
	TableStructHandlers,
	TableMergeHandlers,
} from './table-operation-types';

export function useTableOperations(input: UseTableOperationsInput): TableOperationHandlers {
	const structHandlers = createTableStructHandlers(input);
	const mergeHandlers = createTableMergeHandlers(input);

	return {
		...structHandlers,
		...mergeHandlers,
	};
}
