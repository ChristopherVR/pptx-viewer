/**
 * Table structural operations: add/remove rows and columns.
 *
 * These pure functions operate on both `PptxTableData` (logical model) and
 * the raw XML object representation, keeping them in sync.
 *
 * Merge span adjustments are handled when removing rows/columns that
 * participate in merged regions.
 *
 * This module re-exports all symbols from the focused sub-modules
 * to preserve backward compatibility.
 *
 * @module runtime/table-structural-ops
 */

// Shared helpers and XML navigation
export { getTblFromRawXml } from './table-structural-helpers';

// Row operations
export { addTableRow, removeTableRow } from './table-row-ops';

// Column operations
export { addTableColumn, removeTableColumn } from './table-column-ops';

// XML rebuild
export {
	rebuildTableXmlFromData,
	ensureA16NamespaceOnSlideRoot,
	slideContainsA16Element,
	ensureMathNamespaceOnSlideRoot,
	slideContainsMathElement,
} from './table-xml-rebuild';

// New-table / cell XML builders
export {
	createTableCellXml,
	createTableGraphicFrameRawXml,
	applyTableCellTextAndStyle,
} from './table-create-xml';

// Raw-XML cell/merge/structure mutations
export {
	updateCellTextInRawXml,
	updateCellTextStyleInRawXml,
	updateMergeAttrsInRawXml,
	rebuildTableStructureInRawXml,
} from './table-cell-rawxml-ops';
