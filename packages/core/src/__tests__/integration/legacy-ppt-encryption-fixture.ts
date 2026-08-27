/**
 * Test-only builder for a synthetic password-protected legacy .ppt file.
 *
 * There is no known-password real-world encrypted `.ppt` fixture available
 * (the committed `encrypted.ppt` fixture's documented password does not
 * verify against the standard [MS-OFFCRYPTO] 2.3.5.1 algorithm, and its
 * true password could not be recovered), so this builds an equivalent file
 * from scratch: it takes an existing UNENCRYPTED `.ppt`, RC4-encrypts its
 * content region with a password we choose, and reassembles a
 * CryptSession10Container + fresh UserEditAtom/PersistDirectoryAtom exactly
 * the way real encrypted `.ppt` files are shaped. That makes the round trip
 * (`decryptLegacyPpt` undoing what this file does) a genuine test of the
 * production decryption code, end to end through `PptxHandler.load()`.
 *
 * @module __tests__/integration/legacy-ppt-encryption-fixture
 */
import { buildPersistDirectory, parseCurrentUserAtom, readRecordOrThrow, RT } from '../../core/ppt';
import { buildOle2, parseOle2 } from '../../core/utils/ole2-parser';
import {
	RC4_ALG_ID,
	computeStandardKeyBase,
	deriveStandardKeyFromBase,
} from '../../core/utils/ooxml-crypto-key-derivation';
import { getCrypto, hash } from '../../core/utils/ooxml-crypto-primitives';
import { rc4Cipher } from '../../core/utils/rc4-cipher';

const HEADER_TOKEN_ENCRYPTED = 0xf3d1c4df;
const KEY_SIZE_BITS = 128;
const ALG_ID_HASH_SHA1 = 0x8004;
const CSP_NAME = 'Microsoft Enhanced Cryptographic Provider v1.0';

function utf16leBytes(text: string): Uint8Array {
	const withNull = `${text}\0`;
	const out = new Uint8Array(withNull.length * 2);
	for (let i = 0; i < withNull.length; i++) {
		const code = withNull.charCodeAt(i);
		out[i * 2] = code & 0xff;
		out[i * 2 + 1] = (code >> 8) & 0xff;
	}
	return out;
}

function writeRecordHeader(
	recVer: number,
	recInstance: number,
	recType: number,
	recLen: number,
): Uint8Array {
	const out = new Uint8Array(8);
	const view = new DataView(out.buffer);
	view.setUint16(0, (recVer & 0x0f) | ((recInstance & 0x0fff) << 4), true);
	view.setUint16(2, recType, true);
	view.setUint32(4, recLen, true);
	return out;
}

/** Build a CryptSession10Container's raw EncryptionInfo body (RC4 CryptoAPI). */
function buildEncryptionInfoBytes(
	salt: Uint8Array,
	encryptedVerifier: Uint8Array,
	encryptedVerifierHash: Uint8Array,
): Uint8Array {
	const cspNameBytes = utf16leBytes(CSP_NAME);
	const headerFixedSize = 32;
	const headerSize = headerFixedSize + cspNameBytes.length;
	const verifierSize = 4 + 16 + 16 + 4 + encryptedVerifierHash.length;
	const total = 12 + headerSize + verifierSize;
	const data = new Uint8Array(total);
	const view = new DataView(data.buffer);

	view.setUint16(0, 4, true); // versionMajor
	view.setUint16(2, 2, true); // versionMinor
	view.setUint32(4, 0x0c, true); // flags: fCryptoAPI | fDocProps
	view.setUint32(8, headerSize, true);

	const h = 12;
	view.setUint32(h, 0x0c, true); // header flags
	view.setUint32(h + 4, 0, true); // sizeExtra
	view.setUint32(h + 8, RC4_ALG_ID, true);
	view.setUint32(h + 12, ALG_ID_HASH_SHA1, true);
	view.setUint32(h + 16, KEY_SIZE_BITS, true);
	view.setUint32(h + 20, 1, true); // providerType: PROV_RSA_FULL
	view.setUint32(h + 24, 0, true);
	view.setUint32(h + 28, 0, true);
	data.set(cspNameBytes, h + 32);

	const v = 12 + headerSize;
	view.setUint32(v, 16, true); // saltSize
	data.set(salt, v + 4);
	data.set(encryptedVerifier, v + 20);
	view.setUint32(v + 36, encryptedVerifierHash.length, true); // verifierHashSize
	data.set(encryptedVerifierHash, v + 40);

	return data;
}

