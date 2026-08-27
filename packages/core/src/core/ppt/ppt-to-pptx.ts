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

import { EncryptedFileError } from '../utils/encryption-detection';
import type { Ole2File } from '../utils/ole2-parser';
import { parseCurrentUserAtom } from './current-user';
import { parseDeck } from './document-parser';
import { decryptLegacyPpt } from './ppt-encryption';
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
 * True when a legacy .ppt compound file is password-protected.
 *
 * @param ole - Parsed OLE2 compound file. Must satisfy {@link isLegacyPpt}.
 */
export function isEncryptedLegacyPpt(ole: Ole2File): boolean {
	const currentUserStream = ole.getStream(CURRENT_USER_STREAM);
	if (!currentUserStream) {
		return false;
	}
	try {
		return parseCurrentUserAtom(currentUserStream).isEncrypted;
	} catch {
		return false;
	}
}

/**
 * Convert a legacy .ppt compound file into PPTX package bytes.
 *
 * When the file is password-protected, `password` decrypts it (RC4
 * CryptoAPI encryption, [MS-OFFCRYPTO] 2.3.5.1) before parsing. Without a
 * password, an encrypted file throws {@link EncryptedFileError}, mirroring
 * how encrypted OOXML packages are handled so the same "enter a password"
 * UI flow covers both formats.
 *
 * @param ole - Parsed OLE2 compound file.
 * @param password - Document password, required only if the file is encrypted.
 * @returns ArrayBuffer of a generated .pptx (ZIP) package.
 * @throws EncryptedFileError when the .ppt is password protected and no
 *   password was supplied.
 * @throws IncorrectPasswordError when the supplied password is wrong.
 * @throws EncryptedPptError when the file uses an unsupported encryption scheme.
 * @throws PptParseError when the file is structurally invalid.
 */
export async function convertPptToPptx(ole: Ole2File, password?: string): Promise<ArrayBuffer> {
	const currentUserStream = ole.getStream(CURRENT_USER_STREAM);
	if (!currentUserStream) {
		throw new PptParseError('Legacy .ppt file is missing the "Current User" stream');
	}
	const currentUser = parseCurrentUserAtom(currentUserStream);

	let documentStream = ole.getStream(DOCUMENT_STREAM);
	if (!documentStream) {
		throw new PptParseError('Legacy .ppt file is missing the "PowerPoint Document" stream');
	}
	let picturesStream = ole.getStream(PICTURES_STREAM);
	let decrypted = false;

	if (currentUser.isEncrypted) {
		if (!password) {
			throw new EncryptedFileError(
				'This is a password-protected PowerPoint 97-2003 (.ppt) file. Provide a password via options.password to open it.',
			);
		}
		const result = await decryptLegacyPpt(
			documentStream,
			picturesStream,
			currentUser.offsetToCurrentEdit,
			password,
		);
		documentStream = result.documentStream;
		picturesStream = result.picturesStream;
		decrypted = true;
	}

	const deck = await parseDeck({
		powerPointDocument: documentStream,
		pictures: picturesStream,
		offsetToCurrentEdit: currentUser.offsetToCurrentEdit,
		decrypted,
	});

	return buildPptxPackage(deck);
}
