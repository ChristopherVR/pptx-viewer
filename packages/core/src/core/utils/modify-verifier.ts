/**
 * Write-protection (modify verifier) password verification.
 *
 * PowerPoint's "read-only recommended" / "modify password" feature stores
 * a password hash in `p:modifyVerifier` within `presentation.xml`. This
 * module implements the hash verification algorithm from ECMA-376.
 *
 * @see ECMA-376 Part 1, Section 19.2.1.22 (modifyVerifier)
 * @see [MS-OFFCRYPTO] Section 2.3.7.1 (Password Verifier Generation)
 *
 * @module modify-verifier
 */

import type { PptxModifyVerifier } from "../types";

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
  for (const arr of arrays) totalLength += arr.length;
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
  if (typeof Buffer !== "undefined") {
    const buf = Buffer.from(str, "base64");
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
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

/** Map OOXML hash algorithm names to Web Crypto names. */
function mapHashAlgorithm(name: string): string {
  const upper = name.toUpperCase().replace(/-/g, "");
  switch (upper) {
    case "SHA1":
      return "SHA-1";
    case "SHA256":
      return "SHA-256";
    case "SHA384":
      return "SHA-384";
    case "SHA512":
      return "SHA-512";
    default:
      return name;
  }
}

/** Get crypto.subtle. */
function getSubtle(): SubtleCrypto {
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.subtle) {
    return globalThis.crypto.subtle;
  }
  throw new Error(
    "Web Crypto API is required for modify password verification.",
  );
}

/** Hash data using specified algorithm. */
async function hashDigest(
  algorithm: string,
  data: Uint8Array,
): Promise<Uint8Array> {
  const subtle = getSubtle();
  const result = await subtle.digest(mapHashAlgorithm(algorithm), data as unknown as BufferSource);
  return new Uint8Array(result);
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
 * @param verifier - The parsed `PptxModifyVerifier` from the presentation.
 * @param password - The password to check.
 * @returns True if the password matches.
 */
export async function verifyModifyPassword(
  verifier: PptxModifyVerifier,
  password: string,
): Promise<boolean> {
  if (!verifier.algorithmName || !verifier.hashData || !verifier.saltData) {
    return false;
  }

  const salt = base64Decode(verifier.saltData);
  const expectedHash = base64Decode(verifier.hashData);
  const spinCount = verifier.spinValue ?? 100000;
  const algorithm = verifier.algorithmName;

  const passwordBytes = encodeUtf16LE(password);

  // H0 = H(salt + password)
  let h = await hashDigest(algorithm, concat(salt, passwordBytes));

  // Iterate: Hn = H(iterator_le32 + Hn-1)
  for (let i = 0; i < spinCount; i++) {
    h = await hashDigest(algorithm, concat(uint32LE(i), h));
  }

  // Compare
  if (h.length !== expectedHash.length) {
    // Truncate or compare up to shorter length
    const len = Math.min(h.length, expectedHash.length);
    for (let i = 0; i < len; i++) {
      if (h[i] !== expectedHash[i]) return false;
    }
    return true;
  }

  for (let i = 0; i < h.length; i++) {
    if (h[i] !== expectedHash[i]) return false;
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
  const algorithm = options?.algorithmName ?? "SHA-512";
  const spinCount = options?.spinCount ?? 100000;

  // Generate random salt
  const salt = new Uint8Array(16);
  if (typeof globalThis.crypto !== "undefined") {
    globalThis.crypto.getRandomValues(salt);
  } else {
    // Fallback for environments without crypto
    for (let i = 0; i < salt.length; i++) {
      salt[i] = Math.floor(Math.random() * 256);
    }
  }

  const passwordBytes = encodeUtf16LE(password);

  // H0 = H(salt + password)
  let h = await hashDigest(algorithm, concat(salt, passwordBytes));

  // Iterate: Hn = H(iterator_le32 + Hn-1)
  for (let i = 0; i < spinCount; i++) {
    h = await hashDigest(algorithm, concat(uint32LE(i), h));
  }

  return {
    algorithmName: algorithm,
    hashData: base64Encode(h),
    saltData: base64Encode(salt),
    spinValue: spinCount,
    cryptAlgorithmClass: "hash",
    cryptAlgorithmType: "typeAny",
  };
}
