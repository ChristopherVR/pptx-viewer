import type { OleObjectType } from '../types';

/**
 * Map of well-known OLE progIds to application types and file extensions.
 */
const PROG_ID_MAP: ReadonlyArray<{
	pattern: RegExp;
	type: OleObjectType;
	extension: string;
}> = [
	{ pattern: /^Excel\./iu, type: 'excel', extension: 'xlsx' },
	{ pattern: /^Word\./iu, type: 'word', extension: 'docx' },
	{ pattern: /^PowerPoint\./iu, type: 'excel', extension: 'pptx' },
	{ pattern: /^Visio\./iu, type: 'visio', extension: 'vsdx' },
	{ pattern: /^Equation\./iu, type: 'mathtype', extension: 'wmf' },
	{ pattern: /^MathType/iu, type: 'mathtype', extension: 'wmf' },
	{ pattern: /^AcroExch\./iu, type: 'pdf', extension: 'pdf' },
	{ pattern: /^Acrobat\./iu, type: 'pdf', extension: 'pdf' },
	{ pattern: /^Package$/iu, type: 'package', extension: 'bin' },
];

/**
 * Map of well-known CLSIDs (uppercase, braces stripped) to application types.
 */
const CLSID_MAP: ReadonlyMap<string, { type: OleObjectType; extension: string }> = new Map([
	// Excel Workbook
	['00020820-0000-0000-C000-000000000046', { type: 'excel', extension: 'xls' }],
	['00020830-0000-0000-C000-000000000046', { type: 'excel', extension: 'xlsx' }],
	// Word Document
	['00020906-0000-0000-C000-000000000046', { type: 'word', extension: 'doc' }],
	['F4754C9B-64F5-4B40-8AF4-679732AC0607', { type: 'word', extension: 'docx' }],
	// Package (generic embedded file)
	['0003000C-0000-0000-C000-000000000046', { type: 'package', extension: 'bin' }],
	// Adobe Acrobat
	['B801CA65-A1FC-11D0-85AD-444553540000', { type: 'pdf', extension: 'pdf' }],
	// Visio
	['00021A20-0000-0000-C000-000000000046', { type: 'visio', extension: 'vsd' }],
	// Equation Editor
	['0002CE02-0000-0000-C000-000000000046', { type: 'mathtype', extension: 'wmf' }],
]);

/**
 * Detect OLE object type and file extension from progId and/or clsId.
 */
export function detectOleObjectType(
	progId: string | undefined,
	clsId: string | undefined,
): { oleObjectType: OleObjectType; oleFileExtension: string } {
	if (progId) {
		for (const entry of PROG_ID_MAP) {
			if (entry.pattern.test(progId)) {
				return { oleObjectType: entry.type, oleFileExtension: entry.extension };
			}
		}
	}

	if (clsId) {
		const normalised = clsId.replace(/[{}]/gu, '').toUpperCase().trim();
		const match = CLSID_MAP.get(normalised);
		if (match) {
			return { oleObjectType: match.type, oleFileExtension: match.extension };
		}
	}

	// Try to infer from the oleTarget path extension
	return { oleObjectType: 'unknown', oleFileExtension: 'bin' };
}

/**
 * Infer file extension from an OLE target path inside the PPTX zip.
 * Returns undefined if no extension can be determined.
 */
export function inferOleExtensionFromTarget(oleTarget: string | undefined): string | undefined {
	if (!oleTarget) {
		return undefined;
	}
	const lastDot = oleTarget.lastIndexOf('.');
	if (lastDot === -1) {
		return undefined;
	}
	const ext = oleTarget.slice(lastDot + 1).toLowerCase();
	if (ext.length > 0 && ext.length <= 10) {
		return ext;
	}
	return undefined;
}

/**
 * Map of well-known file extensions to MIME types for embedded OLE payloads.
 * Lower-case extension (no leading dot) -> MIME type.
 */
const OLE_EXTENSION_MIME_MAP: ReadonlyMap<string, string> = new Map([
	['xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
	['xlsm', 'application/vnd.ms-excel.sheet.macroEnabled.12'],
	['xls', 'application/vnd.ms-excel'],
	['docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
	['docm', 'application/vnd.ms-word.document.macroEnabled.12'],
	['doc', 'application/msword'],
	['pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
	['ppt', 'application/vnd.ms-powerpoint'],
	['vsdx', 'application/vnd.ms-visio.drawing'],
	['vsd', 'application/vnd.visio'],
	['pdf', 'application/pdf'],
	['rtf', 'application/rtf'],
	['txt', 'text/plain'],
	['csv', 'text/csv'],
	['png', 'image/png'],
	['jpg', 'image/jpeg'],
	['jpeg', 'image/jpeg'],
	['gif', 'image/gif'],
	['wmf', 'image/wmf'],
	['emf', 'image/emf'],
	['zip', 'application/zip'],
]);

/**
 * Resolve a MIME type for an embedded OLE payload from its file name or
 * extension. Falls back to `application/octet-stream` when unknown.
 */
export function mimeTypeForOleFile(fileNameOrExtension: string | undefined): string {
	const fallback = 'application/octet-stream';
	if (!fileNameOrExtension) {
		return fallback;
	}
	const lastDot = fileNameOrExtension.lastIndexOf('.');
	const ext = (lastDot === -1 ? fileNameOrExtension : fileNameOrExtension.slice(lastDot + 1))
		.toLowerCase()
		.trim();
	return OLE_EXTENSION_MIME_MAP.get(ext) ?? fallback;
}

/**
 * Return a human-readable label for an OLE object type.
 */
export function getOleObjectTypeLabel(oleObjectType: OleObjectType | undefined): string {
	switch (oleObjectType) {
		case 'excel':
			return 'Microsoft Excel';
		case 'word':
			return 'Microsoft Word';
		case 'pdf':
			return 'PDF Document';
		case 'visio':
			return 'Microsoft Visio';
		case 'mathtype':
			return 'Equation';
		case 'package':
			return 'Embedded File';
		default:
			return 'Embedded Object';
	}
}
