/**
 * PersistDirectoryAtom / UserEditAtom writer, the inverse of
 * `persist-directory.ts`. The writer always produces a single "user edit"
 * (no incremental save history): one PersistDirectoryAtom listing every
 * persist object, followed by one UserEditAtom whose `offsetLastEdit` is 0.
 *
 * @module ppt/writer/persist-writer
 */

import { RT } from '../record-types';
import { ByteWriter, record } from './byte-writer';

/** Maximum run length a single packed header can cover (12-bit `cPersist`). */
const MAX_RUN = 0xfff;

/**
 * Build a PersistDirectoryAtom from (persistId, offset) pairs.
 *
 * Consecutive persist ids are batched under a single packed header
 * (`cPersist` runs), matching how real (COM-written) files encode this
 * atom: `sample-deck.ppt` packs its 9 persist objects (ids 1-9) as ONE
 * header (`cPersist = 9`) followed by 9 offsets, 48 bytes total, not 9
 * separate one-entry headers (72 bytes). The one-entry-per-header form this
 * writer used previously is not itself invalid per [MS-PPT] 2.3.6 (the
 * reader handles any `cPersist`, including 1), but matching the real
 * encoding removes one more difference from a file real PowerPoint's own
 * writer would produce.
 */
export function buildPersistDirectoryAtom(entries: Array<[number, number]>): Uint8Array {
	const sorted = [...entries].sort((a, b) => a[0] - b[0]);
	const w = new ByteWriter();
	let i = 0;
	while (i < sorted.length) {
		const startId = sorted[i]![0];
		let runLength = 1;
		while (
			i + runLength < sorted.length &&
			sorted[i + runLength]![0] === startId + runLength &&
			runLength < MAX_RUN
		) {
			runLength++;
		}
		w.u32((startId & 0xfffff) | (runLength << 20));
		for (let k = 0; k < runLength; k++) {
			w.u32(sorted[i + k]![1]);
		}
		i += runLength;
	}
	return record(RT.PersistDirectoryAtom, w.toBytes(), 0, false, 0);
}

/** Build a plaintext (unencrypted) UserEditAtom: 28 bytes of data. */
export function buildUserEditAtom(input: {
	offsetPersistDirectory: number;
	docPersistIdRef: number;
	maxPersistWritten: number;
	lastSlideId: number;
}): Uint8Array {
	const data = new ByteWriter()
		.i32(input.lastSlideId)
		.u32(0x03004f04) // version: verbatim from a real COM-written file (see module doc)
		.u32(0) // offsetLastEdit: no previous edit
		.u32(input.offsetPersistDirectory)
		.u32(input.docPersistIdRef)
		.u32(input.maxPersistWritten)
		.i32(1) // lastView: slide view
		.toBytes();
	return record(RT.UserEditAtom, data, 0, false, 0);
}

/** Build an encrypted UserEditAtom: 32 bytes of data (adds the crypt session ref). */
export function buildEncryptedUserEditAtom(
	input: Parameters<typeof buildUserEditAtom>[0] & { encryptSessionPersistIdRef: number },
): Uint8Array {
	const plain = buildUserEditAtom(input);
	const data = new ByteWriter()
		.bytes(plain.subarray(8))
		.u32(input.encryptSessionPersistIdRef)
		.toBytes();
	return record(RT.UserEditAtom, data, 0, false, 0);
}
