/**
 * ECMA-376 OOXML encryption and decryption.
 *
 * Implements the "Agile" encryption scheme (ECMA-376 Standard Encryption
 * and Agile Encryption) used by Office 2010+ for password-protected files.
 *
 * Reference:
 * - [MS-OFFCRYPTO] Office Document Cryptography Structure
 * - ECMA-376 Part 2, Data Spaces and Rights Management
 *
 * @module ooxml-crypto
 */

import { parseOle2, buildOle2 } from "./ole2-parser";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Supported encryption algorithms. */
export type EncryptionAlgorithm = "AES128" | "AES256";

/** Parsed encryption info from the EncryptionInfo stream. */
export interface EncryptionInfo {
  /** Encryption version (major.minor). */
  version: { major: number; minor: number };
  /** Whether this is agile encryption. */
  isAgile: boolean;
  /** Key encryption data. */
  keyData: {
    saltSize: number;
    blockSize: number;
    keyBits: number;
    hashSize: number;
    cipherAlgorithm: string;
    cipherChaining: string;
    hashAlgorithm: string;
    saltValue: Uint8Array;
  };
  /** Data integrity verification. */
  dataIntegrity?: {
    encryptedHmacKey: Uint8Array;
    encryptedHmacValue: Uint8Array;
  };
  /** Password verifier encryption data. */
  passwordKeyEncryptor: {
    saltSize: number;
    blockSize: number;
    keyBits: number;
    hashSize: number;
    cipherAlgorithm: string;
    cipherChaining: string;
    hashAlgorithm: string;
    saltValue: Uint8Array;
    spinCount: number;
    encryptedVerifierHashInput: Uint8Array;
    encryptedVerifierHashValue: Uint8Array;
    encryptedKeyValue: Uint8Array;
  };
}

/**
 * Standard encryption info (Office 2007 format, versions 2.x/3.x/4.x).
 */
export interface StandardEncryptionInfo {
  version: { major: number; minor: number };
  isAgile: false;
  isStandard: true;
  flags: number;
  headerSize: number;
  header: {
    flags: number;
    algId: number;
    algIdHash: number;
    keySize: number;
    providerType: number;
    cspName: string;
  };
  verifier: {
    saltSize: number;
    salt: Uint8Array;
    encryptedVerifier: Uint8Array;
    verifierHashSize: number;
    encryptedVerifierHash: Uint8Array;
  };
}

/** Encryption options for creating encrypted files. */
export interface EncryptionOptions {
  algorithm?: EncryptionAlgorithm;
}

// ---------------------------------------------------------------------------
// Crypto helpers (Web Crypto API)
// ---------------------------------------------------------------------------

/**
 * Get the crypto.subtle implementation.
 * Works in browsers, Node.js 15+, Bun, Deno, and Cloudflare Workers.
 */
function getSubtle(): SubtleCrypto {
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.subtle) {
    return globalThis.crypto.subtle;
  }
  throw new Error(
    "Web Crypto API (crypto.subtle) is not available in this environment. " +
      "Password-protected PPTX files require a runtime with Web Crypto support.",
  );
}

/** Get the crypto object for random bytes. */
function getCrypto(): Crypto {
  if (typeof globalThis.crypto !== "undefined") {
    return globalThis.crypto;
  }
  throw new Error("crypto API is not available in this environment.");
}

/** Convert a string to UTF-16LE bytes (as used by OOXML password hashing). */
function encodePasswordUtf16LE(password: string): Uint8Array {
  const buf = new Uint8Array(password.length * 2);
  for (let i = 0; i < password.length; i++) {
    const code = password.charCodeAt(i);
    buf[i * 2] = code & 0xff;
    buf[i * 2 + 1] = (code >> 8) & 0xff;
  }
  return buf;
}

/** Concatenate multiple Uint8Arrays. */
function concatArrays(...arrays: Uint8Array[]): Uint8Array {
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
  // Works in both browser (atob) and Node.js/Bun (Buffer)
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

/**
 * Hash data using the specified algorithm.
 */
async function hash(
  algorithm: string,
  data: Uint8Array,
): Promise<Uint8Array> {
  const subtle = getSubtle();
  const webCryptoAlg = mapHashAlgorithm(algorithm);
  const result = await subtle.digest(webCryptoAlg, data);
  return new Uint8Array(result);
}

/**
 * Map OOXML hash algorithm names to Web Crypto names.
 */
function mapHashAlgorithm(algorithm: string): string {
  const upper = algorithm.toUpperCase().replace(/-/g, "");
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
      return algorithm;
  }
}

/**
 * Map hash algorithm to output size in bytes.
 */
function hashOutputSize(algorithm: string): number {
  const upper = algorithm.toUpperCase().replace(/-/g, "");
  switch (upper) {
    case "SHA1":
      return 20;
    case "SHA256":
      return 32;
    case "SHA384":
      return 48;
    case "SHA512":
      return 64;
    default:
      return 32;
  }
}

/**
 * AES-CBC decrypt with the given key, IV, and no padding removal.
 */
async function aesCbcDecryptRaw(
  key: Uint8Array,
  iv: Uint8Array,
  data: Uint8Array,
): Promise<Uint8Array> {
  const subtle = getSubtle();
  const cryptoKey = await subtle.importKey(
    "raw",
    key,
    { name: "AES-CBC" },
    false,
    ["decrypt"],
  );

  // Web Crypto always expects PKCS7 padding. To decrypt without padding removal,
  // we manually add a valid padding block and then strip it.
  // For raw decryption, we add a full block of padding bytes to trick the API.
  const blockSize = 16;
  // Ensure data is block-aligned
  if (data.length % blockSize !== 0) {
    // Pad to block alignment
    const padded = new Uint8Array(
      Math.ceil(data.length / blockSize) * blockSize,
    );
    padded.set(data);
    data = padded;
  }

  // Add a padding block (16 bytes of 0x10)
  const paddedData = new Uint8Array(data.length + blockSize);
  paddedData.set(data);
  for (let i = data.length; i < paddedData.length; i++) {
    paddedData[i] = blockSize;
  }

  const result = await subtle.decrypt(
    { name: "AES-CBC", iv },
    cryptoKey,
    paddedData,
  );
  // The result will be data.length bytes (the padding block is removed by Web Crypto)
  return new Uint8Array(result).subarray(0, data.length);
}

