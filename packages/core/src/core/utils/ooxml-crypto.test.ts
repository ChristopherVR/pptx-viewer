/**
 * Tests for OOXML encryption and decryption.
 *
 * Validates:
 * - Helper functions (base64, UTF-16LE encoding, array concat)
 * - EncryptionInfo parsing (agile and standard)
 * - Password verification and key derivation
 * - Round-trip encrypt/decrypt
 * - OLE2 container integration
 * - Error handling (wrong password, corrupt data, missing streams)
 * - PptxHandlerCore.load() integration with encrypted files
 *
 * @module ooxml-crypto.test
 */

import { readFile } from 'node:fs/promises';

import { describe, it, expect } from 'vitest';

import { parseOle2, buildOle2, Ole2ParseError } from './ole2-parser';
import {
	decryptPptx,
	encryptPptx,
	verifyPassword,
	IncorrectPasswordError,
	DataIntegrityError,
	_parseEncryptionInfo as parseEncryptionInfo,
	_base64Decode as base64Decode,
	_base64Encode as base64Encode,
	_encodePasswordUtf16LE as encodePasswordUtf16LE,
	_concatArrays as concatArrays,
	_deriveAgileKey as deriveAgileKey,
	_hash as cryptoHash,
} from './ooxml-crypto';
import type { EncryptionInfo, StandardEncryptionInfo } from './ooxml-crypto';

/** Low spinCount for fast tests — production default is 100000. */
const TEST_SPIN_COUNT = 100;

// ---------------------------------------------------------------------------
// Helper: build a minimal valid PPTX ZIP buffer
// ---------------------------------------------------------------------------

/**
 * Create a minimal ZIP buffer that looks like a PPTX file.
 * A valid ZIP has at least a local file header and central directory.
 */
function createMinimalZipBuffer(): ArrayBuffer {
	// Minimal ZIP with one empty file entry "[Content_Types].xml"
	// This is a valid ZIP structure that JSZip can parse
	const fileName = '[Content_Types].xml';
	const fileContent = new TextEncoder().encode(
		'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
			'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>',
	);

	const fileNameBytes = new TextEncoder().encode(fileName);

	// Local file header (30 + name + data)
	const localHeaderSize = 30 + fileNameBytes.length;
	const localEntrySize = localHeaderSize + fileContent.length;

	// Central directory entry (46 + name)
	const centralDirEntrySize = 46 + fileNameBytes.length;

	// End of central directory record (22)
	const eocdSize = 22;

	const totalSize = localEntrySize + centralDirEntrySize + eocdSize;
	const buf = new ArrayBuffer(totalSize);
	const view = new DataView(buf);
	const bytes = new Uint8Array(buf);

	let offset = 0;

	// --- Local file header ---
	view.setUint32(offset, 0x04034b50, true); // signature
	offset += 4;
	view.setUint16(offset, 20, true); // version needed
	offset += 2;
	view.setUint16(offset, 0, true); // flags
	offset += 2;
	view.setUint16(offset, 0, true); // compression (store)
	offset += 2;
	view.setUint16(offset, 0, true); // mod time
	offset += 2;
	view.setUint16(offset, 0, true); // mod date
	offset += 2;

	// CRC-32 (for stored data, we compute a simple CRC)
	const crc = crc32(fileContent);
	view.setUint32(offset, crc, true);
	offset += 4;
	view.setUint32(offset, fileContent.length, true); // compressed size
	offset += 4;
	view.setUint32(offset, fileContent.length, true); // uncompressed size
	offset += 4;
	view.setUint16(offset, fileNameBytes.length, true); // name length
	offset += 2;
	view.setUint16(offset, 0, true); // extra field length
	offset += 2;

	bytes.set(fileNameBytes, offset);
	offset += fileNameBytes.length;
	bytes.set(fileContent, offset);
	offset += fileContent.length;

	const centralDirOffset = offset;

	// --- Central directory entry ---
	view.setUint32(offset, 0x02014b50, true); // signature
	offset += 4;
	view.setUint16(offset, 20, true); // version made by
	offset += 2;
	view.setUint16(offset, 20, true); // version needed
	offset += 2;
	view.setUint16(offset, 0, true); // flags
	offset += 2;
	view.setUint16(offset, 0, true); // compression
	offset += 2;
	view.setUint16(offset, 0, true); // mod time
	offset += 2;
	view.setUint16(offset, 0, true); // mod date
	offset += 2;
	view.setUint32(offset, crc, true); // CRC-32
	offset += 4;
	view.setUint32(offset, fileContent.length, true); // compressed size
	offset += 4;
	view.setUint32(offset, fileContent.length, true); // uncompressed size
	offset += 4;
	view.setUint16(offset, fileNameBytes.length, true); // name length
	offset += 2;
	view.setUint16(offset, 0, true); // extra field length
	offset += 2;
	view.setUint16(offset, 0, true); // comment length
	offset += 2;
	view.setUint16(offset, 0, true); // disk number start
	offset += 2;
	view.setUint16(offset, 0, true); // internal attributes
	offset += 2;
	view.setUint32(offset, 0, true); // external attributes
	offset += 4;
	view.setUint32(offset, 0, true); // local header offset
	offset += 4;
	bytes.set(fileNameBytes, offset);
	offset += fileNameBytes.length;

	// --- End of central directory record ---
	view.setUint32(offset, 0x06054b50, true); // signature
	offset += 4;
	view.setUint16(offset, 0, true); // disk number
	offset += 2;
	view.setUint16(offset, 0, true); // disk with CD start
	offset += 2;
	view.setUint16(offset, 1, true); // entries on this disk
	offset += 2;
	view.setUint16(offset, 1, true); // total entries
	offset += 2;
	view.setUint32(offset, centralDirEntrySize, true); // CD size
	offset += 4;
	view.setUint32(offset, centralDirOffset, true); // CD offset
	offset += 4;
	view.setUint16(offset, 0, true); // comment length
	offset += 2;

	return buf;
}

