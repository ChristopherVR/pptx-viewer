// Thin re-export shim. The table raw-XML mutation operations now live in
// `pptx-viewer-core` (the OpenXML model owner). Kept here to preserve the
// existing import surface (`./table-xml-ops`) for React consumers.
export {
	updateCellTextInRawXml,
	updateCellTextStyleInRawXml,
	updateMergeAttrsInRawXml,
	rebuildTableStructureInRawXml,
} from 'pptx-viewer-core';
