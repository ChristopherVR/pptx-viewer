/**
 * "Current User" stream writer, the inverse of `current-user.ts`'s
 * `parseCurrentUserAtom`.
 *
 * Byte layout verified against a real PowerPoint-written `Current User`
 * stream (`sample-deck.ppt`'s, COM-generated): the FIXED header is exactly
 * 20 bytes (`size`(4) / `headerToken`(4) / `offsetToCurrentEdit`(4) /
 * `lenUserName`(2) / 6 version bytes), and the ANSI user name begins right
 * there at `dataOffset + 0x14` (== `dataOffset + size`), not at a hardcoded
 * `+ 0x18` as an earlier revision of this writer (and this project's OWN
 * `current-user.ts` reader) assumed. That earlier 4-byte overshoot made
 * every `.ppt` this writer produced fail to open in real PowerPoint outright
 * ("This version of PowerPoint can't open ..."), reproduced even for the
 * simplest single-textbox deck, and confirmed fixed by COM re-verification.
 * A 4-byte "release version" field follows the user name.
 *
 * @module ppt/writer/current-user-writer
 */

import { HEADER_TOKEN_ENCRYPTED, HEADER_TOKEN_PLAIN, RT } from '../record-types';
import { ByteWriter, record } from './byte-writer';

const USER_NAME = 'pptx-viewer';

/** Build the "Current User" stream bytes. */
export function buildCurrentUserStream(
	offsetToCurrentEdit: number,
	encrypted: boolean,
): Uint8Array {
	const nameBytes = new ByteWriter().ansi(USER_NAME).toBytes();
	const data = new ByteWriter()
		.u32(0x14) // size: byte length of the fixed header below (20)
		.u32(encrypted ? HEADER_TOKEN_ENCRYPTED : HEADER_TOKEN_PLAIN)
		.u32(offsetToCurrentEdit)
		.u16(nameBytes.length)
		.u16(0x03f4) // docFileVersion, verbatim from a real COM-written file
		.u8(3) // majorVersion
		.u8(0) // minorVersion
		.bytes(new Uint8Array(2)) // unused, reaching dataOffset + 0x14 (== size)
		.bytes(nameBytes)
		.u32(8) // release version
		.toBytes();
	return record(RT.CurrentUserAtom, data, 0, false, 0);
}
