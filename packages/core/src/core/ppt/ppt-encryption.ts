/**
 * RC4 CryptoAPI decryption for password-protected legacy .ppt files.
 *
 * A password-protected PowerPoint 97-2003 compound file uses the "RC4
 * CryptoAPI Encryption" scheme ([MS-OFFCRYPTO] 2.3.5): its EncryptionInfo
 * is stored in a CryptSession10Container persist object ([MS-PPT] 2.3.7)
 * and uses RC4 (`algId` 0x6801). Key derivation lives in
 * `rc4-cryptoapi-key.ts`, the per-stream layout of what is enciphered in
 * `rc4-cryptoapi-streams.ts`.
 *
 * The UserEditAtoms, PersistDirectoryAtoms and the CryptSession10Container
 * are always plaintext: a reader must be able to walk the edit chain and
 * read the encryption parameters before it can derive a key.
 *
 * @module ppt/ppt-encryption
 */

import { IncorrectPasswordError } from '../utils/ooxml-crypto-errors';
import { RC4_ALG_ID, parseEncryptionInfo } from '../utils/ooxml-crypto-key-derivation';
import type { StandardEncryptionInfo } from '../utils/ooxml-crypto-types';
import { EncryptedPptError } from './current-user';
import { buildPersistDirectory } from './persist-directory';
import {
	rc4CryptoApiBlockKey,
	rc4CryptoApiKeyBase,
	rc4CryptoApiVerifierMatches,
} from './rc4-cryptoapi-key';
import { cipherPersistObjects, cipherPicturesStream } from './rc4-cryptoapi-streams';
import { PptParseError, readRecordOrThrow } from './record-stream';
import { RT } from './record-types';

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
 * Verify a candidate password against the parsed encryption info's
 * verifier, returning the derived (block-0) encryption key on success.
 *
 * @param info - Parsed legacy .ppt encryption info (RC4 CryptoAPI).
 * @param password - Candidate password.
 * @returns The derived key, or null when the password is wrong.
 */
export async function verifyLegacyPptPassword(
	info: StandardEncryptionInfo,
	password: string,
): Promise<Uint8Array | null> {
	const base = await rc4CryptoApiKeyBase(password, info.verifier.salt);
	const key = await rc4CryptoApiBlockKey(base, info.header.keySize, 0);
	return (await rc4CryptoApiVerifierMatches(info, key)) ? key : null;
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
	const cryptId = currentEdit.encryptSessionPersistIdRef;
	if (cryptId === undefined) {
		throw new PptParseError('Encrypted .ppt file has no encryption session persist reference');
	}

	const cryptOffset = directory.get(cryptId);
	if (cryptOffset === undefined) {
		throw new PptParseError('CryptSession10Container persist object not found');
	}
	const cryptRecord = readRecordOrThrow(view, cryptOffset);
	if (cryptRecord.recType !== RT.CryptSession10Container) {
		throw new PptParseError(
			'Persist id referenced by the encryption session ref is not a CryptSession10Container',
		);
	}

	const info = parseLegacyPptEncryptionInfo(
		documentStream.subarray(cryptRecord.dataOffset, cryptRecord.dataOffset + cryptRecord.recLen),
	);
	const base = await rc4CryptoApiKeyBase(password, info.verifier.salt);
	const keyFor = (block: number) => rc4CryptoApiBlockKey(base, info.header.keySize, block);
	if (!(await rc4CryptoApiVerifierMatches(info, await keyFor(0)))) {
		throw new IncorrectPasswordError();
	}

	const decryptedDocument = await cipherPersistObjects(
		documentStream,
		directory,
		cryptId,
		keyFor,
		'decrypt',
	);
	const decryptedPictures = picturesStream
		? await cipherPicturesStream(picturesStream, keyFor, 'decrypt')
		: undefined;

	return { documentStream: decryptedDocument, picturesStream: decryptedPictures };
}
