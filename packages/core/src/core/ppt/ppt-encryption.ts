/**
 * RC4 CryptoAPI decryption for password-protected legacy .ppt files.
 *
 * A password-protected PowerPoint 97-2003 compound file uses the "RC4
 * CryptoAPI Encryption" scheme specified in [MS-OFFCRYPTO] 2.3.5.1. Its
 * password verifier and key derivation are byte-for-byte identical to the
 * "Standard Encryption" header used by encrypted OOXML packages (2.3.4.5-
 * 2.3.4.7), just embedded directly in a CryptSession10Container persist
 * object ([MS-PPT] 2.3.5) instead of a separate `EncryptionInfo` stream, and
 * used with RC4 (`algId` 0x6801) rather than AES.
 *
 * Only a content PREFIX of the "PowerPoint Document" stream is encrypted:
 * every UserEditAtom, PersistDirectoryAtom, and the CryptSession10Container
 * itself are always stored in plaintext (a reader must be able to walk the
 * edit chain and read the encryption parameters before it can derive a
 * key). The encrypted portion is enciphered in 512-byte blocks, each
 * re-keyed from the block's absolute offset in the stream.
 *
 * @module ppt/ppt-encryption
 */

import { IncorrectPasswordError } from '../utils/ooxml-crypto-errors';
import {
	RC4_ALG_ID,
	computeStandardKeyBase,
	deriveStandardKeyFromBase,
	parseEncryptionInfo,
} from '../utils/ooxml-crypto-key-derivation';
import { hash } from '../utils/ooxml-crypto-primitives';
import type { StandardEncryptionInfo } from '../utils/ooxml-crypto-types';
import { rc4Cipher } from '../utils/rc4-cipher';
import { EncryptedPptError } from './current-user';
import type { AdministrativeRange } from './persist-directory';
import { buildPersistDirectory, collectAdministrativeRanges } from './persist-directory';
import { PptParseError, readRecordOrThrow } from './record-stream';
import { RT } from './record-types';

/** Size, in bytes, of one RC4 re-keying block ([MS-OFFCRYPTO] 2.3.5.1). */
const RC4_BLOCK_SIZE = 512;

/**
 * Parse the CryptSession10Container's raw record data as an EncryptionInfo
 * structure and assert it is the (only supported) RC4 CryptoAPI scheme.
 *
 * @param data - Raw record data of the CryptSession10Container atom.
 * @returns The parsed standard-encryption info.
 * @throws EncryptedPptError if the scheme is not RC4 CryptoAPI encryption.
 */
export function parseLegacyPptEncryptionInfo(data: Uint8Array): StandardEncryptionInfo {
	const info = parseEncryptionInfo(data);
	if (!('isStandard' in info) || !info.isStandard) {
		throw new EncryptedPptError(
			'This .ppt file uses an unsupported encryption scheme (expected RC4 CryptoAPI encryption).',
		);
	}
	if (info.header.algId !== RC4_ALG_ID) {
		throw new EncryptedPptError(
			`This .ppt file is encrypted with an unsupported algorithm (algId 0x${info.header.algId.toString(16)}); only RC4 CryptoAPI encryption is supported.`,
		);
	}
	return info;
}

/**
 * Check a candidate key against the parsed encryption info's password
 * verifier fields.
 *
 * [MS-OFFCRYPTO] 2.3.4.9: the verifier and its hash are each RC4-enciphered
 * independently (the cipher is re-initialised with the same key for each
 * field, mirroring how the AES/Standard-Encryption path re-uses IV = 0 for
 * both single-block fields rather than treating them as one continuous
 * stream).
 */
async function verifierMatches(info: StandardEncryptionInfo, key: Uint8Array): Promise<boolean> {
	const decryptedVerifier = rc4Cipher(key, info.verifier.encryptedVerifier);
	const decryptedHash = rc4Cipher(key, info.verifier.encryptedVerifierHash);
	const computedHash = await hash('SHA-1', decryptedVerifier);

	const hashSize = Math.min(info.verifier.verifierHashSize, 20);
	for (let i = 0; i < hashSize; i++) {
		if (computedHash[i] !== decryptedHash[i]) {
			return false;
		}
	}
	return true;
}

