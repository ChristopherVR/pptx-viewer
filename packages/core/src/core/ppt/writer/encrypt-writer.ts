/**
 * RC4 CryptoAPI encryption for the legacy `.ppt` writer, the encrypt-side
 * mirror of `ppt-encryption.ts`.
 *
 * RC4 is a symmetric stream cipher (XOR with a keystream), so "encrypt" and
 * "decrypt" are the identical operation given the same derived key; this
 * module reuses `decryptLegacyPptStream` directly rather than duplicating
 * the 512-byte re-keying loop.
 *
 * @module ppt/writer/encrypt-writer
 */

import {
	computeStandardKeyBase,
	deriveStandardKeyFromBase,
	RC4_ALG_ID,
} from '../../utils/ooxml-crypto-key-derivation';
import { hash } from '../../utils/ooxml-crypto-primitives';
import { rc4Cipher } from '../../utils/rc4-cipher';
import type { AdministrativeRange } from '../persist-directory';
import { decryptLegacyPptStream } from '../ppt-encryption';
import { RT } from '../record-types';
import { ByteWriter, record } from './byte-writer';

const CSP_NAME = 'Microsoft Base Cryptographic Provider v1.0';
const KEY_SIZE_BITS = 128;
const SALT_SIZE = 16;
const VERIFIER_SIZE = 16;
const VERIFIER_HASH_SIZE = 20; // SHA-1 output

/** Derived key material and encryption parameters for one `.ppt` save. */
export interface PptEncryptionContext {
	keyBase: Uint8Array;
	keySize: number;
	/** Framed CryptSession10Container record bytes. */
	cryptSessionRecord: Uint8Array;
}

/** Build the CryptSession10Container (a serialized StandardEncryptionInfo) for `password`. */
export async function buildCryptSession(password: string): Promise<PptEncryptionContext> {
	const salt = new Uint8Array(SALT_SIZE);
	crypto.getRandomValues(salt);
	const keyBase = await computeStandardKeyBase(password, salt);
	const key0 = await deriveStandardKeyFromBase(keyBase, KEY_SIZE_BITS, 0);

	const verifier = new Uint8Array(VERIFIER_SIZE);
	crypto.getRandomValues(verifier);
	const verifierHash = await hash('SHA-1', verifier);
	const encryptedVerifier = rc4Cipher(key0, verifier);
	const encryptedVerifierHash = rc4Cipher(key0, verifierHash.subarray(0, VERIFIER_HASH_SIZE));

	const cspNameBytes = new ByteWriter().utf16(CSP_NAME).u16(0).toBytes();
	const header = new ByteWriter()
		.u32(0) // header flags
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
		.u16(2) // versionMajor
		.u16(2) // versionMinor
		.u32(0x00000004) // flags: fCryptoAPI
		.u32(header.length)
		.bytes(header)
		.bytes(verifierBlock)
		.toBytes();

	return {
		keyBase,
		keySize: KEY_SIZE_BITS,
		cryptSessionRecord: record(RT.CryptSession10Container, infoBlob, 0, false, 0),
	};
}

/**
 * RC4-encipher `stream`, leaving `skipRanges` (the administrative records:
 * UserEditAtom, PersistDirectoryAtom, CryptSession10Container) untouched.
 */
export async function encryptDocumentStream(
	stream: Uint8Array,
	skipRanges: AdministrativeRange[],
	ctx: PptEncryptionContext,
): Promise<Uint8Array> {
	return decryptLegacyPptStream(stream, skipRanges, ctx.keyBase, ctx.keySize);
}

/** RC4-encipher the whole "Pictures" stream (no administrative ranges). */
export async function encryptPicturesStream(
	stream: Uint8Array,
	ctx: PptEncryptionContext,
): Promise<Uint8Array> {
	return decryptLegacyPptStream(stream, [], ctx.keyBase, ctx.keySize);
}