/** Simple CRC-32 for test ZIP creation. */
function crc32(data: Uint8Array): number {
	let crc = 0xffffffff;
	for (let i = 0; i < data.length; i++) {
		crc ^= data[i]!;
		for (let j = 0; j < 8; j++) {
			crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
		}
	}
	return (crc ^ 0xffffffff) >>> 0;
}

// ---------------------------------------------------------------------------
// base64Decode / base64Encode
// ---------------------------------------------------------------------------

describe('base64Decode', () => {
	it('decodes an empty string to an empty array', () => {
		const result = base64Decode('');
		expect(result).toHaveLength(0);
	});

	it('decodes a known base64 string', () => {
		// "SGVsbG8=" = "Hello"
		const result = base64Decode('SGVsbG8=');
		expect(result).toStrictEqual(new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]));
	});

	it('round-trips with base64Encode', () => {
		const original = new Uint8Array([0x00, 0x01, 0x02, 0xff, 0xfe, 0x80]);
		const encoded = base64Encode(original);
		const decoded = base64Decode(encoded);
		expect(decoded).toStrictEqual(original);
	});
});

describe('base64Encode', () => {
	it('encodes an empty array to an empty string', () => {
		const result = base64Encode(new Uint8Array(0));
		expect(result).toBe('');
	});

	it('encodes binary data correctly', () => {
		// "Hello" -> "SGVsbG8="
		const result = base64Encode(new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]));
		expect(result).toBe('SGVsbG8=');
	});
});

// ---------------------------------------------------------------------------
// encodePasswordUtf16LE
// ---------------------------------------------------------------------------

describe('encodePasswordUtf16LE', () => {
	it('encodes an empty string to an empty array', () => {
		const result = encodePasswordUtf16LE('');
		expect(result).toHaveLength(0);
	});

	it('encodes ASCII characters in UTF-16LE', () => {
		// "A" = 0x41 -> [0x41, 0x00]
		const result = encodePasswordUtf16LE('A');
		expect(result).toStrictEqual(new Uint8Array([0x41, 0x00]));
	});

	it('encodes multi-character ASCII string', () => {
		// "AB" -> [0x41, 0x00, 0x42, 0x00]
		const result = encodePasswordUtf16LE('AB');
		expect(result).toStrictEqual(new Uint8Array([0x41, 0x00, 0x42, 0x00]));
	});

	it('encodes unicode characters correctly', () => {
		// Euro sign \u20AC -> [0xAC, 0x20]
		const result = encodePasswordUtf16LE('\u20AC');
		expect(result).toStrictEqual(new Uint8Array([0xac, 0x20]));
	});

	it('handles password with mixed ASCII and unicode', () => {
		const result = encodePasswordUtf16LE('p\u00E4ss');
		expect(result).toHaveLength(8); // 4 chars * 2 bytes each
		// 'p' = [0x70, 0x00], 'a-umlaut' = [0xE4, 0x00], 's' = [0x73, 0x00], 's' = [0x73, 0x00]
		expect(result[0]).toBe(0x70);
		expect(result[1]).toBe(0x00);
		expect(result[2]).toBe(0xe4);
		expect(result[3]).toBe(0x00);
	});
});

// ---------------------------------------------------------------------------
// concatArrays
// ---------------------------------------------------------------------------

describe('concatArrays', () => {
	it('concatenates two arrays', () => {
		const a = new Uint8Array([1, 2, 3]);
		const b = new Uint8Array([4, 5]);
		const result = concatArrays(a, b);
		expect(result).toStrictEqual(new Uint8Array([1, 2, 3, 4, 5]));
	});

	it('handles empty arrays', () => {
		const a = new Uint8Array([1, 2]);
		const empty = new Uint8Array(0);
		expect(concatArrays(a, empty)).toStrictEqual(new Uint8Array([1, 2]));
		expect(concatArrays(empty, a)).toStrictEqual(new Uint8Array([1, 2]));
		expect(concatArrays(empty, empty)).toStrictEqual(new Uint8Array(0));
	});

	it('concatenates three or more arrays', () => {
		const result = concatArrays(new Uint8Array([1]), new Uint8Array([2]), new Uint8Array([3]));
		expect(result).toStrictEqual(new Uint8Array([1, 2, 3]));
	});
});

// ---------------------------------------------------------------------------
// parseEncryptionInfo
// ---------------------------------------------------------------------------

