/**
 * PKI validation utilities — certificate revocation (OCSP) and
 * timestamp-authority evaluation for OOXML digital signatures.
 *
 * Node-only — depends on `node:crypto`, `node:http`, `node:https`, and `node-forge`.
 */

import crypto from 'node:crypto';
import http from 'node:http';
import https from 'node:https';

import forge from 'node-forge';

import type {
	CertificateRevocationStatus,
	TimestampAuthorityStatus,
} from '../core/utils/signature-types';

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

function asn1Bytes(node: forge.asn1.Asn1): string {
	return typeof node.value === 'string' ? node.value : '';
}

// ---------------------------------------------------------------------------
// Internal: extract OCSP responder URLs from AIA extension
// ---------------------------------------------------------------------------

export function extractOcspUrls(certPem: string): string[] {
	try {
		const cert = new crypto.X509Certificate(certPem);
		const infoAccess = cert.infoAccess;
		if (!infoAccess) {
			return [];
		}
		const urls: string[] = [];
		for (const line of infoAccess.split('\n')) {
			const match = /OCSP\s*-\s*URI:(https?:\/\/\S+)/i.exec(line.trim());
			if (match?.[1]) {
				urls.push(match[1]);
			}
		}
		return urls;
	} catch {
		return [];
	}
}

// ---------------------------------------------------------------------------
// Internal: HTTP POST with timeout
// ---------------------------------------------------------------------------

const HTTP_TIMEOUT_MS = 10_000;

function httpPost(url: string, body: Buffer, contentType: string): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		let parsed: URL;
		try {
			parsed = new URL(url);
		} catch {
			reject(new Error('Invalid URL'));
			return;
		}
		if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
			reject(new Error('Unsupported protocol'));
			return;
		}
		const transport = parsed.protocol === 'https:' ? https : http;
		const req = transport.request(
			{
				hostname: parsed.hostname,
				port: parsed.port || undefined,
				path: parsed.pathname + parsed.search,
				method: 'POST',
				headers: {
					'Content-Type': contentType,
					'Content-Length': body.length,
				},
				timeout: HTTP_TIMEOUT_MS,
			},
			(res) => {
				const chunks: Buffer[] = [];
				res.on('data', (chunk: Buffer) => chunks.push(chunk));
				res.on('end', () => resolve(Buffer.concat(chunks)));
				res.on('error', reject);
			},
		);
		req.on('error', reject);
		req.on('timeout', () => {
			req.destroy();
			reject(new Error('Timeout'));
		});
		req.write(body);
		req.end();
	});
}

// ---------------------------------------------------------------------------
// Internal: OCSP request / response
// ---------------------------------------------------------------------------

const SHA1_OID = '1.3.14.3.2.26';

export function buildOcspRequestDer(leafPem: string, issuerPem: string): Buffer | undefined {
	try {
		const leaf = forge.pki.certificateFromPem(leafPem);
		const issuer = forge.pki.certificateFromPem(issuerPem);

		const issuerNameDer = forge.asn1
			.toDer(forge.pki.distinguishedNameToAsn1(issuer.subject))
			.getBytes();
		const issuerNameHash = forge.md.sha1.create().update(issuerNameDer).digest().getBytes();

		const pubKeyDer = forge.asn1.toDer(forge.pki.publicKeyToAsn1(issuer.publicKey)).getBytes();
		const pubKeyAsn1 = forge.asn1.fromDer(pubKeyDer);
		const bitString = asn1Child(pubKeyAsn1, 1);
		const rawKey = bitString ? asn1Bytes(bitString).substring(1) : '';
		const issuerKeyHash = forge.md.sha1.create().update(rawKey).digest().getBytes();

		const serialBytes = forge.util.hexToBytes(leaf.serialNumber);

		const request = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
			forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
				forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
					forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
						forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
							forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
								forge.asn1.create(
									forge.asn1.Class.UNIVERSAL,
									forge.asn1.Type.OID,
									false,
									forge.asn1.oidToDer(SHA1_OID).getBytes(),
								),
								forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.NULL, false, ''),
							]),
							forge.asn1.create(
								forge.asn1.Class.UNIVERSAL,
								forge.asn1.Type.OCTETSTRING,
								false,
								issuerNameHash,
							),
							forge.asn1.create(
								forge.asn1.Class.UNIVERSAL,
								forge.asn1.Type.OCTETSTRING,
								false,
								issuerKeyHash,
							),
							forge.asn1.create(
								forge.asn1.Class.UNIVERSAL,
								forge.asn1.Type.INTEGER,
								false,
								serialBytes,
							),
						]),
					]),
				]),
			]),
		]);

		return Buffer.from(forge.asn1.toDer(request).getBytes(), 'binary');
	} catch {
		return undefined;
	}
}