/**
 * AES-CBC encrypt with PKCS7 padding.
 */
async function aesCbcEncrypt(
  key: Uint8Array,
  iv: Uint8Array,
  data: Uint8Array,
): Promise<Uint8Array> {
  const subtle = getSubtle();
  const cryptoKey = await subtle.importKey(
    "raw",
    key,
    { name: "AES-CBC" },
    false,
    ["encrypt"],
  );
  const result = await subtle.encrypt(
    { name: "AES-CBC", iv },
    cryptoKey,
    data,
  );
  return new Uint8Array(result);
}

/**
 * AES-CBC encrypt without padding (data must be block-aligned).
 */
async function aesCbcEncryptNoPad(
  key: Uint8Array,
  iv: Uint8Array,
  data: Uint8Array,
): Promise<Uint8Array> {
  const blockSize = 16;
  if (data.length % blockSize !== 0) {
    throw new Error("Data must be block-aligned for no-padding encryption");
  }

  // Trick: use raw encryption by decrypting our way through
  // Actually, let's encrypt with padding and then trim
  // We need to pad the data ourselves and encrypt
  const subtle = getSubtle();
  const cryptoKey = await subtle.importKey(
    "raw",
    key,
    { name: "AES-CBC" },
    false,
    ["encrypt"],
  );

  // Encrypt using raw — Web Crypto adds PKCS7 padding, so output is data.length + 16
  const result = await subtle.encrypt(
    { name: "AES-CBC", iv },
    cryptoKey,
    data,
  );
  // Trim off the extra padding block
  return new Uint8Array(result).subarray(0, data.length);
}

/**
 * HMAC using the specified hash algorithm.
 */
async function hmac(
  algorithm: string,
  key: Uint8Array,
  data: Uint8Array,
): Promise<Uint8Array> {
  const subtle = getSubtle();
  const webCryptoAlg = mapHashAlgorithm(algorithm);
  const cryptoKey = await subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: webCryptoAlg },
    false,
    ["sign"],
  );
  const result = await subtle.sign("HMAC", cryptoKey, data);
  return new Uint8Array(result);
}

// ---------------------------------------------------------------------------
// Agile Encryption Key Derivation
// ---------------------------------------------------------------------------

/**
 * Derive an encryption key from a password using the OOXML agile encryption
 * key derivation algorithm.
 *
 * @param password - User's password.
 * @param salt - Salt from EncryptionInfo.
 * @param spinCount - Number of hash iterations.
 * @param hashAlgorithm - Hash algorithm name (e.g. "SHA-512").
 * @param blockKey - Block key for deriving specific sub-keys.
 * @param keyBits - Desired key length in bits.
 * @param hashSize - Hash output size in bytes.
 * @returns Derived key of keyBits/8 bytes.
 */
async function deriveAgileKey(
  password: string,
  salt: Uint8Array,
  spinCount: number,
  hashAlgorithm: string,
  blockKey: Uint8Array,
  keyBits: number,
  hashSize: number,
): Promise<Uint8Array> {
  const passwordBytes = encodePasswordUtf16LE(password);

  // Step 1: H0 = H(salt + password)
  let h = await hash(hashAlgorithm, concatArrays(salt, passwordBytes));

  // Step 2: Iterate: Hn = H(iterator + Hn-1)
  for (let i = 0; i < spinCount; i++) {
    h = await hash(hashAlgorithm, concatArrays(uint32LE(i), h));
  }

  // Step 3: Hfinal = H(Hlast + blockKey)
  h = await hash(hashAlgorithm, concatArrays(h, blockKey));

  // Step 4: Derive key by extending with cbRequiredKeyLength/cbHashSize
  const cbRequiredKeyLength = keyBits / 8;
  const cbHash = hashSize;

  // Create derived key buffer
  const derivedKey = new Uint8Array(64);
  const ipad = 0x36;
  const opad = 0x5c;

  if (cbHash >= cbRequiredKeyLength) {
    return h.subarray(0, cbRequiredKeyLength);
  }

  // X1 = H(cbBuffer padded with 0x36)
  const x1Input = new Uint8Array(64);
  x1Input.fill(ipad);
  for (let i = 0; i < h.length && i < 64; i++) {
    x1Input[i] = h[i]! ^ ipad;
  }
  const x1 = await hash(hashAlgorithm, x1Input);

  // X2 = H(cbBuffer padded with 0x5C)
  const x2Input = new Uint8Array(64);
  x2Input.fill(opad);
  for (let i = 0; i < h.length && i < 64; i++) {
    x2Input[i] = h[i]! ^ opad;
  }
  const x2 = await hash(hashAlgorithm, x2Input);

  // X3 = X1 + X2
  const x3 = concatArrays(x1, x2);
  return x3.subarray(0, cbRequiredKeyLength);
}

// ---------------------------------------------------------------------------
// Standard Encryption Key Derivation (Office 2007 / versions 2.x-4.x)
// ---------------------------------------------------------------------------

/**
 * Derive the encryption key for standard encryption (Office 2007).
 *
 * [MS-OFFCRYPTO] 2.3.6.2 — Password Key Generation
 */
