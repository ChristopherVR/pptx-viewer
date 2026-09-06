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

/**
 * Real (COM-written) `.ppt` files always pad the "Current User" STREAM
 * (not the `CurrentUserAtom` record inside it, which stays short) to exactly
 * this many bytes with trailing zero bytes that no record ever references.
 * Confirmed required, not cosmetic, by reverse bisection against a
 * COM-authored fixture: pairing a genuine PowerPoint `Document`/
 * `MainMaster`/`Slide` subtree with this writer's own (unpadded)
 * `Current User` stream made `Presentations.Open` fail; padding it to this
 * exact size, and nothing else, was both necessary and sufficient to make
 * that same pairing open and read back correctly.
 *
 * This size must ALSO stay strictly smaller (in whole 512-byte CFB sectors)
 * than "PowerPoint Document" itself: bisecting purely by deck size (slide
 * count, then run length, holding everything else fixed) found
 * `Presentations.Open` flips from failing to succeeding exactly when
 * "PowerPoint Document" grows from 8 sectors (4096 bytes, tied with
 * `Current User`) to 9 (4608 bytes). This writer keeps `Current User` fixed
 * at the real convention below and instead pads "PowerPoint Document" up to
 * clear that threshold when a deck is small enough to need it (see
 * `document-stream-layout.ts`'s `ensureMinimumDocumentStreamSize`):
 * shrinking `Current User` instead was tried and rejected, since it
 * introduced its OWN COM rejection (a shrunk `Current User` still failed,
 * confirmed by direct testing at several shrunk sizes). Every real
 * PowerPoint file this project has inspected sidesteps the whole problem
 * automatically, because a full embedded theme (12+ layouts, fonts,
 * environment records) makes "PowerPoint Document" orders of magnitude
 * bigger than 4096 bytes on its own; this writer does not emit that theme
 * (a separate, larger feature), so its smallest decks need the content-side
 * padding instead.
 */
const CURRENT_USER_STREAM_SIZE = 4096;

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
	const rec = record(RT.CurrentUserAtom, data, 0, false, 0);
	if (rec.length >= CURRENT_USER_STREAM_SIZE) {
		return rec;
	}
	const padded = new Uint8Array(CURRENT_USER_STREAM_SIZE);
	padded.set(rec, 0);
	return padded;
}
