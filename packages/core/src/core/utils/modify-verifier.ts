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
 * ## Salt-less verifiers
 *
 * ECMA-376 19.2.1.22's `CT_ModifyVerifier` declares `saltData` (like every
 * other attribute on the type except the CAPI quartet) `use="optional"`, so a
 * conformant producer other than PowerPoint is free to omit it, and
 * [MS-OFFCRYPTO] 2.3.7.1's iterated-hash derivation never special-cases an
 * empty salt: it is simply the decoded byte string prepended to the
 * password, and a zero-length byte string is a valid decode of an absent
 * attribute. This module therefore treats a missing (or empty) `saltData` as
 * a zero-length salt and runs the same H0/iteration derivation, rather than
 * refusing to check the hash at all, so this viewer's own read-only-recommended
 * prompt now asks for (and verifies) a password against such a verifier
 * instead of an unconditional "Edit anyway".
 *
 * COM automation (`Presentation.WritePassword = "x"` then `SaveAs`) confirmed
 * real PowerPoint itself always writes a non-empty `saltData`, so this path
 * never fires for a genuine PowerPoint-authored file. Separately, and
 * IMPORTANTLY NOT the behaviour this module implements: COM testing of a
 * hand-authored salt-less `p:modifyVerifier` (`scripts/make-saltless-verifier-
 * fixture.mjs`, both in the `algorithmName` form and reshaped byte-for-byte
 * into PowerPoint's own legacy `cryptAlgorithmSid` form) showed real
 * PowerPoint's own "Set Password to Modify" check rejects EVERY password for
 * such a file, `Presentations.Open` throwing "Reenter the password required
 * to modify files" even for the password that mathematically satisfies the
 * ECMA-376 hash - the identical failure a genuinely wrong password produces
 * against a real, salted verifier. PowerPoint's own implementation therefore
 * appears to require a non-empty salt as a precondition for running the check
 * at all, stricter than what the schema and the published derivation actually
 * require. This module still checks the hash per spec rather than mirroring
 * that stricter, undocumented PowerPoint behaviour: doing the ECMA-376-legal
 * computation is strictly more capable (any spec-conformant producer's
 * salt-less verifier becomes checkable here), and there is no way to
 * distinguish "PowerPoint would refuse this too" from "some other tool wrote
 * it and expects the spec's derivation" without also flagging every algorithm
 * PowerPoint happens to write differently, which would defeat the purpose of
 * supporting the other legal shapes at all.
 *
 * `spinValue`/`spinCount` is likewise optional; when absent this module
 * defaults it to 100000 (PowerPoint's own default spin count), the same
 * default used for `createModifyVerifier`'s own output.
 *
 * A legacy XOR-obfuscation password (used by the pre-OOXML binary `.ppt`
 * write-protection scheme, and by early binary Word/Excel) is NOT a legal
 * shape for `p:modifyVerifier`: `CT_ModifyVerifier` only ever carries a
 * cryptographic hash verifier (the CAPI quartet or `algorithmName`), never a
 * bare obfuscation key, so no XOR fallback is implemented here. A `.ppt`'s
 * own (different) write-protection scheme is handled by the legacy importer
 * in `core/ppt/`, not this module.
 *
 * @see ECMA-376 Part 1, Section 19.2.1.22 (modifyVerifier)
 * @see [MS-OFFCRYPTO] Section 2.3.7.1 (Password Verifier Generation)
 *
 * @module modify-verifier
 */

import type { PptxModifyVerifier } from '../types';
import type { DigestAlgorithmName } from './digests';
import { normalizeDigestAlgorithmName } from './digests';
import {
	base64Decode,
	base64Encode,
	bytesEqual,
	iteratedHash,
	randomSalt,
} from './modify-verifier-codec';

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
// Public API
// ---------------------------------------------------------------------------

/**
 * Verify a modify-protection password against the verifier stored
 * in `presentation.xml`.
 *
 * The algorithm follows ECMA-376 Part 1, Section 19.2.1.22 (see
 * {@link iteratedHash}). The hash algorithm is resolved via
 * {@link resolveModifyVerifierAlgorithmName}: an explicit
 * `algorithmName`/`algIdExt`, or (the form PowerPoint itself writes)
 * `cryptAlgorithmSid`. `saltData` and `spinValue`/`spinCount` are both
 * optional per the schema; a missing `saltData` is treated as a zero-length
 * salt and a missing spin count defaults to 100000 (see the module doc
 * comment's "Salt-less verifiers" section for the citation and the COM
 * evidence backing both defaults).
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
	if (!algorithm || !verifier.hashData) {
		return false;
	}

	const salt = verifier.saltData ? base64Decode(verifier.saltData) : new Uint8Array(0);
	const expectedHash = base64Decode(verifier.hashData);
	const spinCount = verifier.spinValue ?? 100000;

	const h = await iteratedHash(algorithm, salt, password, spinCount);
	return bytesEqual(h, expectedHash);
}

/**
 * Create a modify verifier from a password.
 *
 * Generates the hash and salt data needed for `p:modifyVerifier`
 * in `presentation.xml`. Always writes a real random salt, matching what
 * real PowerPoint itself produces (COM-confirmed, see the module doc
 * comment); use {@link createSaltlessModifyVerifierForTesting} to build the
 * salt-less shape for fixtures/tests.
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
	const salt = randomSalt();
	const h = await iteratedHash(algorithm, salt, password, spinCount);

	return {
		algorithmName: algorithm,
		hashData: base64Encode(h),
		saltData: base64Encode(salt),
		spinValue: spinCount,
		cryptAlgorithmClass: 'hash',
		cryptAlgorithmType: 'typeAny',
	};
}

/**
 * Test/fixture-only: build a `p:modifyVerifier` with NO `saltData` attribute
 * at all (a zero-length salt is hashed in, per ECMA-376 19.2.1.22's optional
 * `saltData`; see the module doc comment).
 *
 * Real PowerPoint always writes a salt (COM-confirmed); this helper exists
 * solely to generate the salt-less fixtures `scripts/make-saltless-verifier-
 * fixture.mjs` produces and to unit-test the salt-less code path
 * {@link verifyModifyPassword} supports for robustness against any legal
 * `p:modifyVerifier` shape. No save/write path a user can trigger should ever
 * call this; `createModifyVerifier` (always salted) is the one every
 * "Set Password to Modify" UI must keep using.
 *
 * @param password - The modify protection password.
 * @param options - Optional hash algorithm and spin count.
 * @returns A PptxModifyVerifier object with no `saltData`, ready to be saved.
 */
export async function createSaltlessModifyVerifierForTesting(
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
	const h = await iteratedHash(algorithm, new Uint8Array(0), password, spinCount);

	return {
		algorithmName: algorithm,
		hashData: base64Encode(h),
		spinValue: spinCount,
		cryptAlgorithmClass: 'hash',
		cryptAlgorithmType: 'typeAny',
	};
}
