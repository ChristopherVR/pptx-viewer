/**
 * RC4 CryptoAPI enciphering of the two encrypted streams of a
 * password-protected `.ppt` ([MS-PPT] 2.3.7), shared by the importer
 * (decrypt) and the writer (encrypt). RC4 is symmetric, so one routine
 * serves both directions; `mode` only says which side of the cipher holds
 * the plaintext record headers the walk needs to find each record's length.
 *
 * - "PowerPoint Document": every persist object except the
 *   CryptSession10Container is ONE RC4 stream keyed with its persist object
 *   identifier as the block number. The UserEditAtoms and
 *   PersistDirectoryAtoms are not persist objects and stay plaintext.
 * - "Pictures": each OfficeArtBStoreContainerFileBlock is split into its
 *   fields (record header, rgbUid1, optional rgbUid2, the metafile header or
 *   the bitmap tag byte, then the picture data), and every field is its own
 *   RC4 stream under the block-0 key.
 *
 * Both layouts were measured against a file PowerPoint encrypted itself
 * (`encrypted-powerpoint.ppt`).
 *
 * @module ppt/rc4-cryptoapi-streams
 */

import { rc4Cipher } from '../utils/rc4-cipher';
import type { PersistDirectory } from './persist-directory';
import { RECORD_HEADER_SIZE } from './record-stream';

/** Which side of the cipher the input bytes are on. */
export type Rc4Mode = 'decrypt' | 'encrypt';

/** Resolves the RC4 key for one block number. */
export type Rc4KeyForBlock = (blockNumber: number) => Promise<Uint8Array>;

const UID_SIZE = 16;
const METAFILE_HEADER_SIZE = 34;
const BITMAP_TAG_SIZE = 1;
/** OfficeArtBlipEMF / WMF / PICT record types (metafile blips). */
const METAFILE_BLIPS = new Set([0xf01a, 0xf01b, 0xf01c]);
/** OfficeArtBlipJPEG / PNG / DIB / TIFF / JPEG (CMYK) record types (bitmap blips). */
const BITMAP_BLIPS = new Set([0xf01d, 0xf01e, 0xf01f, 0xf029, 0xf02a]);

function readHeader(bytes: Uint8Array): { recInstance: number; recType: number; recLen: number } {
	const view = new DataView(bytes.buffer, bytes.byteOffset, RECORD_HEADER_SIZE);
	return {
		recInstance: view.getUint16(0, true) >>> 4,
		recType: view.getUint16(2, true),
		recLen: view.getUint32(4, true),
	};
}

/** Header, as plaintext, of the record whose (possibly ciphered) header is `raw`. */
function plainHeader(
	raw: Uint8Array,
	key: Uint8Array,
	mode: Rc4Mode,
): ReturnType<typeof readHeader> {
	return readHeader(mode === 'decrypt' ? rc4Cipher(key, raw) : raw);
}

/**
 * Encipher (or decipher) every persist object of a "PowerPoint Document"
 * stream listed in `directory`, except `skipPersistId` (the
 * CryptSession10Container, which is always plaintext).
 *
 * @returns A new buffer; bytes outside the persist objects are copied through.
 */
export async function cipherPersistObjects(
	stream: Uint8Array,
	directory: PersistDirectory,
	skipPersistId: number | undefined,
	keyFor: Rc4KeyForBlock,
	mode: Rc4Mode,
): Promise<Uint8Array> {
	const out = new Uint8Array(stream);
	for (const [persistId, offset] of directory) {
		if (persistId === skipPersistId || offset + RECORD_HEADER_SIZE > stream.length) {
			continue;
		}
		const key = await keyFor(persistId);
		const header = plainHeader(stream.subarray(offset, offset + RECORD_HEADER_SIZE), key, mode);
		const end = Math.min(stream.length, offset + RECORD_HEADER_SIZE + header.recLen);
		out.set(rc4Cipher(key, stream.subarray(offset, end)), offset);
	}
	return out;
}

/** Field sizes, after the record header, of one Pictures-stream record body. */
function bodyFieldSizes(recType: number, recInstance: number, recLen: number): number[] {
	const uids = recInstance & 1 ? 2 : 1;
	let lead: number[] = [];
	if (METAFILE_BLIPS.has(recType)) {
		lead = [...Array<number>(uids).fill(UID_SIZE), METAFILE_HEADER_SIZE];
	} else if (BITMAP_BLIPS.has(recType)) {
		lead = [...Array<number>(uids).fill(UID_SIZE), BITMAP_TAG_SIZE];
	}
	const fields: number[] = [];
	let remaining = recLen;
	for (const size of lead) {
		if (remaining <= 0) {
			break;
		}
		fields.push(Math.min(size, remaining));
		remaining -= size;
	}
	if (remaining > 0) {
		fields.push(remaining);
	}
	return fields;
}

/**
 * Encipher (or decipher) a "Pictures" stream record by record, each field
 * restarting the block-0 key stream.
 *
 * @returns A new buffer of the same length.
 */
export async function cipherPicturesStream(
	stream: Uint8Array,
	keyFor: Rc4KeyForBlock,
	mode: Rc4Mode,
): Promise<Uint8Array> {
	const key = await keyFor(0);
	const out = new Uint8Array(stream);
	let pos = 0;
	while (pos + RECORD_HEADER_SIZE <= stream.length) {
		const rawHeader = stream.subarray(pos, pos + RECORD_HEADER_SIZE);
		if (rawHeader.every((b) => b === 0)) {
			// PowerPoint pads the stream after the last record with PLAINTEXT
			// zeros (measured); a zero header on either side ends the walk.
			break;
		}
		const header = plainHeader(rawHeader, key, mode);
		out.set(rc4Cipher(key, rawHeader), pos);
		pos += RECORD_HEADER_SIZE;
		for (const size of bodyFieldSizes(header.recType, header.recInstance, header.recLen)) {
			const end = Math.min(stream.length, pos + size);
			out.set(rc4Cipher(key, stream.subarray(pos, end)), pos);
			pos = end;
		}
	}
	return out;
}