/**
 * Verify a candidate password against the parsed encryption info's
 * verifier, returning the derived (block-0) encryption key on success.
 *
 * Standalone convenience wrapper. {@link decryptLegacyPpt} does the
 * equivalent check inline so it can reuse the expensive key-derivation base
 * (see {@link computeStandardKeyBase}) for the content blocks that follow
 * instead of paying for it twice.
 *
 * @param info - Parsed legacy .ppt encryption info (RC4 CryptoAPI).
 * @param password - Candidate password.
 * @returns The derived key, or null when the password is wrong.
 */
export async function verifyLegacyPptPassword(
	info: StandardEncryptionInfo,
	password: string,
): Promise<Uint8Array | null> {
	const base = await computeStandardKeyBase(password, info.verifier.salt);
	const key = await deriveStandardKeyFromBase(base, info.header.keySize, 0);
	return (await verifierMatches(info, key)) ? key : null;
}

/** True when `offset` falls inside one of `ranges`. */
function isInRange(offset: number, ranges: AdministrativeRange[]): AdministrativeRange | undefined {
	return ranges.find((r) => offset >= r.start && offset < r.end);
}

/** The next range in `ranges` (assumed sorted by `start`) that begins after `offset`, if any. */
function findNextRangeAfter(
	offset: number,
	ranges: AdministrativeRange[],
): AdministrativeRange | undefined {
	return ranges.find((r) => r.start > offset);
}

/**
 * RC4-decrypt one contiguous run of content bytes, re-keying every 512
 * bytes from the block's ABSOLUTE offset within the full stream (not the
 * offset within the run), per [MS-OFFCRYPTO] 2.3.5.1.
 *
 * Takes the pre-computed key-derivation `base` (see
 * {@link computeStandardKeyBase}) rather than a password: deriving it fresh
 * per block would redo all 50,000 SHA-1 iterations for every 512-byte
 * block, turning a sub-second operation into one that scales with file size
 * badly enough to make decrypting a real-world deck impractical.
 */
async function decryptRun(
	stream: Uint8Array,
	start: number,
	end: number,
	keyBase: Uint8Array,
	keySize: number,
): Promise<Uint8Array> {
	const out = new Uint8Array(end - start);
	let pos = start;
	while (pos < end) {
		const blockNumber = Math.floor(pos / RC4_BLOCK_SIZE);
		const blockStart = blockNumber * RC4_BLOCK_SIZE;
		const blockEnd = Math.min(blockStart + RC4_BLOCK_SIZE, end);
		const key = await deriveStandardKeyFromBase(keyBase, keySize, blockNumber);
		// RC4 is a stream cipher: the keystream must start from the block's
		// own beginning, so decrypt the full aligned block and slice out the
		// part actually needed (pos may be mid-block on the first iteration).
		const alignedCiphertext = stream.subarray(blockStart, blockEnd);
		const alignedPlaintext = rc4Cipher(key, alignedCiphertext);
		const usable = alignedPlaintext.subarray(pos - blockStart, blockEnd - blockStart);
		out.set(usable, pos - start);
		pos = blockEnd;
	}
	return out;
}

/**
 * Decrypt a legacy .ppt stream, leaving `skipRanges` byte-identical and
 * RC4-decrypting everything else in 512-byte re-keyed blocks.
 *
 * @param stream - Raw (partially encrypted) stream bytes.
 * @param skipRanges - Administrative ranges to copy through unchanged.
 * @param keyBase - Result of {@link computeStandardKeyBase} for the
 *   verified password and this file's salt.
 * @param keySize - Key size in bits.
 * @returns A new buffer, same length as `stream`, with content decrypted.
 */