describe('parseEncryptionInfo', () => {
	it('throws for unsupported encryption version', () => {
		// Version 1.1 (unsupported)
		const data = new Uint8Array(12);
		const view = new DataView(data.buffer);
		view.setUint16(0, 1, true); // major = 1
		view.setUint16(2, 1, true); // minor = 1
		expect(() => parseEncryptionInfo(data)).toThrow(/Unsupported encryption version/u);
	});

	it('parses standard encryption info (version 2.2)', () => {
		const info = buildStandardEncryptionInfoBytes(2, 2);
		const parsed = parseEncryptionInfo(info);
		expect('isStandard' in parsed && parsed.isStandard).toBeTruthy();
		expect(parsed.isAgile).toBeFalsy();
		expect(parsed.version.major).toBe(2);
		expect(parsed.version.minor).toBe(2);
	});

	it('parses standard encryption info (version 3.2)', () => {
		const info = buildStandardEncryptionInfoBytes(3, 2);
		const parsed = parseEncryptionInfo(info);
		expect('isStandard' in parsed && parsed.isStandard).toBeTruthy();
		expect(parsed.version.major).toBe(3);
	});

	it('parses standard encryption info (version 4.2)', () => {
		const info = buildStandardEncryptionInfoBytes(4, 2);
		const parsed = parseEncryptionInfo(info);
		expect('isStandard' in parsed && parsed.isStandard).toBeTruthy();
		expect(parsed.version.major).toBe(4);
	});

	it('parses agile encryption info (version 4.4)', () => {
		const info = buildAgileEncryptionInfoBytes();
		const parsed = parseEncryptionInfo(info);
		expect(parsed.isAgile).toBeTruthy();
		expect(parsed.version.major).toBe(4);
		expect(parsed.version.minor).toBe(4);
	});

	it('parses agile encryption info keyData attributes', () => {
		const info = buildAgileEncryptionInfoBytes();
		const parsed = parseEncryptionInfo(info) as EncryptionInfo;
		expect(parsed.keyData.saltSize).toBe(16);
		expect(parsed.keyData.blockSize).toBe(16);
		expect(parsed.keyData.keyBits).toBe(256);
		expect(parsed.keyData.hashSize).toBe(64);
		expect(parsed.keyData.cipherAlgorithm).toBe('AES');
		expect(parsed.keyData.hashAlgorithm).toBe('SHA-512');
	});

	it('parses agile encryption info passwordKeyEncryptor', () => {
		const info = buildAgileEncryptionInfoBytes();
		const parsed = parseEncryptionInfo(info) as EncryptionInfo;
		expect(parsed.passwordKeyEncryptor.spinCount).toBe(100000);
		expect(parsed.passwordKeyEncryptor.keyBits).toBe(256);
		expect(parsed.passwordKeyEncryptor.saltValue.length).toBeGreaterThan(0);
		expect(parsed.passwordKeyEncryptor.encryptedVerifierHashInput.length).toBeGreaterThan(0);
		expect(parsed.passwordKeyEncryptor.encryptedVerifierHashValue.length).toBeGreaterThan(0);
		expect(parsed.passwordKeyEncryptor.encryptedKeyValue.length).toBeGreaterThan(0);
	});

	it('parses standard encryption verifier fields', () => {
		const info = buildStandardEncryptionInfoBytes(4, 2);
		const parsed = parseEncryptionInfo(info) as StandardEncryptionInfo;
		expect(parsed.verifier.saltSize).toBe(16);
		expect(parsed.verifier.salt).toHaveLength(16);
		expect(parsed.verifier.encryptedVerifier).toHaveLength(16);
		expect(parsed.verifier.encryptedVerifierHash).toHaveLength(32);
	});

	it('parses standard encryption header fields', () => {
		const info = buildStandardEncryptionInfoBytes(4, 2);
		const parsed = parseEncryptionInfo(info) as StandardEncryptionInfo;
		expect(parsed.header.keySize).toBe(128);
		expect(parsed.header.algId).toBe(0x6601); // AES-128
	});
});

// ---------------------------------------------------------------------------
// IncorrectPasswordError
// ---------------------------------------------------------------------------

describe('incorrectPasswordError', () => {
	it('has correct name', () => {
		const err = new IncorrectPasswordError();
		expect(err.name).toBe('IncorrectPasswordError');
	});

	it('has default message', () => {
		const err = new IncorrectPasswordError();
		expect(err.message).toBe('The password is incorrect.');
	});

	it('accepts custom message', () => {
		const err = new IncorrectPasswordError('Custom message');
		expect(err.message).toBe('Custom message');
	});

	it('is instanceof Error', () => {
		const err = new IncorrectPasswordError();
		expect(err).toBeInstanceOf(Error);
	});
});

// ---------------------------------------------------------------------------
// Round-trip: encryptPptx -> decryptPptx
// ---------------------------------------------------------------------------

