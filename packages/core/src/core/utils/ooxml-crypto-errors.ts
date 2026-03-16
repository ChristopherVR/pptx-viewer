/**
 * Error classes for OOXML encryption operations.
 *
 * @module ooxml-crypto-errors
 */

/**
 * Error thrown when a password is incorrect.
 *
 * Indicates that the supplied password did not match the password verifier
 * stored in the encrypted file's EncryptionInfo stream.
 */
export class IncorrectPasswordError extends Error {
	public constructor(message = 'The password is incorrect.') {
		super(message);
		this.name = 'IncorrectPasswordError';
	}
}

/**
 * Error thrown when data integrity verification fails.
 *
 * This indicates the encrypted file may be corrupted or tampered with.
 * The HMAC computed over the encrypted package data did not match
 * the HMAC stored in the EncryptionInfo stream.
 */
export class DataIntegrityError extends Error {
	public constructor(
		message = 'Data integrity check failed. The encrypted file may be corrupted or tampered with.',
	) {
		super(message);
		this.name = 'DataIntegrityError';
	}
}