export async function decryptLegacyPptStream(
	stream: Uint8Array,
	skipRanges: AdministrativeRange[],
	keyBase: Uint8Array,
	keySize: number,
): Promise<Uint8Array> {
	const sorted = [...skipRanges].sort((a, b) => a.start - b.start);
	const result = new Uint8Array(stream);

	let pos = 0;
	while (pos < stream.length) {
		const skip = isInRange(pos, sorted);
		if (skip) {
			pos = skip.end;
			continue;
		}
		const nextSkip = findNextRangeAfter(pos, sorted);
		const runEnd = nextSkip ? Math.min(nextSkip.start, stream.length) : stream.length;
		const decrypted = await decryptRun(stream, pos, runEnd, keyBase, keySize);
		result.set(decrypted, pos);
		pos = runEnd;
	}
	return result;
}

/** Result of decrypting a legacy .ppt's encrypted streams. */
export interface DecryptedLegacyPpt {
	/** Decrypted "PowerPoint Document" stream bytes. */
	documentStream: Uint8Array;
	/** Decrypted "Pictures" stream bytes, when the file has one. */
	picturesStream: Uint8Array | undefined;
}

/**
 * Locate the CryptSession10Container, verify `password` against it, and
 * decrypt the "PowerPoint Document" (and, when present, "Pictures") streams.
 *
 * @param documentStream - Raw "PowerPoint Document" stream bytes.
 * @param picturesStream - Raw "Pictures" stream bytes, if present.
 * @param offsetToCurrentEdit - From the CurrentUserAtom.
 * @param password - The user-supplied password.
 * @returns The decrypted streams.
 * @throws IncorrectPasswordError if `password` does not match the verifier.
 * @throws EncryptedPptError if the file uses an unsupported crypto scheme.
 * @throws PptParseError if the file's encryption metadata is malformed.
 */
export async function decryptLegacyPpt(
	documentStream: Uint8Array,
	picturesStream: Uint8Array | undefined,
	offsetToCurrentEdit: number,
	password: string,
): Promise<DecryptedLegacyPpt> {
	const view = new DataView(
		documentStream.buffer,
		documentStream.byteOffset,
		documentStream.byteLength,
	);
	const { currentEdit, directory } = buildPersistDirectory(view, offsetToCurrentEdit);
	if (currentEdit.encryptSessionPersistIdRef === undefined) {
		throw new PptParseError('Encrypted .ppt file has no encryption session persist reference');
	}

	const cryptOffset = directory.get(currentEdit.encryptSessionPersistIdRef);
	if (cryptOffset === undefined) {
		throw new PptParseError('CryptSession10Container persist object not found');
	}
	const cryptRecord = readRecordOrThrow(view, cryptOffset);
	if (cryptRecord.recType !== RT.CryptSession10Container) {
		throw new PptParseError(
			'Persist id referenced by the encryption session ref is not a CryptSession10Container',
		);
	}

	const infoBytes = documentStream.subarray(
		cryptRecord.dataOffset,
		cryptRecord.dataOffset + cryptRecord.recLen,
	);
	const info = parseLegacyPptEncryptionInfo(infoBytes);

	// Computed once and reused for the password check and every content
	// block: this is the expensive (50,000 SHA-1 iterations) part of
	// [MS-OFFCRYPTO] 2.3.6.2, and redoing it per block would make decrypting
	// a real deck impractically slow.
	const keyBase = await computeStandardKeyBase(password, info.verifier.salt);
	const key0 = await deriveStandardKeyFromBase(keyBase, info.header.keySize, 0);
	if (!(await verifierMatches(info, key0))) {
		throw new IncorrectPasswordError();
	}

	const skipRanges = collectAdministrativeRanges(view, offsetToCurrentEdit);
	skipRanges.push({
		start: cryptRecord.headerOffset,
		end: cryptRecord.dataOffset + cryptRecord.recLen,
	});

	const decryptedDocument = await decryptLegacyPptStream(
		documentStream,
		skipRanges,
		keyBase,
		info.header.keySize,
	);

	const decryptedPictures = picturesStream
		? await decryptLegacyPptStream(picturesStream, [], keyBase, info.header.keySize)
		: undefined;

	return { documentStream: decryptedDocument, picturesStream: decryptedPictures };
}
