/**
 * Type definitions for OOXML encryption and decryption.
 *
 * Contains all interfaces and type aliases used by the OOXML crypto modules.
 *
 * @module ooxml-crypto-types
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Supported encryption algorithms. */
export type EncryptionAlgorithm = 'AES128' | 'AES256';

/**
 * Which OOXML encryption scheme to write when creating a password-protected
 * file. Real PowerPoint can write and open either scheme; this library
 * defaults to 'agile' (Office 2010+), matching PowerPoint's own default.
 */
export type EncryptionScheme = 'agile' | 'standard';

/** Parsed encryption info from the EncryptionInfo stream (agile format). */
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
	/** Encryption version (major.minor). */
	version: { major: number; minor: number };
	/** Always false for standard encryption. */
	isAgile: false;
	/** Always true for standard encryption. */
	isStandard: true;
	/** Encryption flags. */
	flags: number;
	/** Size of the encryption header in bytes. */
	headerSize: number;
	/** Encryption header describing algorithm and provider. */
	header: {
		flags: number;
		algId: number;
		algIdHash: number;
		keySize: number;
		providerType: number;
		cspName: string;
	};
	/** Password verifier data. */
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
	/** The encryption algorithm to use (defaults to AES256). */
	algorithm?: EncryptionAlgorithm;
	/** Number of hash iterations for key derivation (defaults to 100000). Lower values speed up tests. */
	spinCount?: number;
	/**
	 * Which encryption scheme to write (defaults to 'agile'). 'standard'
	 * writes the ECMA-376 Standard scheme (Office 2007-compatible: a single
	 * password-derived AES-CBC key with a zero IV over the whole package),
	 * mirroring the scheme this library already knows how to decrypt.
	 */
	encryptionScheme?: EncryptionScheme;
}
