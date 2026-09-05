/**
 * Core runtime sub-system barrel export.
 *
 * Provides the runtime implementation hierarchy, its factory, and all
 * supporting builders and factories used by the PPTX load/save pipeline.
 *
 * @module pptx-core/runtime
 */

export {
	createDefaultPptxHandlerRuntime,
	PptxHandlerRuntimeFactory,
	type IPptxHandlerRuntimeFactory,
} from './PptxHandlerRuntimeFactory';
export { PptxHandlerRuntime } from './PptxHandlerRuntime';
export * from './builders';
export * from './factories';
export type {
	IPptxHandlerRuntime,
	PptxHandlerLoadOptions,
	PptxHandlerSaveOptions,
	PptxSaveFormat,
} from './types';
export { DEFAULT_MAX_UNCOMPRESSED_BYTES, MAX_ZIP_ENTRY_COUNT, ZipBombError } from './types';

// Framework-agnostic table XML builders and raw-XML mutation operations,
// consumed by the viewer bindings (insert tables, edit cell text/style,
// sync rawXml on merge/structure changes).
export {
	createTableCellXml,
	createTableGraphicFrameRawXml,
	applyTableCellTextAndStyle,
	updateCellTextInRawXml,
	updateCellTextStyleInRawXml,
	updateMergeAttrsInRawXml,
	rebuildTableStructureInRawXml,
} from './runtime/table-structural-ops';
export { DEFAULT_POWERPOINT_TABLE_STYLE_ID } from './runtime/table-style-defaults';

// Table-STYLE (ppt/tableStyles.xml) editing: create/delete a style entry on
// a ParsedTableStyleMap, and the section-name vocabulary + GUID normaliser
// needed to target one of the 13 CT_TableStyle parts (W3-E). Save-time
// section merge (`applyTableStyleEntryToNode`) is an internal writer detail,
// not part of this public surface: a consumer edits the typed map with these
// helpers, then passes it (plus `tableStylesDefaultId`/`tableStylesToDelete`)
// to `handler.save()`.
export {
	addTableStyleToMap,
	createTableStyleEntry,
	deleteTableStyleFromMap,
	generateTableStyleGuid,
} from './runtime/table-style-editor';
export {
	normalizeTableStyleGuid,
	TABLE_STYLE_PART_SEQUENCE,
	type TableStylePartName,
} from './runtime/table-style-entry-parse';
