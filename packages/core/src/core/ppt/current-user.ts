/**
 * CurrentUserAtom parsing ([MS-PPT] 2.3.2).
 *
 * The "Current User" stream of a legacy .ppt compound file contains a single
 * CurrentUserAtom record pointing at the most recent UserEditAtom in the
 * "PowerPoint Document" stream. Its headerToken also tells us whether the
 * document is encrypted.
 *
 * @module ppt/current-user
 */

import { PptParseError, readRecordOrThrow } from './record-stream';
import { HEADER_TOKEN_ENCRYPTED, HEADER_TOKEN_PLAIN, RT } from './record-types';

/** Parsed CurrentUserAtom. */
export interface CurrentUserAtom {
	/** Whether the document is encrypted (headerToken 0xF3D1C4DF). */
	isEncrypted: boolean;
	/** Offset of the most recent UserEditAtom in the PowerPoint Document stream. */
	offsetToCurrentEdit: number;
	/** Last author user name (ANSI portion). */
	userName: string;
}

/**
 * Error thrown for password-protected legacy .ppt files.
 * Mirrors the naming style of EncryptedFileError for OOXML packages.
 */
export class EncryptedPptError extends Error {
	public readonly isEncrypted = true;

	public constructor(
		message = 'This is a password-protected PowerPoint 97-2003 (.ppt) file. Encrypted .ppt files are not supported.',
	) {
		super(message);
		this.name = 'EncryptedPptError';
	}
}

/**
 * Parse the CurrentUserAtom from the "Current User" stream bytes.
 *
 * @param stream - Raw bytes of the "Current User" stream.
 * @returns The parsed atom.
 * @throws PptParseError if the stream is malformed.
 */
export function parseCurrentUserAtom(stream: Uint8Array): CurrentUserAtom {
	const view = new DataView(stream.buffer, stream.byteOffset, stream.byteLength);
	const rec = readRecordOrThrow(view, 0);
	if (rec.recType !== RT.CurrentUserAtom) {
		throw new PptParseError(
			`Current User stream does not start with a CurrentUserAtom (recType 0x${rec.recType.toString(16)})`,
		);
	}
	const d = rec.dataOffset;
	if (d + 16 > view.byteLength) {
		throw new PptParseError('CurrentUserAtom is truncated');
	}
	const size = view.getUint32(d, true);
	if (size !== 0x14) {
		throw new PptParseError(`CurrentUserAtom size field is 0x${size.toString(16)}, expected 0x14`);
	}
	const headerToken = view.getUint32(d + 4, true);
	const offsetToCurrentEdit = view.getUint32(d + 8, true);
	const lenUserName = view.getUint16(d + 12, true);

	const isEncrypted = headerToken === HEADER_TOKEN_ENCRYPTED;
	if (!isEncrypted && headerToken !== HEADER_TOKEN_PLAIN) {
		throw new PptParseError(`Unknown CurrentUserAtom headerToken 0x${headerToken.toString(16)}`);
	}

	let userName = '';
	const nameStart = d + 0x18;
	for (let i = 0; i < lenUserName && nameStart + i < view.byteLength; i++) {
		userName += String.fromCharCode(view.getUint8(nameStart + i));
	}

	return { isEncrypted, offsetToCurrentEdit, userName };
}
