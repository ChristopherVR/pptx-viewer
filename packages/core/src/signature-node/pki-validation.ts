/**
 * PKI validation utilities — PEM/fingerprint certificate helpers and
 * timestamp-authority evaluation for OOXML digital signatures.
 *
 * OCSP revocation checking lives in `./ocsp.ts`.
 *
 * Node-only — depends on `node:crypto` and `node-forge`.
 */

import crypto from 'node:crypto';

import forge from 'node-forge';

import type { TimestampAuthorityStatus } from '../core/utils/signature-types';
import { findTimestampTagContent } from './timestamp-tag-scanner';

// ---------------------------------------------------------------------------
// Certificate helpers
// ---------------------------------------------------------------------------

/** Wrap a Base64-encoded DER certificate in PEM armour. */
export function certPemFromBase64(certBase64: string): string | undefined {
	try {
		const der = Buffer.from(certBase64, 'base64');
		if (der.length === 0) {
			return undefined;
		}
		const b64 = der.toString('base64');
		const lines = b64.match(/.{1,64}/g);
		if (!lines) {
			return undefined;
		}
		return `-----BEGIN CERTIFICATE-----\n${lines.join('\n')}\n-----END CERTIFICATE-----`;
	} catch {
		return undefined;
	}
}

/** SHA-256 fingerprint of a PEM certificate (lowercase hex, no colons). */
export function certFingerprintSha256(certPem: string): string | undefined {
	try {
		const cert = new crypto.X509Certificate(certPem);
		return cert.fingerprint256.replace(/:/g, '').toLowerCase();
	} catch {
		return undefined;
	}
}

// ---------------------------------------------------------------------------
// ASN.1 navigation helpers
// ---------------------------------------------------------------------------

function asn1Child(node: forge.asn1.Asn1, index: number): forge.asn1.Asn1 | undefined {
	return Array.isArray(node.value) ? (node.value[index] as forge.asn1.Asn1 | undefined) : undefined;
}

// ---------------------------------------------------------------------------
// Public: timestamp authority evaluation
// ---------------------------------------------------------------------------

export async function evaluateTimestampAuthority(
	signatureXml: string,
): Promise<{ status: TimestampAuthorityStatus; error?: string }> {
	try {
		const content = findTimestampTagContent(signatureXml);
		if (!content?.trim()) {
			return { status: 'not-present' };
		}
		const tokenBase64 = content.replace(/\s+/g, '');
		const tokenDer = Buffer.from(tokenBase64, 'base64');
		if (tokenDer.length === 0) {
			return { status: 'invalid', error: 'Empty timestamp token.' };
		}
		const asn1 = forge.asn1.fromDer(forge.util.createBuffer(tokenDer.toString('binary')));
		const contentType = asn1Child(asn1, 0);
		if (!contentType) {
			return {
				status: 'invalid',
				error: 'Malformed timestamp token structure.',
			};
		}
		return { status: 'valid' };
	} catch (err) {
		return {
			status: 'error',
			error: `Timestamp evaluation failed: ${String(err)}`,
		};
	}
}