describe('encryptPptx / decryptPptx round-trip', () => {
	it('decrypts the password-protected PowerPoint fixture', async () => {
		const fixture = await readFile(
			new URL(
				'../../../../../e2e/fixtures/Password_Protected_123_8_Slides_2_3_MB_927e34cd0c.pptx',
				import.meta.url,
			),
		);
		const encrypted = fixture.buffer.slice(
			fixture.byteOffset,
			fixture.byteOffset + fixture.byteLength,
		) as ArrayBuffer;

		const decrypted = await decryptPptx(encrypted, '123');

		expect(new Uint8Array(decrypted).subarray(0, 4)).toStrictEqual(
			new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
		);
	}, 30_000);
	it('encrypts and decrypts a buffer with the correct password', async () => {
		const originalData = createMinimalZipBuffer();
		const password = 'test-password-123';

		const encrypted = await encryptPptx(originalData, password, { spinCount: TEST_SPIN_COUNT });

		// Encrypted output should be an OLE2 container
		const encBytes = new Uint8Array(encrypted);
		expect(encBytes[0]).toBe(0xd0);
		expect(encBytes[1]).toBe(0xcf);
		expect(encBytes[2]).toBe(0x11);
		expect(encBytes[3]).toBe(0xe0);

		const decrypted = await decryptPptx(encrypted, password);

		// The decrypted data should match the original
		const original = new Uint8Array(originalData);
		const result = new Uint8Array(decrypted);
		expect(result).toHaveLength(original.length);
		expect(result).toStrictEqual(original);
	});

	it('encrypts and decrypts with AES-128', async () => {
		const originalData = createMinimalZipBuffer();
		const password = 'aes128-test';

		const encrypted = await encryptPptx(originalData, password, {
			algorithm: 'AES128',
			spinCount: TEST_SPIN_COUNT,
		});
		const decrypted = await decryptPptx(encrypted, password);

		const original = new Uint8Array(originalData);
		const result = new Uint8Array(decrypted);
		expect(result).toStrictEqual(original);
	});

	it('encrypts and decrypts with AES-256 (default)', async () => {
		const originalData = createMinimalZipBuffer();
		const password = 'aes256-test';

		const encrypted = await encryptPptx(originalData, password, {
			algorithm: 'AES256',
			spinCount: TEST_SPIN_COUNT,
		});
		const decrypted = await decryptPptx(encrypted, password);

		const original = new Uint8Array(originalData);
		const result = new Uint8Array(decrypted);
		expect(result).toStrictEqual(original);
	});

	it('throws IncorrectPasswordError for wrong password on decrypt', async () => {
		const originalData = createMinimalZipBuffer();
		const encrypted = await encryptPptx(originalData, 'correct-password', {
			spinCount: TEST_SPIN_COUNT,
		});

		await expect(decryptPptx(encrypted, 'wrong-password')).rejects.toThrow(IncorrectPasswordError);
	});

	it('handles empty password', async () => {
		const originalData = createMinimalZipBuffer();
		const password = '';

		const encrypted = await encryptPptx(originalData, password, { spinCount: TEST_SPIN_COUNT });
		const decrypted = await decryptPptx(encrypted, password);

		const original = new Uint8Array(originalData);
		const result = new Uint8Array(decrypted);
		expect(result).toStrictEqual(original);
	});

	it('handles unicode password', async () => {
		const originalData = createMinimalZipBuffer();
		const password = '\u00E9\u00E0\u00FC\u4E16\u754C';

		const encrypted = await encryptPptx(originalData, password, { spinCount: TEST_SPIN_COUNT });
		const decrypted = await decryptPptx(encrypted, password);

		const original = new Uint8Array(originalData);
		const result = new Uint8Array(decrypted);
		expect(result).toStrictEqual(original);
	});
});

// ---------------------------------------------------------------------------
// verifyPassword
// ---------------------------------------------------------------------------

describe('verifyPassword', () => {
	it('returns true for the correct password', async () => {
		const originalData = createMinimalZipBuffer();
		const password = 'verify-me';
		const encrypted = await encryptPptx(originalData, password, { spinCount: TEST_SPIN_COUNT });

		const result = await verifyPassword(encrypted, password);
		expect(result).toBeTruthy();
	});

	it('returns false for the wrong password', async () => {
		const originalData = createMinimalZipBuffer();
		const encrypted = await encryptPptx(originalData, 'correct', { spinCount: TEST_SPIN_COUNT });

		const result = await verifyPassword(encrypted, 'incorrect');
		expect(result).toBeFalsy();
	});

	it('returns false for a non-OLE2 buffer', async () => {
		const randomData = new ArrayBuffer(100);
		const result = await verifyPassword(randomData, 'password');
		expect(result).toBeFalsy();
	});

	it('returns false when EncryptionInfo stream is missing', async () => {
		// Build an OLE2 container without EncryptionInfo
		const streams = new Map<string, Uint8Array>();
		streams.set('SomeOtherStream', new Uint8Array([1, 2, 3, 4]));
		const ole2Buf = buildOle2(streams);

		const result = await verifyPassword(ole2Buf, 'password');
		expect(result).toBeFalsy();
	});
});

// ---------------------------------------------------------------------------
// decryptPptx error cases
// ---------------------------------------------------------------------------

describe('decryptPptx error handling', () => {
	it('throws when EncryptionInfo stream is missing', async () => {
		// Build an OLE2 without EncryptionInfo
		const streams = new Map<string, Uint8Array>();
		streams.set('EncryptedPackage', new Uint8Array(100));
		const ole2Buf = buildOle2(streams);

		await expect(decryptPptx(ole2Buf, 'password')).rejects.toThrow(
			/EncryptionInfo stream not found/u,
		);
	});

	it('throws when EncryptedPackage stream is missing', async () => {
		// Build an OLE2 with EncryptionInfo but no EncryptedPackage
		const encInfoBytes = buildAgileEncryptionInfoBytes();
		const streams = new Map<string, Uint8Array>();
		streams.set('EncryptionInfo', encInfoBytes);
		const ole2Buf = buildOle2(streams);

		await expect(decryptPptx(ole2Buf, 'password')).rejects.toThrow(
			/EncryptedPackage stream not found/u,
		);
	});

	it('throws for non-OLE2 data', async () => {
		const notOle2 = new ArrayBuffer(100);
		await expect(decryptPptx(notOle2, 'password')).rejects.toThrow();
	});
});

// ---------------------------------------------------------------------------
// OLE2 round-trip (through encrypt)
// ---------------------------------------------------------------------------