async function deriveStandardKey(
  password: string,
  salt: Uint8Array,
  keySize: number,
  algIdHash: number,
): Promise<Uint8Array> {
  const passwordBytes = encodePasswordUtf16LE(password);

  // H0 = H(salt + password)
  let h = await hash("SHA-1", concatArrays(salt, passwordBytes));

  // Iterate 50000 times: Hn = H(iterator + Hn-1)
  for (let i = 0; i < 50000; i++) {
    h = await hash("SHA-1", concatArrays(uint32LE(i), h));
  }

  // Hfinal = H(Hlast + blockKey)  blockKey = 0x00000000 for key derivation
  const blockKey = new Uint8Array(4); // all zeros
  h = await hash("SHA-1", concatArrays(h, blockKey));

  // Derive key: create cbRequiredKeyLength bytes
  const cbRequiredKeyLength = keySize / 8;

  // X1 = H(derivedKey padded with 0x36)
  const x1Input = new Uint8Array(64);
  x1Input.fill(0x36);
  for (let i = 0; i < h.length && i < 64; i++) {
    x1Input[i] = h[i]! ^ 0x36;
  }
  const x1 = await hash("SHA-1", x1Input);

  // X2 = H(derivedKey padded with 0x5C)
  const x2Input = new Uint8Array(64);
  x2Input.fill(0x5c);
  for (let i = 0; i < h.length && i < 64; i++) {
    x2Input[i] = h[i]! ^ 0x5c;
  }
  const x2 = await hash("SHA-1", x2Input);

  const x3 = concatArrays(x1, x2);
  return x3.subarray(0, cbRequiredKeyLength);
}

// ---------------------------------------------------------------------------
// EncryptionInfo Stream Parsing
// ---------------------------------------------------------------------------

/** Well-known block keys for agile encryption. */
const BLOCK_KEYS = {
  verifierHashInput: new Uint8Array([
    0xfe, 0xa7, 0xd2, 0x76, 0x3b, 0x4b, 0x9e, 0x79,
  ]),
  verifierHashValue: new Uint8Array([
    0xd7, 0xaa, 0x0f, 0x6d, 0x30, 0x61, 0x34, 0x4e,
  ]),
  encryptedKeyValue: new Uint8Array([
    0x14, 0x6e, 0x0b, 0xe7, 0xab, 0xac, 0xd0, 0xd6,
  ]),
  dataIntegrityHmacKey: new Uint8Array([
    0x5f, 0xb2, 0xad, 0x01, 0x0c, 0xb9, 0xe1, 0xf6,
  ]),
  dataIntegrityHmacValue: new Uint8Array([
    0xa0, 0x67, 0x7f, 0x02, 0xb2, 0x2c, 0x84, 0x33,
  ]),
};

/**
 * Parse the EncryptionInfo stream from an encrypted OOXML file.
 */
export function parseEncryptionInfo(
  data: Uint8Array,
): EncryptionInfo | StandardEncryptionInfo {
  const view = new DataView(
    data.buffer,
    data.byteOffset,
    data.byteLength,
  );

  const versionMajor = view.getUint16(0, true);
  const versionMinor = view.getUint16(2, true);

  // Agile encryption: version 4.4
  if (versionMajor === 4 && versionMinor === 4) {
    return parseAgileEncryptionInfo(data);
  }

  // Standard encryption: version 2.x, 3.x, or 4.x (but not 4.4)
  if (
    (versionMajor === 2 || versionMajor === 3 || versionMajor === 4) &&
    versionMinor === 2
  ) {
    return parseStandardEncryptionInfo(data);
  }

  throw new Error(
    `Unsupported encryption version: ${versionMajor}.${versionMinor}. ` +
      "Only Standard (2.2-4.2) and Agile (4.4) encryption are supported.",
  );
}

/**
 * Parse standard encryption info (Office 2007 format).
 */
function parseStandardEncryptionInfo(
  data: Uint8Array,
): StandardEncryptionInfo {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  const versionMajor = view.getUint16(0, true);
  const versionMinor = view.getUint16(2, true);
  const flags = view.getUint32(4, true);

  // Header size at offset 8
  const headerSize = view.getUint32(8, true);

  // Encryption header starts at offset 12
  const headerOffset = 12;
  const hFlags = view.getUint32(headerOffset, true);
  const sizeExtra = view.getUint32(headerOffset + 4, true);
  const algId = view.getUint32(headerOffset + 8, true);
  const algIdHash = view.getUint32(headerOffset + 12, true);
  const keySize = view.getUint32(headerOffset + 16, true);
  const providerType = view.getUint32(headerOffset + 20, true);
  // Reserved1 = headerOffset + 24
  // Reserved2 = headerOffset + 28

  // CSP name is UTF-16LE string after the fixed header fields (32 bytes)
  let cspName = "";
  const cspOffset = headerOffset + 32;
  const cspEnd = headerOffset + headerSize;
  for (let i = cspOffset; i < cspEnd - 1; i += 2) {
    const ch = view.getUint16(i, true);
    if (ch === 0) break;
    cspName += String.fromCharCode(ch);
  }

  // Verifier starts after the header
  const verifierOffset = 12 + headerSize;
  const saltSize = view.getUint32(verifierOffset, true);
  const salt = new Uint8Array(
    data.buffer,
    data.byteOffset + verifierOffset + 4,
    16,
  );
  const encryptedVerifier = new Uint8Array(
    data.buffer,
    data.byteOffset + verifierOffset + 20,
    16,
  );
  const verifierHashSize = view.getUint32(verifierOffset + 36, true);
  const encryptedVerifierHash = new Uint8Array(
    data.buffer,
    data.byteOffset + verifierOffset + 40,
    32,
  );

  return {
    version: { major: versionMajor, minor: versionMinor },
    isAgile: false,
    isStandard: true,
    flags,
    headerSize,
    header: {
      flags: hFlags,
      algId,
      algIdHash,
      keySize,
      providerType,
      cspName,
    },
    verifier: {
      saltSize,
      salt: new Uint8Array(salt),
      encryptedVerifier: new Uint8Array(encryptedVerifier),
      verifierHashSize,
      encryptedVerifierHash: new Uint8Array(encryptedVerifierHash),
    },
  };
}