/**
 * Build a synthetic password-protected `.ppt` from an unencrypted one.
 *
 * @param plainPptBuffer - Bytes of an unencrypted, single-edit `.ppt` file
 *   (no "Pictures" stream; `sample-deck.ppt` and `text-features.ppt` qualify).
 * @param password - The password to protect it with.
 * @returns ArrayBuffer of the synthetic encrypted `.ppt` OLE2 file.
 */
export async function buildSyntheticEncryptedPpt(
	plainPptBuffer: ArrayBuffer,
	password: string,
): Promise<ArrayBuffer> {
	const ole = parseOle2(plainPptBuffer);
	const currentUserStream = ole.getStream('Current User');
	const documentStream = ole.getStream('PowerPoint Document');
	if (!currentUserStream || !documentStream) {
		throw new Error('Source .ppt is missing required streams');
	}
	const currentUser = parseCurrentUserAtom(currentUserStream);
	if (currentUser.isEncrypted) {
		throw new Error('Source .ppt must not already be encrypted');
	}

	const view = new DataView(
		documentStream.buffer,
		documentStream.byteOffset,
		documentStream.byteLength,
	);
	const { currentEdit, directory } = buildPersistDirectory(view, currentUser.offsetToCurrentEdit);
	if (currentEdit.offsetLastEdit !== 0) {
		throw new Error('Source .ppt must have a single edit (no incremental save history)');
	}

	const userEditOffset = currentUser.offsetToCurrentEdit;
	const persistDirOffset = currentEdit.offsetPersistDirectory;
	const contentEnd = Math.min(userEditOffset, persistDirOffset);
	const content = documentStream.subarray(0, contentEnd);

	// --- Build the encryption parameters and verifier. ---
	// The base (H50000) is expensive (50,000 SHA-1 iterations) but
	// password/salt-dependent only, not block-dependent: compute it once and
	// reuse it for the verifier's block-0 key and every content block below.
	const salt = new Uint8Array(16);
	getCrypto().getRandomValues(salt);
	const keyBase = await computeStandardKeyBase(password, salt);
	const key = await deriveStandardKeyFromBase(keyBase, KEY_SIZE_BITS, 0);

	const verifierPlain = new Uint8Array(16);
	getCrypto().getRandomValues(verifierPlain);
	const verifierHashPlain = await hash('SHA-1', verifierPlain);
	const encryptedVerifier = rc4Cipher(key, verifierPlain);
	const encryptedVerifierHash = rc4Cipher(key, verifierHashPlain);
	const infoBytes = buildEncryptionInfoBytes(salt, encryptedVerifier, encryptedVerifierHash);

	// --- Encrypt the content region in 512-byte re-keyed blocks. ---
	const BLOCK_SIZE = 512;
	const encryptedContent = new Uint8Array(content.length);
	for (let pos = 0; pos < content.length;) {
		const blockNumber = Math.floor(pos / BLOCK_SIZE);
		const blockStart = blockNumber * BLOCK_SIZE;
		const blockEnd = Math.min(blockStart + BLOCK_SIZE, content.length);
		const blockKey = await deriveStandardKeyFromBase(keyBase, KEY_SIZE_BITS, blockNumber);
		const plainBlock = content.subarray(blockStart, blockEnd);
		const cipherBlock = rc4Cipher(blockKey, plainBlock);
		encryptedContent.set(cipherBlock, blockStart);
		pos = blockEnd;
	}

	// --- Append the CryptSession10Container, then a fresh persist directory
	//     and UserEditAtom that supersede the original ones. ---
	const cryptSessionOffset = contentEnd;
	const cryptSessionRecord = writeRecordHeader(
		0x0f,
		0,
		RT.CryptSession10Container,
		infoBytes.length,
	);
	const cryptSessionBytes = new Uint8Array(cryptSessionRecord.length + infoBytes.length);
	cryptSessionBytes.set(cryptSessionRecord, 0);
	cryptSessionBytes.set(infoBytes, cryptSessionRecord.length);

	const cryptPersistId = Math.max(...directory.keys()) + 1;
	const entries = [
		...directory.entries(),
		[cryptPersistId, cryptSessionOffset] as [number, number],
	];
	const persistDirData = new Uint8Array(entries.length * 8);
	{
		const dirView = new DataView(persistDirData.buffer);
		entries.forEach(([id, offset], i) => {
			dirView.setUint32(i * 8, (id & 0xfffff) | (1 << 20), true);
			dirView.setUint32(i * 8 + 4, offset, true);
		});
	}
	const persistDirOffsetNew = cryptSessionOffset + cryptSessionBytes.length;
	const persistDirRecord = writeRecordHeader(0, 0, RT.PersistDirectoryAtom, persistDirData.length);
	const persistDirBytes = new Uint8Array(persistDirRecord.length + persistDirData.length);
	persistDirBytes.set(persistDirRecord, 0);
	persistDirBytes.set(persistDirData, persistDirRecord.length);

	const userEditOffsetNew = persistDirOffsetNew + persistDirBytes.length;
	const userEditRecord = writeRecordHeader(0, 0, RT.UserEditAtom, 0x20);
	const userEditData = new Uint8Array(0x20);
	{
		const uView = new DataView(userEditData.buffer);
		uView.setUint32(8, 0, true); // offsetLastEdit
		uView.setUint32(12, persistDirOffsetNew, true); // offsetPersistDirectory
		uView.setUint32(16, currentEdit.docPersistIdRef, true); // docPersistIdRef
		uView.setUint32(28, cryptPersistId, true); // encryptSessionPersistIdRef
	}
	const userEditBytes = new Uint8Array(userEditRecord.length + userEditData.length);
	userEditBytes.set(userEditRecord, 0);
	userEditBytes.set(userEditData, userEditRecord.length);

	const newDocumentStream = new Uint8Array(
		encryptedContent.length +
			cryptSessionBytes.length +
			persistDirBytes.length +
			userEditBytes.length,
	);
	newDocumentStream.set(encryptedContent, 0);
	newDocumentStream.set(cryptSessionBytes, cryptSessionOffset);
	newDocumentStream.set(persistDirBytes, persistDirOffsetNew);
	newDocumentStream.set(userEditBytes, userEditOffsetNew);

	// --- Build the new "Current User" stream. ---
	const currentUserRecord = writeRecordHeader(0, 0, RT.CurrentUserAtom, 20);
	const currentUserData = new Uint8Array(20);
	{
		const cuView = new DataView(currentUserData.buffer);
		cuView.setUint32(0, 0x14, true); // size
		cuView.setUint32(4, HEADER_TOKEN_ENCRYPTED, true); // headerToken
		cuView.setUint32(8, userEditOffsetNew, true); // offsetToCurrentEdit
		cuView.setUint16(12, 0, true); // lenUserName
	}
	const newCurrentUserStream = new Uint8Array(currentUserRecord.length + currentUserData.length);
	newCurrentUserStream.set(currentUserRecord, 0);
	newCurrentUserStream.set(currentUserData, currentUserRecord.length);

	const streams = new Map<string, Uint8Array>();
	streams.set('Current User', newCurrentUserStream);
	streams.set('PowerPoint Document', newDocumentStream);

	// Sanity-check: readRecordOrThrow must accept our freshly-written headers.
	readRecordOrThrow(new DataView(newDocumentStream.buffer), cryptSessionOffset);

	return buildOle2(streams);
}