describe('oLE2 container integration', () => {
	it('encrypted file contains EncryptionInfo and EncryptedPackage streams', async () => {
		const originalData = createMinimalZipBuffer();
		const encrypted = await encryptPptx(originalData, 'test123', { spinCount: TEST_SPIN_COUNT });

		const ole2 = parseOle2(encrypted);
		const encInfo = ole2.getStream('EncryptionInfo');
		const encPkg = ole2.getStream('EncryptedPackage');

		expect(encInfo).toBeDefined();
		expect(encPkg).toBeDefined();
		expect(encInfo!.length).toBeGreaterThan(0);
		expect(encPkg!.length).toBeGreaterThan(0);
	});

	it('encryptionInfo stream starts with version 4.4 (agile)', async () => {
		const originalData = createMinimalZipBuffer();
		const encrypted = await encryptPptx(originalData, 'test', { spinCount: TEST_SPIN_COUNT });

		const ole2 = parseOle2(encrypted);
		const encInfo = ole2.getStream('EncryptionInfo')!;
		const view = new DataView(encInfo.buffer, encInfo.byteOffset, encInfo.byteLength);
		const major = view.getUint16(0, true);
		const minor = view.getUint16(2, true);

		expect(major).toBe(4);
		expect(minor).toBe(4);
	});

	it('orders directory entries so a CFB tree walk finds both streams', async () => {
		// PowerPoint locates EncryptionInfo / EncryptedPackage via a binary
		// search over the compound-file directory tree, not a linear scan.
		// Walk the tree the same way and confirm both streams are reachable —
		// this is what fails when the directory is emitted unsorted.
		const originalData = createMinimalZipBuffer();
		const encrypted = await encryptPptx(originalData, 'tree-walk', { spinCount: TEST_SPIN_COUNT });

		const view = new DataView(encrypted);
		const sectorSize = 1 << view.getUint16(0x1e, true);
		const firstDirSector = view.getUint32(0x30, true);
		const dirBase = (firstDirSector + 1) * sectorSize;

		// Read directory entries indexed by slot.
		const entries: Array<{
			name: string;
			type: number;
			left: number;
			right: number;
			child: number;
		}> = [];
		for (let off = dirBase; off + 128 <= encrypted.byteLength; off += 128) {
			const nameLen = view.getUint16(off + 64, true);
			const type = view.getUint8(off + 66);
			if (type === 0) {
				break; // first empty entry ends the used directory
			}
			let name = '';
			for (let j = 0; j < Math.max(0, nameLen - 2) / 2; j++) {
				name += String.fromCharCode(view.getUint16(off + j * 2, true));
			}
			entries.push({
				name,
				type,
				left: view.getUint32(off + 68, true),
				right: view.getUint32(off + 72, true),
				child: view.getUint32(off + 76, true),
			});
		}

		const cfbCompare = (a: string, b: string): number => {
			if (a.length !== b.length) {
				return a.length - b.length;
			}
			const ua = a.toUpperCase();
			const ub = b.toUpperCase();
			for (let i = 0; i < ua.length; i++) {
				const diff = ua.charCodeAt(i) - ub.charCodeAt(i);
				if (diff !== 0) {
					return diff;
				}
			}
			return 0;
		};

		const findViaTree = (target: string): boolean => {
			const root = entries.find((e) => e.type === 5);
			let id = root ? root.child : 0xffffffff;
			while (id !== 0xffffffff && id < entries.length) {
				const node = entries[id]!;
				const cmp = cfbCompare(target, node.name);
				if (cmp === 0) {
					return true;
				}
				id = cmp < 0 ? node.left : node.right;
			}
			return false;
		};

		expect(findViaTree('EncryptionInfo')).toBeTruthy();
		expect(findViaTree('EncryptedPackage')).toBeTruthy();
	});

	it('encryptedPackage stream starts with 8-byte size prefix', async () => {
		const originalData = createMinimalZipBuffer();
		const encrypted = await encryptPptx(originalData, 'test', { spinCount: TEST_SPIN_COUNT });

		const ole2 = parseOle2(encrypted);
		const encPkg = ole2.getStream('EncryptedPackage')!;
		const view = new DataView(encPkg.buffer, encPkg.byteOffset, 8);
		const sizeLow = view.getUint32(0, true);
		// The stored size should match the original data length
		expect(sizeLow).toBe(originalData.byteLength);
	});
});

// ---------------------------------------------------------------------------
// Large data handling
// ---------------------------------------------------------------------------

describe('large data encryption', () => {
	it('handles data larger than one AES-CBC segment (4096 bytes)', async () => {
		// Create a ~10KB buffer to span multiple segments
		const largeBuffer = new ArrayBuffer(10240);
		const largeView = new Uint8Array(largeBuffer);
		// Fill with recognizable pattern
		for (let i = 0; i < largeView.length; i++) {
			largeView[i] = i % 256;
		}

		const password = 'large-data-test';
		const encrypted = await encryptPptx(largeBuffer, password, { spinCount: TEST_SPIN_COUNT });
		const decrypted = await decryptPptx(encrypted, password);

		const result = new Uint8Array(decrypted);
		expect(result).toHaveLength(largeView.length);
		expect(result).toStrictEqual(largeView);
	});
});

// ---------------------------------------------------------------------------
// Helpers for building test EncryptionInfo bytes
// ---------------------------------------------------------------------------

/**
 * Build a minimal standard encryption info byte stream for testing.
 */