/**
 * Parse agile encryption info (Office 2010+ XML-based format).
 */
function parseAgileEncryptionInfo(data: Uint8Array): EncryptionInfo {
  // Skip version (4 bytes) and reserved (4 bytes)
  const xmlBytes = data.subarray(8);
  const xmlStr = new TextDecoder("utf-8").decode(xmlBytes);

  // Parse the XML manually (it's a simple structure)
  const getAttr = (xml: string, tag: string, attr: string): string => {
    // Find the tag
    const tagRegex = new RegExp(`<[^>]*${tag}[^>]*>`, "i");
    const tagMatch = xml.match(tagRegex);
    if (!tagMatch) return "";

    const attrRegex = new RegExp(`${attr}="([^"]*)"`, "i");
    const attrMatch = tagMatch[0].match(attrRegex);
    return attrMatch ? attrMatch[1]! : "";
  };

  // Find keyData element
  const keyDataSaltSize = parseInt(
    getAttr(xmlStr, "keyData", "saltSize"),
    10,
  );
  const keyDataBlockSize = parseInt(
    getAttr(xmlStr, "keyData", "blockSize"),
    10,
  );
  const keyDataKeyBits = parseInt(
    getAttr(xmlStr, "keyData", "keyBits"),
    10,
  );
  const keyDataHashSize = parseInt(
    getAttr(xmlStr, "keyData", "hashSize"),
    10,
  );
  const keyDataCipherAlgorithm = getAttr(
    xmlStr,
    "keyData",
    "cipherAlgorithm",
  );
  const keyDataCipherChaining = getAttr(
    xmlStr,
    "keyData",
    "cipherChaining",
  );
  const keyDataHashAlgorithm = getAttr(
    xmlStr,
    "keyData",
    "hashAlgorithm",
  );
  const keyDataSaltValue = getAttr(xmlStr, "keyData", "saltValue");

  // Find dataIntegrity element
  const encryptedHmacKey = getAttr(
    xmlStr,
    "dataIntegrity",
    "encryptedHmacKey",
  );
  const encryptedHmacValue = getAttr(
    xmlStr,
    "dataIntegrity",
    "encryptedHmacValue",
  );

  // Find p:encryptedKey element (password key encryptor)
  // The encryptedKey tag might be namespace-prefixed
  const encKeyTag = xmlStr.match(
    /<[^>]*encryptedKey[^>]*>/i,
  );
  const encKeyStr = encKeyTag ? encKeyTag[0] : "";

  const getEncKeyAttr = (attr: string): string => {
    const regex = new RegExp(`${attr}="([^"]*)"`, "i");
    const match = encKeyStr.match(regex);
    return match ? match[1]! : "";
  };

  const pkeSaltSize = parseInt(getEncKeyAttr("saltSize"), 10);
  const pkeBlockSize = parseInt(getEncKeyAttr("blockSize"), 10);
  const pkeKeyBits = parseInt(getEncKeyAttr("keyBits"), 10);
  const pkeHashSize = parseInt(getEncKeyAttr("hashSize"), 10);
  const pkeCipherAlgorithm = getEncKeyAttr("cipherAlgorithm");
  const pkeCipherChaining = getEncKeyAttr("cipherChaining");
  const pkeHashAlgorithm = getEncKeyAttr("hashAlgorithm");
  const pkeSaltValue = getEncKeyAttr("saltValue");
  const pkeSpinCount = parseInt(getEncKeyAttr("spinCount"), 10);
  const pkeEncryptedVerifierHashInput = getEncKeyAttr(
    "encryptedVerifierHashInput",
  );
  const pkeEncryptedVerifierHashValue = getEncKeyAttr(
    "encryptedVerifierHashValue",
  );
  const pkeEncryptedKeyValue = getEncKeyAttr("encryptedKeyValue");

  return {
    version: { major: 4, minor: 4 },
    isAgile: true,
    keyData: {
      saltSize: keyDataSaltSize,
      blockSize: keyDataBlockSize,
      keyBits: keyDataKeyBits,
      hashSize: keyDataHashSize,
      cipherAlgorithm: keyDataCipherAlgorithm,
      cipherChaining: keyDataCipherChaining,
      hashAlgorithm: keyDataHashAlgorithm,
      saltValue: base64Decode(keyDataSaltValue),
    },
    dataIntegrity: encryptedHmacKey
      ? {
          encryptedHmacKey: base64Decode(encryptedHmacKey),
          encryptedHmacValue: base64Decode(encryptedHmacValue),
        }
      : undefined,
    passwordKeyEncryptor: {
      saltSize: pkeSaltSize,
      blockSize: pkeBlockSize,
      keyBits: pkeKeyBits,
      hashSize: pkeHashSize,
      cipherAlgorithm: pkeCipherAlgorithm,
      cipherChaining: pkeCipherChaining,
      hashAlgorithm: pkeHashAlgorithm,
      saltValue: base64Decode(pkeSaltValue),
      spinCount: pkeSpinCount,
      encryptedVerifierHashInput: base64Decode(
        pkeEncryptedVerifierHashInput,
      ),
      encryptedVerifierHashValue: base64Decode(
        pkeEncryptedVerifierHashValue,
      ),
      encryptedKeyValue: base64Decode(pkeEncryptedKeyValue),
    },
  };
}

