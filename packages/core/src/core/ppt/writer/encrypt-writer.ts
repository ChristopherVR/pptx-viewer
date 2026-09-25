/**
 * RC4 CryptoAPI encryption for the legacy `.ppt` writer, the encrypt-side
 * mirror of `ppt-encryption.ts`.
 *
 * RC4 is a symmetric stream cipher, so this reuses the importer's
 * `rc4-cryptoapi-streams.ts` walks in `'encrypt'` mode rather than
 * duplicating them. The CryptSession10Container mirrors the one PowerPoint
 * writes itself (EncryptionInfo 4.2, the Enhanced provider, a 128-bit key).
 *
 * @module ppt/writer/encrypt-writer
 */

import { RC4_ALG_ID } from '../../utils/ooxml-crypto-key-derivation';
import type { PersistDirectory } from '../persist-directory';
import {
	rc4CryptoApiBlockKey,
	rc4CryptoApiEncryptVerifier,
	rc4CryptoApiKeyBase,
} from '../rc4-cryptoapi-key';
import { cipherPersistObjects, cipherPicturesStream } from '../rc4-cryptoapi-streams';
import type { Rc4KeyForBlock } from '../rc4-cryptoapi-streams';
import { RT } from '../record-types';
import { ByteWriter, record } from './byte-writer';

const CSP_NAME = 'Microsoft Enhanced Cryptographic Provider v1.0';
const KEY_SIZE_BITS = 128;
const SALT_SIZE = 16;
const VERIFIER_SIZE = 16;
const VERIFIER_HASH_SIZE = 20; // SHA-1 output
/**
 * EncryptionHeader / EncryptionInfo flags fCryptoAPI | fDocProps, as
 * PowerPoint writes them. Measured over COM: with fCryptoAPI alone (0x04)
 * PowerPoint verifies the password and then reports the file as corrupt.
 */
const ENCRYPTION_FLAGS = 0x0c;

/** Derived key material and encryption parameters for one `.ppt` save. */
export interface PptEncryptionContext {
	keyFor: Rc4KeyForBlock;
	/** Framed CryptSession10Container record bytes. */
	cryptSessionRecord: Uint8Array;
}

/** Build the CryptSession10Container (a serialized EncryptionInfo) for `password`. */
export async function buildCryptSession(password: string): Promise<PptEncryptionContext> {
	const salt = new Uint8Array(SALT_SIZE);
	crypto.getRandomValues(salt);
	const base = await rc4CryptoApiKeyBase(password, salt);
	const keyFor: Rc4KeyForBlock = (block) => rc4CryptoApiBlockKey(base, KEY_SIZE_BITS, block);

	const verifier = new Uint8Array(VERIFIER_SIZE);
	crypto.getRandomValues(verifier);
	const { encryptedVerifier, encryptedVerifierHash } = await rc4CryptoApiEncryptVerifier(
		await keyFor(0),
		verifier,
	);

	const cspNameBytes = new ByteWriter().utf16(CSP_NAME).u16(0).toBytes();
	const header = new ByteWriter()
		.u32(ENCRYPTION_FLAGS) // header flags
		.u32(0) // sizeExtra
		.u32(RC4_ALG_ID)
		.u32(0x8004) // algIdHash: SHA-1
		.u32(KEY_SIZE_BITS)
		.u32(1) // providerType: PROV_RSA_FULL
		.u32(0) // reserved1
		.u32(0) // reserved2
		.bytes(cspNameBytes)
		.toBytes();

	const verifierBlock = new ByteWriter()
		.u32(SALT_SIZE)
		.bytes(salt)
		.bytes(encryptedVerifier)
		.u32(VERIFIER_HASH_SIZE)
		.bytes(encryptedVerifierHash)
		.toBytes();

	const infoBlob = new ByteWriter()
		.u16(4) // versionMajor
		.u16(2) // versionMinor
		.u32(ENCRYPTION_FLAGS)
		.u32(header.length)
		.bytes(header)
		.bytes(verifierBlock)
		.toBytes();

	return {
		keyFor,
		// [MS-PPT] 2.3.7: a container header (recVer 0xF), as PowerPoint writes
		// it; PowerPoint reports a recVer 0 header as a corrupt file.
		cryptSessionRecord: record(RT.CryptSession10Container, infoBlob, 0, true),
	};
}

/**
 * RC4-encipher every persist object of `stream` listed in `directory`
 * except the CryptSession10Container (`cryptPersistId`).
 */
export async function encryptDocumentStream(
	stream: Uint8Array,
	directory: PersistDirectory,
	cryptPersistId: number,
	ctx: PptEncryptionContext,
): Promise<Uint8Array> {
	return cipherPersistObjects(stream, directory, cryptPersistId, ctx.keyFor, 'encrypt');
}

/** RC4-encipher the "Pictures" stream, record field by record field. */
export async function encryptPicturesStream(
	stream: Uint8Array,
	ctx: PptEncryptionContext,
): Promise<Uint8Array> {
	return cipherPicturesStream(stream, ctx.keyFor, 'encrypt');
}
