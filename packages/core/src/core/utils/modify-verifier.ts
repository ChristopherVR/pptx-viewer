/**
 * Write-protection (modify verifier) password verification.
 *
 * PowerPoint's "read-only recommended" / "modify password" feature stores
 * a password hash in `p:modifyVerifier` within `presentation.xml`. This
 * module implements the hash verification algorithm from ECMA-376:
 *
 *   H0 = SHA(salt + password_utf16le)
 *   Hn = SHA(Hn-1 + iterator_le32), for iterator = 0 .. spinCount-1
 *
 * The iteration step's byte order (previous hash FIRST, iterator counter
 * SECOND) was verified against a `.pptx` produced by real PowerPoint (COM
 * `Presentation.WritePassword`, `p:modifyVerifier/@cryptAlgorithmSid="14"`,
 * i.e. SHA-512): the reverse order, which an earlier version of this module
 * used, only ever passed its own round-trip tests (`createModifyVerifier`
 * piped straight back into `verifyModifyPassword`) and could never verify an
 * actual PowerPoint-authored password.
 *
 * Every hash algorithm ECMA-376 19.2.1.22 / [MS-OFFCRYPTO] permits a
 * verifier to name is checkable: SHA-1/256/384/512 via Web Crypto, and
 * MD2, MD4, MD5, RIPEMD-128, RIPEMD-160 and WHIRLPOOL via the pure
 * TypeScript implementations in `./digests` (Web Crypto never implemented
 * any of those). See `./digests/algorithm-names.ts` for name normalisation
 * and `./digests/digest.ts` for the dispatcher.
 *
 * A verifier real PowerPoint writes always carries `saltData`: COM
 * automation (`Presentation.WritePassword = "x"` then `SaveAs`) was used to
 * confirm this for the legacy `cryptAlgorithmSid` form (the only form that
 * omits `algorithmName`), and it produced
 * `cryptAlgorithmSid="14" ... saltData="..." hashData="..."` - never a
 * salt-less verifier. A `p:modifyVerifier` with no `saltData` is therefore
 * not a shape real PowerPoint produces; this module makes no attempt to
 * guess a default (such as treating a missing salt as empty), since doing
 * so would fabricate a check for a case nothing in the wild exercises. Such
 * a verifier still falls back to the unconditional "Edit anyway" every
 * other unrecognisable verifier gets.
 *
 * @see ECMA-376 Part 1, Section 19.2.1.22 (modifyVerifier)
 * @see [MS-OFFCRYPTO] Section 2.3.7.1 (Password Verifier Generation)
 *
 * @module modify-verifier
 */

import type { PptxModifyVerifier } from '../types';
import type { DigestAlgorithmName } from './digests';
import { digest, normalizeDigestAlgorithmName } from './digests';

// ---------------------------------------------------------------------------
// Legacy CryptoAPI algorithm identification
// ---------------------------------------------------------------------------

/**
 * Legacy CryptoAPI `ALG_SID_*` hash constants (from `wincrypt.h`), as used by
 * `p:modifyVerifier/@cryptAlgorithmSid` when the verifier identifies its hash
 * algorithm through the CAPI provider/class/type/sid quartet instead of a
 * named `algorithmName` (or legacy `algIdExt`) attribute.
 *
 * This is not a theoretical alternate encoding: PowerPoint's own "Set
 * Password to Modify" (`Presentation.WritePassword` via COM, and the
 * File > Info > Protect Presentation UI) writes EXACTLY this form -
 * `cryptAlgorithmSid="14" cryptAlgorithmClass="hash" cryptAlgorithmType="typeAny"`
 * with no `algorithmName` attribute at all. Without this mapping, a real
 * PowerPoint-authored modify password could never be verified by this
 * module; only a verifier this codebase itself wrote (`createModifyVerifier`,
 * which always sets `algorithmName`) would work.
 *
 * @see [MS-OFFCRYPTO] 2.1.3 (password verifier), ECMA-376 Part 1 19.2.1.22
 */
const CRYPT_ALGORITHM_SID_NAMES: Readonly<Record<number, DigestAlgorithmName>> = {
	1: 'MD2',
	2: 'MD4',
	3: 'MD5',
	4: 'SHA-1',
	12: 'SHA-256',
	13: 'SHA-384',
	14: 'SHA-512',
};

/**
 * Resolve a `p:modifyVerifier`'s effective hash algorithm name, preferring an
 * explicit `algorithmName` (or legacy `algIdExt`) and falling back to the
 * `cryptAlgorithmSid` CAPI identifier PowerPoint itself writes. The result is
 * always normalised (see `./digests/algorithm-names.ts`), so a caller never
 * has to separately handle `"SHA1"` vs `"SHA-1"` vs `"sha-1"`.
 *
 * Returns undefined when none of these resolve to a known algorithm (e.g. an
 * unrecognised `cryptAlgorithmSid`, or an `algorithmName` this viewer does
 * not implement), in which case the verifier cannot be checked here.
 */
