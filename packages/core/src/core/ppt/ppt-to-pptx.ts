/**
 * Legacy .ppt (PowerPoint 97-2003) to in-memory .pptx conversion.
 *
 * Entry point used by the load path: detects the "PowerPoint Document"
 * stream inside an OLE2 compound file, parses the binary record model and
 * synthesizes an equivalent OpenXML package that the existing PPTX pipeline
 * loads.
 *
 * @module ppt/ppt-to-pptx
 */

import type { Ole2File } from '../utils/ole2-parser';
import { EncryptedPptError, parseCurrentUserAtom } from './current-user';
import { parseDeck } from './document-parser';
import { buildPptxPackage } from './pptx/package-writer';
import { PptParseError } from './record-stream';

/** Stream name of the main PowerPoint document stream. */
const DOCUMENT_STREAM = 'PowerPoint Document';
/** Stream name of the current user stream. */
const CURRENT_USER_STREAM = 'Current User';
/** Stream name of the pictures (BLIP delay) stream. */
const PICTURES_STREAM = 'Pictures';

/**
 * True when the OLE2 file is a legacy PowerPoint 97-2003 presentation.
 */
export function isLegacyPpt(ole: Ole2File): boolean {
	return ole.entries.some((entry) => entry.name === DOCUMENT_STREAM);
}

/**
 * Convert a legacy .ppt compound file into PPTX package bytes.
 *
 * @param ole - Parsed OLE2 compound file.
 * @returns ArrayBuffer of a generated .pptx (ZIP) package.
 * @throws EncryptedPptError when the .ppt is password protected.
 * @throws PptParseError when the file is structurally invalid.
 */
export async function convertPptToPptx(ole: Ole2File): Promise<ArrayBuffer> {
	const currentUserStream = ole.getStream(CURRENT_USER_STREAM);
	if (!currentUserStream) {
		throw new PptParseError('Legacy .ppt file is missing the "Current User" stream');
	}
	const currentUser = parseCurrentUserAtom(currentUserStream);
	if (currentUser.isEncrypted) {
		throw new EncryptedPptError();
	}

	const documentStream = ole.getStream(DOCUMENT_STREAM);
	if (!documentStream) {
		throw new PptParseError('Legacy .ppt file is missing the "PowerPoint Document" stream');
	}

	const deck = await parseDeck({
		powerPointDocument: documentStream,
		pictures: ole.getStream(PICTURES_STREAM),
		offsetToCurrentEdit: currentUser.offsetToCurrentEdit,
	});

	return buildPptxPackage(deck);
}