function buildStandardEncryptionInfoBytes(major: number, minor: number): Uint8Array {
	// Standard encryption info layout:
	// [0..1] versionMajor (uint16 LE)
	// [2..3] versionMinor (uint16 LE)
	// [4..7] flags (uint32 LE)
	// [8..11] headerSize (uint32 LE)
	// [12..12+headerSize-1] Encryption Header
	// [12+headerSize..] Encryption Verifier

	const cspName = 'Microsoft Enhanced RSA and AES Cryptographic Provider';
	const cspNameBytes = new Uint8Array((cspName.length + 1) * 2);
	for (let i = 0; i < cspName.length; i++) {
		cspNameBytes[i * 2] = cspName.charCodeAt(i) & 0xff;
		cspNameBytes[i * 2 + 1] = (cspName.charCodeAt(i) >> 8) & 0xff;
	}

	const headerFixedSize = 32;
	const headerSize = headerFixedSize + cspNameBytes.length;
	const verifierSize = 4 + 16 + 16 + 4 + 32; // saltSize + salt + encVerifier + hashSize + encHash

	const totalSize = 12 + headerSize + verifierSize;
	const data = new Uint8Array(totalSize);
	const view = new DataView(data.buffer);

	// Version
	view.setUint16(0, major, true);
	view.setUint16(2, minor, true);

	// Flags
	view.setUint32(4, 0x24, true); // fCryptoAPI | fAES

	// Header size
	view.setUint32(8, headerSize, true);

	// Encryption Header (at offset 12)
	const h = 12;
	view.setUint32(h, 0x24, true); // flags
	view.setUint32(h + 4, 0, true); // sizeExtra
	view.setUint32(h + 8, 0x6601, true); // algId (AES-128)
	view.setUint32(h + 12, 0x8004, true); // algIdHash (SHA-1)
	view.setUint32(h + 16, 128, true); // keySize
	view.setUint32(h + 20, 0x18, true); // providerType
	view.setUint32(h + 24, 0, true); // reserved1
	view.setUint32(h + 28, 0, true); // reserved2
	// CSP name
	data.set(cspNameBytes, h + 32);

	// Encryption Verifier (at offset 12 + headerSize)
	const v = 12 + headerSize;
	view.setUint32(v, 16, true); // saltSize
	// salt (16 bytes of 0x42)
	for (let i = 0; i < 16; i++) {
		data[v + 4 + i] = 0x42;
	}
	// encryptedVerifier (16 bytes of 0xAB)
	for (let i = 0; i < 16; i++) {
		data[v + 20 + i] = 0xab;
	}
	// verifierHashSize
	view.setUint32(v + 36, 20, true); // SHA-1 = 20 bytes
	// encryptedVerifierHash (32 bytes of 0xCD)
	for (let i = 0; i < 32; i++) {
		data[v + 40 + i] = 0xcd;
	}

	return data;
}

/**
 * Build a minimal agile encryption info byte stream for testing.
 */