// ---------------------------------------------------------------------------
// Agile Decryption
// ---------------------------------------------------------------------------

/**
 * Verify the password against agile encryption info and return the
 * decryption key if valid.
 *
 * @returns The document encryption key, or null if the password is wrong.
 */
async function verifyAgilePassword(
  info: EncryptionInfo,
  password: string,
): Promise<Uint8Array | null> {
  const pke = info.passwordKeyEncryptor;

  // Derive key for verifier hash input
  const verifierInputKey = await deriveAgileKey(
    password,
    pke.saltValue,
    pke.spinCount,
    pke.hashAlgorithm,
    BLOCK_KEYS.verifierHashInput,
    pke.keyBits,
    pke.hashSize,
  );

  // Decrypt the verifier hash input
  const iv1 = generateIV(
    pke.hashAlgorithm,
    pke.saltValue,
    BLOCK_KEYS.verifierHashInput,
    pke.blockSize,
  );
  const verifierHashInput = await aesCbcDecryptRaw(
    verifierInputKey,
    await iv1,
    pke.encryptedVerifierHashInput,
  );

  // Derive key for verifier hash value
  const verifierHashKey = await deriveAgileKey(
    password,
    pke.saltValue,
    pke.spinCount,
    pke.hashAlgorithm,
    BLOCK_KEYS.verifierHashValue,
    pke.keyBits,
    pke.hashSize,
  );

  // Decrypt the verifier hash value
  const iv2 = generateIV(
    pke.hashAlgorithm,
    pke.saltValue,
    BLOCK_KEYS.verifierHashValue,
    pke.blockSize,
  );
  const verifierHashValue = await aesCbcDecryptRaw(
    verifierHashKey,
    await iv2,
    pke.encryptedVerifierHashValue,
  );

  // Hash the decrypted verifier input and compare
  const computedHash = await hash(
    pke.hashAlgorithm,
    verifierHashInput.subarray(0, pke.saltSize),
  );

  // Compare hashes (only compare up to hash size)
  const expectedHash = verifierHashValue.subarray(0, pke.hashSize);
  const actualHash = computedHash.subarray(0, pke.hashSize);

  let match = true;
  for (let i = 0; i < pke.hashSize; i++) {
    if (expectedHash[i] !== actualHash[i]) {
      match = false;
      break;
    }
  }

  if (!match) return null;

  // Password verified. Now decrypt the document encryption key.
  const encKeyKey = await deriveAgileKey(
    password,
    pke.saltValue,
    pke.spinCount,
    pke.hashAlgorithm,
    BLOCK_KEYS.encryptedKeyValue,
    pke.keyBits,
    pke.hashSize,
  );

  const iv3 = await generateIV(
    pke.hashAlgorithm,
    pke.saltValue,
    BLOCK_KEYS.encryptedKeyValue,
    pke.blockSize,
  );

  const decryptedKey = await aesCbcDecryptRaw(
    encKeyKey,
    iv3,
    pke.encryptedKeyValue,
  );

  return decryptedKey.subarray(0, info.keyData.keyBits / 8);
}

/**
 * Verify the password against standard encryption info and return the
 * decryption key if valid.
 */
async function verifyStandardPassword(
  info: StandardEncryptionInfo,
  password: string,
): Promise<Uint8Array | null> {
  const key = await deriveStandardKey(
    password,
    info.verifier.salt,
    info.header.keySize,
    info.header.algIdHash,
  );

  // Decrypt the encrypted verifier
  const iv = new Uint8Array(16); // All zeros for standard encryption
  const decryptedVerifier = await aesCbcDecryptRaw(
    key,
    iv,
    info.verifier.encryptedVerifier,
  );

  // Decrypt the encrypted verifier hash
  const decryptedHash = await aesCbcDecryptRaw(
    key,
    iv,
    info.verifier.encryptedVerifierHash,
  );

  // Hash the decrypted verifier
  const computedHash = await hash("SHA-1", decryptedVerifier);

  // Compare (only first 20 bytes = SHA-1 hash size)
  const hashSize = info.verifier.verifierHashSize;
  let match = true;
  for (let i = 0; i < Math.min(hashSize, 20); i++) {
    if (computedHash[i] !== decryptedHash[i]) {
      match = false;
      break;
    }
  }

  return match ? key : null;
}

/**
 * Generate an IV for agile encryption from salt and block key.
 */
async function generateIV(
  hashAlgorithm: string,
  salt: Uint8Array,
  blockKey: Uint8Array,
  blockSize: number,
): Promise<Uint8Array> {
  const h = await hash(hashAlgorithm, concatArrays(salt, blockKey));

  if (h.length >= blockSize) {
    return h.subarray(0, blockSize);
  }

  // Pad with 0x36
  const padded = new Uint8Array(blockSize);
  padded.fill(0x36);
  padded.set(h);
  return padded;
}

/**
 * Decrypt the EncryptedPackage stream using the agile encryption key.
 *
 * The encrypted package uses segment-based encryption:
 * each 4096-byte segment is encrypted separately with a unique IV.
 */
