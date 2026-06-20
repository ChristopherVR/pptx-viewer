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