export function parseOcspResponseStatus(data: Buffer): CertificateRevocationStatus {
	try {
		const asn1 = forge.asn1.fromDer(forge.util.createBuffer(data.toString('binary')));
		const statusNode = asn1Child(asn1, 0);
		if (!statusNode || asn1Bytes(statusNode) !== '\x00') {
			return 'error';
		}

		const respBytesWrapper = asn1Child(asn1, 1);
		if (!respBytesWrapper) {
			return 'unknown';
		}
		const respBytesSeq = asn1Child(respBytesWrapper, 0);
		if (!respBytesSeq) {
			return 'unknown';
		}
		const respOctet = asn1Child(respBytesSeq, 1);
		if (!respOctet) {
			return 'unknown';
		}

		const basicResp = forge.asn1.fromDer(forge.util.createBuffer(asn1Bytes(respOctet)));
		const tbsData = asn1Child(basicResp, 0);
		if (!tbsData) {
			return 'unknown';
		}

		const first = asn1Child(tbsData, 0);
		const responsesIdx =
			first?.tagClass === forge.asn1.Class.CONTEXT_SPECIFIC && first.type === 0 ? 3 : 2;
		const responses = asn1Child(tbsData, responsesIdx);
		if (!responses) {
			return 'unknown';
		}

		const single = asn1Child(responses, 0);
		if (!single) {
			return 'unknown';
		}
		const certStatus = asn1Child(single, 1);
		if (!certStatus) {
			return 'unknown';
		}

		if (certStatus.tagClass === forge.asn1.Class.CONTEXT_SPECIFIC) {
			if (certStatus.type === 0) {
				return 'good';
			}
			if (certStatus.type === 1) {
				return 'revoked';
			}
		}
		return 'unknown';
	} catch {
		return 'error';
	}
}

// ---------------------------------------------------------------------------
// Public: certificate revocation check
// ---------------------------------------------------------------------------

export async function evaluateCertificateRevocation(
	leafCertPem: string,
	issuerCertPem: string | undefined,
): Promise<{
	status: CertificateRevocationStatus;
	error?: string;
	checkedOcspUrls: string[];
	checkedCrlUrls: string[];
}> {
	const ocspUrls = extractOcspUrls(leafCertPem);
	const checkedOcspUrls: string[] = [];
	const checkedCrlUrls: string[] = [];

	if (issuerCertPem && ocspUrls.length > 0) {
		const reqDer = buildOcspRequestDer(leafCertPem, issuerCertPem);
		if (reqDer) {
			for (const url of ocspUrls) {
				checkedOcspUrls.push(url);
				try {
					const resp = await httpPost(url, reqDer, 'application/ocsp-request');
					const status = parseOcspResponseStatus(resp);
					if (status === 'good' || status === 'revoked') {
						return { status, checkedOcspUrls, checkedCrlUrls };
					}
				} catch {
					/* continue to next responder */
				}
			}
		}
	}

	if (checkedOcspUrls.length === 0) {
		return { status: 'not-checked', checkedOcspUrls, checkedCrlUrls };
	}
	return {
		status: 'unknown',
		error: 'Could not determine revocation status from available responders.',
		checkedOcspUrls,
		checkedCrlUrls,
	};
}

// ---------------------------------------------------------------------------
// Public: timestamp authority evaluation
// ---------------------------------------------------------------------------

const TIMESTAMP_TAG_REGEX =
	/<(?:[\w.-]+:)?(?:EncapsulatedTimeStamp|SignatureTimeStamp)[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?(?:EncapsulatedTimeStamp|SignatureTimeStamp)>/i;

export async function evaluateTimestampAuthority(
	signatureXml: string,
): Promise<{ status: TimestampAuthorityStatus; error?: string }> {
	try {
		const match = TIMESTAMP_TAG_REGEX.exec(signatureXml);
		if (!match?.[1]?.trim()) {
			return { status: 'not-present' };
		}
		const tokenBase64 = match[1].replace(/\s+/g, '');
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
