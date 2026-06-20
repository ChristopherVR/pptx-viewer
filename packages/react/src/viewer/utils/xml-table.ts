// Thin re-export shim. The table XML builders now live in
// `pptx-viewer-core` (the OpenXML model owner). Kept here to preserve the
// existing import surface (`./xml-table`) for React consumers.
export {
	createTableCellXml,
	createTableGraphicFrameRawXml,
	applyTableCellTextAndStyle,
} from 'pptx-viewer-core';