export function resolveModifyVerifierAlgorithmName(
	verifier: Pick<PptxModifyVerifier, 'algorithmName' | 'algIdExt' | 'cryptAlgorithmSid'>,
): DigestAlgorithmName | undefined {
	if (verifier.algorithmName) {
		return normalizeDigestAlgorithmName(verifier.algorithmName);
	}
	if (verifier.algIdExt) {
		return normalizeDigestAlgorithmName(verifier.algIdExt);
	}
	if (verifier.cryptAlgorithmSid !== undefined) {
		return CRYPT_ALGORITHM_SID_NAMES[verifier.cryptAlgorithmSid];
	}
	return undefined;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a string to UTF-16LE bytes. */
function encodeUtf16LE(str: string): Uint8Array {
	const buf = new Uint8Array(str.length * 2);
	for (let i = 0; i < str.length; i++) {
		const code = str.charCodeAt(i);
		buf[i * 2] = code & 0xff;
		buf[i * 2 + 1] = (code >> 8) & 0xff;
	}
	return buf;
}

/** Concatenate Uint8Arrays. */
function concat(...arrays: Uint8Array[]): Uint8Array {
	let totalLength = 0;
	for (const arr of arrays) {
		totalLength += arr.length;
	}
	const result = new Uint8Array(totalLength);
	let offset = 0;
	for (const arr of arrays) {
		result.set(arr, offset);
		offset += arr.length;
	}
	return result;
}

/** Write a 32-bit little-endian integer to a Uint8Array. */
function uint32LE(value: number): Uint8Array {
	const buf = new Uint8Array(4);
	const view = new DataView(buf.buffer);
	view.setUint32(0, value, true);
	return buf;
}

/** Decode base64 string to Uint8Array. */
function base64Decode(str: string): Uint8Array {
	if (typeof Buffer !== 'undefined') {
		const buf = Buffer.from(str, 'base64');
		return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
	}
	const binary = atob(str);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

/** Encode Uint8Array to base64 string. */
function base64Encode(bytes: Uint8Array): string {
	if (typeof Buffer !== 'undefined') {
		return Buffer.from(bytes).toString('base64');
	}
	let binary = '';
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]!);
	}
	return btoa(binary);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Verify a modify-protection password against the verifier stored
 * in `presentation.xml`.
 *
 * The algorithm follows ECMA-376 Part 1, Section 19.2.1.22:
 *
 * 1. H0 = H(salt + password_utf16le)
 * 2. For i = 0..spinCount-1: Hi = H(i_le32 + Hi-1)
 * 3. Compare Hfinal with the stored hash.
 *
 * The hash algorithm is resolved via {@link resolveModifyVerifierAlgorithmName}:
 * an explicit `algorithmName`/`algIdExt`, or (the form PowerPoint itself
 * writes) `cryptAlgorithmSid`.
 *
 * @param verifier - The parsed `PptxModifyVerifier` from the presentation.
 * @param password - The password to check.
 * @returns True if the password matches.
 */
export async function verifyModifyPassword(
	verifier: PptxModifyVerifier,
	password: string,
): Promise<boolean> {
	const algorithm = resolveModifyVerifierAlgorithmName(verifier);
	if (!algorithm || !verifier.hashData || !verifier.saltData) {
		return false;
	}

	const salt = base64Decode(verifier.saltData);
	const expectedHash = base64Decode(verifier.hashData);
	const spinCount = verifier.spinValue ?? 100000;

	const passwordBytes = encodeUtf16LE(password);

	// H0 = H(salt + password)
	let h = await digest(algorithm, concat(salt, passwordBytes));

	// Iterate: Hn = H(Hn-1 + iterator_le32). Verified against a REAL
	// PowerPoint-authored `p:modifyVerifier` (COM `Presentation.WritePassword`):
	// the iterator comes AFTER the previous hash, not before it, despite this
	// module's own docstring (and every earlier version of this function)
	// describing it the other way around; that description was never checked
	// against an actual PowerPoint file, only against itself.
	for (let i = 0; i < spinCount; i++) {
		h = await digest(algorithm, concat(h, uint32LE(i)));
	}

	// Compare
	if (h.length !== expectedHash.length) {
		// Truncate or compare up to shorter length
		const len = Math.min(h.length, expectedHash.length);
		for (let i = 0; i < len; i++) {
			if (h[i] !== expectedHash[i]) {
				return false;
			}
		}
		return true;
	}

	for (let i = 0; i < h.length; i++) {
		if (h[i] !== expectedHash[i]) {
			return false;
		}
	}
	return true;
}

/**
 * Create a modify verifier from a password.
 *
 * Generates the hash and salt data needed for `p:modifyVerifier`
 * in `presentation.xml`.
 *
 * @param password - The modify protection password.
 * @param options - Optional hash algorithm and spin count.
 * @returns A PptxModifyVerifier object ready to be saved.
 */
export async function createModifyVerifier(
	password: string,
	options?: {
		algorithmName?: string;
		spinCount?: number;
	},
): Promise<PptxModifyVerifier> {
	const requestedAlgorithm = options?.algorithmName ?? 'SHA-512';
	const algorithm = normalizeDigestAlgorithmName(requestedAlgorithm);
	if (!algorithm) {
		throw new Error(`Unsupported modify-verifier hash algorithm: ${requestedAlgorithm}`);
	}
	const spinCount = options?.spinCount ?? 100000;

	// Generate random salt
	const salt = new Uint8Array(16);
	if (typeof globalThis.crypto !== 'undefined') {
		globalThis.crypto.getRandomValues(salt);
	} else {
		// Fallback for environments without crypto
		for (let i = 0; i < salt.length; i++) {
			salt[i] = Math.floor(Math.random() * 256);
		}
	}

	const passwordBytes = encodeUtf16LE(password);

	// H0 = H(salt + password)
	let h = await digest(algorithm, concat(salt, passwordBytes));

	// Iterate: Hn = H(Hn-1 + iterator_le32); see the matching note in
	// `verifyModifyPassword` above.
	for (let i = 0; i < spinCount; i++) {
		h = await digest(algorithm, concat(h, uint32LE(i)));
	}

	return {
		algorithmName: algorithm,
		hashData: base64Encode(h),
		saltData: base64Encode(salt),
		spinValue: spinCount,
		cryptAlgorithmClass: 'hash',
		cryptAlgorithmType: 'typeAny',
	};
}