async function decryptAgilePackage(
  encryptedPackage: Uint8Array,
  key: Uint8Array,
  info: EncryptionInfo,
): Promise<ArrayBuffer> {
  const keyData = info.keyData;

  // First 8 bytes are the actual (unencrypted) size of the original package
  const sizeView = new DataView(
    encryptedPackage.buffer,
    encryptedPackage.byteOffset,
    8,
  );
  const originalSize =
    sizeView.getUint32(0, true) +
    sizeView.getUint32(4, true) * 0x100000000;

  const encryptedData = encryptedPackage.subarray(8);
  const segmentSize = 4096;
  const result = new Uint8Array(originalSize);
  let resultOffset = 0;

  const numSegments = Math.ceil(encryptedData.length / segmentSize);

  for (let segment = 0; segment < numSegments; segment++) {
    const segmentStart = segment * segmentSize;
    const segmentEnd = Math.min(
      segmentStart + segmentSize,
      encryptedData.length,
    );
    const segmentData = encryptedData.subarray(segmentStart, segmentEnd);

    // Generate IV for this segment: H(salt + blockKey)
    const blockKeyBytes = uint32LE(segment);
    const segmentIV = await generateIV(
      keyData.hashAlgorithm,
      keyData.saltValue,
      blockKeyBytes,
      keyData.blockSize,
    );

    const decrypted = await aesCbcDecryptRaw(key, segmentIV, segmentData);

    // Copy only what's needed (last segment might be smaller)
    const bytesToCopy = Math.min(
      decrypted.length,
      originalSize - resultOffset,
    );
    result.set(decrypted.subarray(0, bytesToCopy), resultOffset);
    resultOffset += bytesToCopy;
  }

  return result.buffer;
}

/**
 * Decrypt the EncryptedPackage stream using standard encryption key.
 */
async function decryptStandardPackage(
  encryptedPackage: Uint8Array,
  key: Uint8Array,
): Promise<ArrayBuffer> {
  // First 8 bytes are the actual size
  const sizeView = new DataView(
    encryptedPackage.buffer,
    encryptedPackage.byteOffset,
    8,
  );
  const originalSize = sizeView.getUint32(0, true);

  const encryptedData = encryptedPackage.subarray(8);
  const iv = new Uint8Array(16); // All zeros for standard encryption
  const decrypted = await aesCbcDecryptRaw(key, iv, encryptedData);

  return decrypted.subarray(0, originalSize).buffer;
}

// ---------------------------------------------------------------------------
// Agile Encryption (creating encrypted files)
// ---------------------------------------------------------------------------

/**
 * Encrypt a package using the agile encryption scheme.
 */
async function encryptAgilePackage(
  packageData: Uint8Array,
  key: Uint8Array,
  info: EncryptionInfo,
): Promise<Uint8Array> {
  const keyData = info.keyData;
  const segmentSize = 4096;

  // Pad to segment boundary
  const paddedSize =
    Math.ceil(packageData.length / segmentSize) * segmentSize;
  const paddedData = new Uint8Array(paddedSize);
  paddedData.set(packageData);

  const encrypted = new Uint8Array(8 + paddedSize);

  // Write original size (8 bytes LE)
  const sizeView = new DataView(encrypted.buffer, 0, 8);
  sizeView.setUint32(0, packageData.length, true);
  sizeView.setUint32(4, 0, true);

  const numSegments = Math.ceil(paddedSize / segmentSize);

  for (let segment = 0; segment < numSegments; segment++) {
    const segmentStart = segment * segmentSize;
    const segmentEnd = segmentStart + segmentSize;
    const segmentData = paddedData.subarray(segmentStart, segmentEnd);

    const blockKeyBytes = uint32LE(segment);
    const segmentIV = await generateIV(
      keyData.hashAlgorithm,
      keyData.saltValue,
      blockKeyBytes,
      keyData.blockSize,
    );

    const encryptedSegment = await aesCbcEncryptNoPad(
      key,
      segmentIV,
      segmentData,
    );
    encrypted.set(encryptedSegment, 8 + segmentStart);
  }

  return encrypted;
}

/**
 * Generate EncryptionInfo XML for agile encryption.
 */
function buildAgileEncryptionInfoXml(
  keyData: EncryptionInfo["keyData"],
  pke: EncryptionInfo["passwordKeyEncryptor"],
  dataIntegrity: EncryptionInfo["dataIntegrity"],
): string {
  const xmlNs =
    "http://schemas.microsoft.com/office/2006/encryption";
  const pNs =
    "http://schemas.microsoft.com/office/2006/keyEncryptor/password";

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `\r\n<encryption xmlns="${xmlNs}" ` +
    `xmlns:p="${pNs}">` +
    `<keyData saltSize="${keyData.saltSize}" ` +
    `blockSize="${keyData.blockSize}" ` +
    `keyBits="${keyData.keyBits}" ` +
    `hashSize="${keyData.hashSize}" ` +
    `cipherAlgorithm="${keyData.cipherAlgorithm}" ` +
    `cipherChaining="${keyData.cipherChaining}" ` +
    `hashAlgorithm="${keyData.hashAlgorithm}" ` +
    `saltValue="${base64Encode(keyData.saltValue)}"/>` +
    `<dataIntegrity ` +
    `encryptedHmacKey="${base64Encode(dataIntegrity!.encryptedHmacKey)}" ` +
    `encryptedHmacValue="${base64Encode(dataIntegrity!.encryptedHmacValue)}"/>` +
    `<keyEncryptors>` +
    `<keyEncryptor uri="http://schemas.microsoft.com/office/2006/keyEncryptor/password">` +
    `<p:encryptedKey ` +
    `spinCount="${pke.spinCount}" ` +
    `saltSize="${pke.saltSize}" ` +
    `blockSize="${pke.blockSize}" ` +
    `keyBits="${pke.keyBits}" ` +
    `hashSize="${pke.hashSize}" ` +
    `cipherAlgorithm="${pke.cipherAlgorithm}" ` +
    `cipherChaining="${pke.cipherChaining}" ` +
    `hashAlgorithm="${pke.hashAlgorithm}" ` +
    `saltValue="${base64Encode(pke.saltValue)}" ` +
    `encryptedVerifierHashInput="${base64Encode(pke.encryptedVerifierHashInput)}" ` +
    `encryptedVerifierHashValue="${base64Encode(pke.encryptedVerifierHashValue)}" ` +
    `encryptedKeyValue="${base64Encode(pke.encryptedKeyValue)}"/>` +
    `</keyEncryptor></keyEncryptors></encryption>`
  );
}