function buildAgileEncryptionInfoBytes(): Uint8Array {
	const saltBase64 = base64Encode(new Uint8Array(16).fill(0x42));
	const verifierInputBase64 = base64Encode(new Uint8Array(16).fill(0xaa));
	const verifierHashBase64 = base64Encode(new Uint8Array(64).fill(0xbb));
	const keyValueBase64 = base64Encode(new Uint8Array(32).fill(0xcc));
	const hmacKeyBase64 = base64Encode(new Uint8Array(64).fill(0xdd));
	const hmacValueBase64 = base64Encode(new Uint8Array(64).fill(0xee));

	const xml =
		`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
		`\r\n<encryption xmlns="http://schemas.microsoft.com/office/2006/encryption" ` +
		`xmlns:p="http://schemas.microsoft.com/office/2006/keyEncryptor/password">` +
		`<keyData saltSize="16" blockSize="16" keyBits="256" hashSize="64" ` +
		`cipherAlgorithm="AES" cipherChaining="ChainingModeCBC" ` +
		`hashAlgorithm="SHA-512" saltValue="${saltBase64}"/>` +
		`<dataIntegrity encryptedHmacKey="${hmacKeyBase64}" ` +
		`encryptedHmacValue="${hmacValueBase64}"/>` +
		`<keyEncryptors>` +
		`<keyEncryptor uri="http://schemas.microsoft.com/office/2006/keyEncryptor/password">` +
		`<p:encryptedKey spinCount="100000" saltSize="16" blockSize="16" ` +
		`keyBits="256" hashSize="64" cipherAlgorithm="AES" ` +
		`cipherChaining="ChainingModeCBC" hashAlgorithm="SHA-512" ` +
		`saltValue="${saltBase64}" ` +
		`encryptedVerifierHashInput="${verifierInputBase64}" ` +
		`encryptedVerifierHashValue="${verifierHashBase64}" ` +
		`encryptedKeyValue="${keyValueBase64}"/>` +
		`</keyEncryptor></keyEncryptors></encryption>`;

	const xmlBytes = new TextEncoder().encode(xml);
	const result = new Uint8Array(8 + xmlBytes.length);
	const view = new DataView(result.buffer);

	// Version 4.4
	view.setUint16(0, 4, true);
	view.setUint16(2, 4, true);
	// Reserved (0x00000040 for agile)
	view.setUint32(4, 0x00000040, true);

	result.set(xmlBytes, 8);
	return result;
}

// ---------------------------------------------------------------------------
// DataIntegrityError
// ---------------------------------------------------------------------------

describe('dataIntegrityError', () => {
	it('has correct name', () => {
		const err = new DataIntegrityError();
		expect(err.name).toBe('DataIntegrityError');
	});

	it('has default message', () => {
		const err = new DataIntegrityError();
		expect(err.message).toContain('Data integrity check failed');
	});

	it('accepts custom message', () => {
		const err = new DataIntegrityError('Custom integrity error');
		expect(err.message).toBe('Custom integrity error');
	});

	it('is instanceof Error', () => {
		const err = new DataIntegrityError();
		expect(err).toBeInstanceOf(Error);
	});
});

// ---------------------------------------------------------------------------
// Key derivation
// ---------------------------------------------------------------------------

describe('deriveAgileKey', () => {
	it('produces a key of the requested bit length (128-bit)', async () => {
		const salt = new Uint8Array(16).fill(0x01);
		const blockKey = new Uint8Array([0x14, 0x6e, 0x0b, 0xe7, 0xab, 0xac, 0xd0, 0xd6]);
		const key = await deriveAgileKey(
			'password',
			salt,
			1, // low spinCount for speed
			'SHA-512',
			blockKey,
			128,
			64,
		);
		expect(key).toHaveLength(16); // 128 / 8
	});

	it('produces a key of the requested bit length (256-bit)', async () => {
		const salt = new Uint8Array(16).fill(0x01);
		const blockKey = new Uint8Array([0x14, 0x6e, 0x0b, 0xe7, 0xab, 0xac, 0xd0, 0xd6]);
		const key = await deriveAgileKey('password', salt, 1, 'SHA-512', blockKey, 256, 64);
		expect(key).toHaveLength(32); // 256 / 8
	});

	it('produces deterministic output for the same inputs', async () => {
		const salt = new Uint8Array(16).fill(0xab);
		const blockKey = new Uint8Array([0xfe, 0xa7, 0xd2, 0x76, 0x3b, 0x4b, 0x9e, 0x79]);
		const key1 = await deriveAgileKey('test', salt, 2, 'SHA-512', blockKey, 256, 64);
		const key2 = await deriveAgileKey('test', salt, 2, 'SHA-512', blockKey, 256, 64);
		expect(key1).toStrictEqual(key2);
	});

	it('produces different keys for different passwords', async () => {
		const salt = new Uint8Array(16).fill(0xab);
		const blockKey = new Uint8Array([0xfe, 0xa7, 0xd2, 0x76, 0x3b, 0x4b, 0x9e, 0x79]);
		const key1 = await deriveAgileKey('password1', salt, 2, 'SHA-512', blockKey, 256, 64);
		const key2 = await deriveAgileKey('password2', salt, 2, 'SHA-512', blockKey, 256, 64);
		expect(key1).not.toStrictEqual(key2);
	});

	it('produces different keys for different salts', async () => {
		const salt1 = new Uint8Array(16).fill(0x01);
		const salt2 = new Uint8Array(16).fill(0x02);
		const blockKey = new Uint8Array([0xfe, 0xa7, 0xd2, 0x76, 0x3b, 0x4b, 0x9e, 0x79]);
		const key1 = await deriveAgileKey('test', salt1, 2, 'SHA-512', blockKey, 256, 64);
		const key2 = await deriveAgileKey('test', salt2, 2, 'SHA-512', blockKey, 256, 64);
		expect(key1).not.toStrictEqual(key2);
	});

	it('produces different keys for different block keys', async () => {
		const salt = new Uint8Array(16).fill(0xab);
		const blockKey1 = new Uint8Array([0xfe, 0xa7, 0xd2, 0x76, 0x3b, 0x4b, 0x9e, 0x79]);
		const blockKey2 = new Uint8Array([0xd7, 0xaa, 0x0f, 0x6d, 0x30, 0x61, 0x34, 0x4e]);
		const key1 = await deriveAgileKey('test', salt, 2, 'SHA-512', blockKey1, 256, 64);
		const key2 = await deriveAgileKey('test', salt, 2, 'SHA-512', blockKey2, 256, 64);
		expect(key1).not.toStrictEqual(key2);
	});

	it('produces different keys for different spinCounts', async () => {
		const salt = new Uint8Array(16).fill(0xab);
		const blockKey = new Uint8Array([0xfe, 0xa7, 0xd2, 0x76, 0x3b, 0x4b, 0x9e, 0x79]);
		const key1 = await deriveAgileKey('test', salt, 1, 'SHA-512', blockKey, 256, 64);
		const key2 = await deriveAgileKey('test', salt, 2, 'SHA-512', blockKey, 256, 64);
		expect(key1).not.toStrictEqual(key2);
	});

	it('verifies key derivation with known SHA-512 test vector', async () => {
		// Known inputs and expected behavior:
		// With spinCount=0 the derived key is H(salt + password) then H(h + blockKey) truncated to keyBits/8
		// H0 = SHA-512(salt + password_utf16le)
		// Hfinal = SHA-512(H0 + blockKey)
		// key = Hfinal[0..keyBits/8-1]
		const salt = new Uint8Array(16).fill(0x00);
		const blockKey = new Uint8Array(8).fill(0x00);

		// Compute expected result manually:
		// password "A" -> UTF-16LE: [0x41, 0x00]
		// H0 = SHA-512(salt(16 bytes of 0x00) + [0x41, 0x00])
		// Hfinal = SHA-512(H0 + blockKey(8 bytes of 0x00))
		// key = Hfinal[0..15] (128 bits)
		const passwordBytes = new Uint8Array([0x41, 0x00]);
		const saltPlusPassword = new Uint8Array(18);
		saltPlusPassword.set(salt);
		saltPlusPassword.set(passwordBytes, 16);
		const h0 = await cryptoHash('SHA-512', saltPlusPassword);

		const h0PlusBlockKey = new Uint8Array(h0.length + 8);
		h0PlusBlockKey.set(h0);
		// blockKey is all zeros, already 0
		const hFinal = await cryptoHash('SHA-512', h0PlusBlockKey);

		const expected = hFinal.subarray(0, 16);

		const derived = await deriveAgileKey('A', salt, 0, 'SHA-512', blockKey, 128, 64);
		expect(derived).toStrictEqual(expected);
	});

	it('handles SHA-256 hash algorithm', async () => {
		const salt = new Uint8Array(16).fill(0x01);
		const blockKey = new Uint8Array([0x14, 0x6e, 0x0b, 0xe7, 0xab, 0xac, 0xd0, 0xd6]);
		const key = await deriveAgileKey('password', salt, 1, 'SHA-256', blockKey, 128, 32);
		expect(key).toHaveLength(16); // 128 / 8
		// Verify it's non-zero and deterministic
		const key2 = await deriveAgileKey('password', salt, 1, 'SHA-256', blockKey, 128, 32);
		expect(key).toStrictEqual(key2);
	});
});

// ---------------------------------------------------------------------------
// Data integrity verification (tamper detection)
// ---------------------------------------------------------------------------

describe('data integrity verification', () => {
	it('detects tampered EncryptedPackage data', async () => {
		const originalData = createMinimalZipBuffer();
		const password = 'integrity-test';

		const encrypted = await encryptPptx(originalData, password, { spinCount: TEST_SPIN_COUNT });

		// Tamper with the encrypted package data inside the OLE2 container
		const ole2 = parseOle2(encrypted);
		const encPkg = ole2.getStream('EncryptedPackage')!;
		const encInfo = ole2.getStream('EncryptionInfo')!;

		// Flip a byte in the encrypted package data (after the 8-byte size header)
		const tamperedPkg = new Uint8Array(encPkg);
		if (tamperedPkg.length > 16) {
			tamperedPkg[16] ^= 0xff;
		}

		// Rebuild the OLE2 container with tampered data
		const tamperedStreams = new Map<string, Uint8Array>();
		tamperedStreams.set('EncryptionInfo', encInfo);
		tamperedStreams.set('EncryptedPackage', tamperedPkg);
		const tamperedOle2 = buildOle2(tamperedStreams);

		// Decrypting should throw DataIntegrityError
		await expect(decryptPptx(tamperedOle2, password)).rejects.toThrow(DataIntegrityError);
	});

	it('does not throw for untampered data', async () => {
		const originalData = createMinimalZipBuffer();
		const password = 'no-tamper';

		const encrypted = await encryptPptx(originalData, password, { spinCount: TEST_SPIN_COUNT });
		// Should not throw
		const decrypted = await decryptPptx(encrypted, password);
		expect(new Uint8Array(decrypted)).toStrictEqual(new Uint8Array(originalData));
	});
});

// ---------------------------------------------------------------------------
// OLE2 round-trip (parsing and building)
// ---------------------------------------------------------------------------

describe('oLE2 container round-trip', () => {
	it('round-trips a simple stream through buildOle2 and parseOle2', () => {
		const testData = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
		const streams = new Map<string, Uint8Array>();
		streams.set('TestStream', testData);

		const ole2Buf = buildOle2(streams);
		const parsed = parseOle2(ole2Buf);
		const extracted = parsed.getStream('TestStream');

		expect(extracted).toBeDefined();
		expect(extracted!).toHaveLength(testData.length);
		expect(new Uint8Array(extracted!)).toStrictEqual(testData);
	});

	it('round-trips multiple streams', () => {
		const stream1 = new Uint8Array([0xaa, 0xbb, 0xcc]);
		const stream2 = new Uint8Array([0xdd, 0xee, 0xff]);
		const streams = new Map<string, Uint8Array>();
		streams.set('First', stream1);
		streams.set('Second', stream2);

		const ole2Buf = buildOle2(streams);
		const parsed = parseOle2(ole2Buf);

		const extracted1 = parsed.getStream('First');
		const extracted2 = parsed.getStream('Second');

		expect(extracted1).toBeDefined();
		expect(extracted2).toBeDefined();
		expect(new Uint8Array(extracted1!)).toStrictEqual(stream1);
		expect(new Uint8Array(extracted2!)).toStrictEqual(stream2);
	});

	it('round-trips a large stream (> 4096 bytes, mini stream cutoff)', () => {
		const largeData = new Uint8Array(8192);
		for (let i = 0; i < largeData.length; i++) {
			largeData[i] = i % 256;
		}
		const streams = new Map<string, Uint8Array>();
		streams.set('LargeStream', largeData);

		const ole2Buf = buildOle2(streams);
		const parsed = parseOle2(ole2Buf);
		const extracted = parsed.getStream('LargeStream');

		expect(extracted).toBeDefined();
		expect(extracted!).toHaveLength(largeData.length);
		expect(new Uint8Array(extracted!)).toStrictEqual(largeData);
	});

	it('rejects non-OLE2 data with Ole2ParseError', () => {
		const notOle2 = new ArrayBuffer(100);
		expect(() => parseOle2(notOle2)).toThrow(Ole2ParseError);
	});
});