/**
 * Build the EncryptionInfo stream bytes for agile encryption.
 */
function buildEncryptionInfoStream(xmlString: string): Uint8Array {
  const xmlBytes = new TextEncoder().encode(xmlString);
  const result = new Uint8Array(8 + xmlBytes.length);
  const view = new DataView(result.buffer);

  // Version: 4.4 (agile)
  view.setUint16(0, 4, true);
  view.setUint16(2, 4, true);
  // Reserved (must be 0x00000040 for agile)
  view.setUint32(4, 0x00000040, true);

  result.set(xmlBytes, 8);
  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Error thrown when a password is incorrect.
 */
export class IncorrectPasswordError extends Error {
  public constructor(message = "The password is incorrect.") {
    super(message);
    this.name = "IncorrectPasswordError";
  }
}

/**
 * Decrypt a password-protected PPTX file.
 *
 * The input must be an OLE2 compound file containing EncryptionInfo
 * and EncryptedPackage streams (standard OOXML encryption).
 *
 * @param encryptedBuffer - Raw bytes of the encrypted OLE2 file.
 * @param password - The document password.
 * @returns The decrypted PPTX ZIP buffer.
 * @throws IncorrectPasswordError if the password is wrong.
 * @throws Error if the file format is invalid.
 */
export async function decryptPptx(
  encryptedBuffer: ArrayBuffer,
  password: string,
): Promise<ArrayBuffer> {
  const ole2 = parseOle2(encryptedBuffer);

  const encryptionInfoStream = ole2.getStream("EncryptionInfo");
  if (!encryptionInfoStream) {
    throw new Error(
      "EncryptionInfo stream not found. The file may not be an encrypted OOXML package.",
    );
  }

  const encryptedPackage = ole2.getStream("EncryptedPackage");
  if (!encryptedPackage) {
    throw new Error(
      "EncryptedPackage stream not found. The file may be corrupted.",
    );
  }

  const info = parseEncryptionInfo(encryptionInfoStream);

  if ("isStandard" in info && info.isStandard) {
    // Standard encryption (Office 2007)
    const key = await verifyStandardPassword(info, password);
    if (!key) {
      throw new IncorrectPasswordError();
    }
    return decryptStandardPackage(encryptedPackage, key);
  }

  // Agile encryption (Office 2010+)
  const agileInfo = info as EncryptionInfo;
  const key = await verifyAgilePassword(agileInfo, password);
  if (!key) {
    throw new IncorrectPasswordError();
  }

  return decryptAgilePackage(encryptedPackage, key, agileInfo);
}

/**
 * Encrypt a PPTX file with a password.
 *
 * Creates an OLE2 compound file with EncryptionInfo and EncryptedPackage
 * streams using the OOXML agile encryption scheme (Office 2010+).
 *
 * @param pptxBuffer - Raw bytes of the unencrypted PPTX ZIP file.
 * @param password - The password to protect the file with.
 * @param options - Optional encryption settings.
 * @returns ArrayBuffer of the encrypted OLE2 file.
 */
export async function encryptPptx(
  pptxBuffer: ArrayBuffer,
  password: string,
  options?: EncryptionOptions,
): Promise<ArrayBuffer> {
  const algorithm = options?.algorithm ?? "AES256";
  const keyBits = algorithm === "AES128" ? 128 : 256;
  const crypto = getCrypto();

  // Generate random salts
  const keyDataSalt = new Uint8Array(16);
  crypto.getRandomValues(keyDataSalt);

  const pkeSalt = new Uint8Array(16);
  crypto.getRandomValues(pkeSalt);

  // Generate the document encryption key
  const documentKey = new Uint8Array(keyBits / 8);
  crypto.getRandomValues(documentKey);

  const hashAlgorithm = "SHA-512";
  const hashSize = 64;
  const blockSize = 16;
  const spinCount = 100000;

  // Derive password verification values
  // 1. Generate verifier hash input (random)
  const verifierHashInput = new Uint8Array(16);
  crypto.getRandomValues(verifierHashInput);

  // 2. Hash the verifier input
  const verifierHash = await hash(hashAlgorithm, verifierHashInput);

  // 3. Encrypt the verifier hash input
  const verifierInputKey = await deriveAgileKey(
    password,
    pkeSalt,
    spinCount,
    hashAlgorithm,
    BLOCK_KEYS.verifierHashInput,
    keyBits,
    hashSize,
  );
  const iv1 = await generateIV(
    hashAlgorithm,
    pkeSalt,
    BLOCK_KEYS.verifierHashInput,
    blockSize,
  );

  // Pad verifierHashInput to block size
  const paddedVerifierInput = new Uint8Array(
    Math.ceil(verifierHashInput.length / blockSize) * blockSize,
  );
  paddedVerifierInput.set(verifierHashInput);
  const encryptedVerifierHashInput = await aesCbcEncryptNoPad(
    verifierInputKey,
    iv1,
    paddedVerifierInput,
  );

  // 4. Encrypt the verifier hash value
  const verifierHashKey = await deriveAgileKey(
    password,
    pkeSalt,
    spinCount,
    hashAlgorithm,
    BLOCK_KEYS.verifierHashValue,
    keyBits,
    hashSize,
  );
  const iv2 = await generateIV(
    hashAlgorithm,
    pkeSalt,
    BLOCK_KEYS.verifierHashValue,
    blockSize,
  );

  const paddedVerifierHash = new Uint8Array(
    Math.ceil(verifierHash.length / blockSize) * blockSize,
  );
  paddedVerifierHash.set(verifierHash);
  const encryptedVerifierHashValue = await aesCbcEncryptNoPad(
    verifierHashKey,
    iv2,
    paddedVerifierHash,
  );

  // 5. Encrypt the document key
  const encKeyKey = await deriveAgileKey(
    password,
    pkeSalt,
    spinCount,
    hashAlgorithm,
    BLOCK_KEYS.encryptedKeyValue,
    keyBits,
    hashSize,
  );
  const iv3 = await generateIV(
    hashAlgorithm,
    pkeSalt,
    BLOCK_KEYS.encryptedKeyValue,
    blockSize,
  );

  const paddedDocumentKey = new Uint8Array(
    Math.ceil(documentKey.length / blockSize) * blockSize,
  );
  paddedDocumentKey.set(documentKey);
  const encryptedKeyValue = await aesCbcEncryptNoPad(
    encKeyKey,
    iv3,
    paddedDocumentKey,
  );

  // Build encryption info
  const encInfo: EncryptionInfo = {
    version: { major: 4, minor: 4 },
    isAgile: true,
    keyData: {
      saltSize: 16,
      blockSize,
      keyBits,
      hashSize,
      cipherAlgorithm: "AES",
      cipherChaining: "ChainingModeCBC",
      hashAlgorithm,
      saltValue: keyDataSalt,
    },
    dataIntegrity: {
      encryptedHmacKey: new Uint8Array(0), // Will be filled after encryption
      encryptedHmacValue: new Uint8Array(0),
    },
    passwordKeyEncryptor: {
      saltSize: 16,
      blockSize,
      keyBits,
      hashSize,
      cipherAlgorithm: "AES",
      cipherChaining: "ChainingModeCBC",
      hashAlgorithm,
      saltValue: pkeSalt,
      spinCount,
      encryptedVerifierHashInput,
      encryptedVerifierHashValue,
      encryptedKeyValue,
    },
  };

  // Encrypt the package
  const packageData = new Uint8Array(pptxBuffer);
  const encryptedPackage = await encryptAgilePackage(
    packageData,
    documentKey,
    encInfo,
  );

  // Compute data integrity (HMAC over encrypted package)
  // Generate HMAC key
  const hmacKeyRandom = new Uint8Array(hashSize);
  crypto.getRandomValues(hmacKeyRandom);

  // Compute HMAC of the encrypted content (excluding the 8-byte size prefix)
  const hmacValue = await hmac(
    hashAlgorithm,
    hmacKeyRandom,
    encryptedPackage.subarray(8),
  );

  // Encrypt HMAC key
  const hmacKeyIV = await generateIV(
    hashAlgorithm,
    keyDataSalt,
    BLOCK_KEYS.dataIntegrityHmacKey,
    blockSize,
  );
  const paddedHmacKey = new Uint8Array(
    Math.ceil(hmacKeyRandom.length / blockSize) * blockSize,
  );
  paddedHmacKey.set(hmacKeyRandom);
  const encryptedHmacKey = await aesCbcEncryptNoPad(
    documentKey,
    hmacKeyIV,
    paddedHmacKey,
  );

  // Encrypt HMAC value
  const hmacValueIV = await generateIV(
    hashAlgorithm,
    keyDataSalt,
    BLOCK_KEYS.dataIntegrityHmacValue,
    blockSize,
  );
  const paddedHmacValue = new Uint8Array(
    Math.ceil(hmacValue.length / blockSize) * blockSize,
  );
  paddedHmacValue.set(hmacValue);
  const encryptedHmacValue = await aesCbcEncryptNoPad(
    documentKey,
    hmacValueIV,
    paddedHmacValue,
  );

  // Update encryption info with integrity values
  encInfo.dataIntegrity = {
    encryptedHmacKey,
    encryptedHmacValue,
  };

  // Build the EncryptionInfo stream
  const xmlStr = buildAgileEncryptionInfoXml(
    encInfo.keyData,
    encInfo.passwordKeyEncryptor,
    encInfo.dataIntegrity,
  );
  const encryptionInfoBytes = buildEncryptionInfoStream(xmlStr);

  // Build OLE2 container
  const ole2Streams = new Map<string, Uint8Array>();
  ole2Streams.set("EncryptionInfo", encryptionInfoBytes);
  ole2Streams.set("EncryptedPackage", encryptedPackage);

  return buildOle2(ole2Streams);
}

/**
 * Check if a password is correct for a given encrypted file without
 * performing the full decryption.
 *
 * @param encryptedBuffer - Raw bytes of the encrypted OLE2 file.
 * @param password - The password to verify.
 * @returns True if the password is correct.
 */
export async function verifyPassword(
  encryptedBuffer: ArrayBuffer,
  password: string,
): Promise<boolean> {
  try {
    const ole2 = parseOle2(encryptedBuffer);
    const encryptionInfoStream = ole2.getStream("EncryptionInfo");
    if (!encryptionInfoStream) return false;

    const info = parseEncryptionInfo(encryptionInfoStream);

    if ("isStandard" in info && info.isStandard) {
      const key = await verifyStandardPassword(info, password);
      return key !== null;
    }

    const agileInfo = info as EncryptionInfo;
    const key = await verifyAgilePassword(agileInfo, password);
    return key !== null;
  } catch {
    return false;
  }
}

// Re-export for testing
export {
  parseEncryptionInfo as _parseEncryptionInfo,
  base64Decode as _base64Decode,
  base64Encode as _base64Encode,
  encodePasswordUtf16LE as _encodePasswordUtf16LE,
  concatArrays as _concatArrays,
};
