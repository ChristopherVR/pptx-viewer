/**
 * Certificate handling utilities for digital signature processing.
 *
 * Node-only — depends on `node:crypto`, `node:tls`, `node-forge`, `@xmldom/xmldom`.
 */

import crypto from 'node:crypto';
import path from 'node:path';
import tls from 'node:tls';

import { DOMParser } from '@xmldom/xmldom';
import forge from 'node-forge';

import { XMLDSIG_NS } from '../core/utils/signature-constants';
import type {
	LoadedSigningMaterial,
	SignatureCertificateInfo,
} from '../core/utils/signature-types';
import { extractFirstPemBlock } from './pem-utils';
import { certPemFromBase64 } from './pki-validation';
import { canonicalizeNode } from './xml-canonicalization';
import type { XmlDocument } from './xml-canonicalization';

const PRIVATE_KEY_PEM_LABELS = [
	'RSA PRIVATE KEY',
	'EC PRIVATE KEY',
	'ENCRYPTED PRIVATE KEY',
	'PRIVATE KEY',
];

/** Extract certificate metadata from a Base64-encoded DER certificate. */
export function certificateInfoFromBase64(
	certBase64: string,
): SignatureCertificateInfo | undefined {
	try {
		const certificate = new crypto.X509Certificate(Buffer.from(certBase64, 'base64'));
		return {
			subject: certificate.subject || undefined,
			issuer: certificate.issuer || undefined,
			serialNumber: certificate.serialNumber || undefined,
			validFrom: certificate.validFrom || undefined,
			validTo: certificate.validTo || undefined,
		};
	} catch {
		return undefined;
	}
}

/**
 * Validate a certificate chain against system trust roots and optional additional roots.
 */
export function validateCertificateChain(
	certBase64List: string[],
	additionalRootsPem: string[],
): {
	status: 'trusted' | 'untrusted' | 'not-checked';
	error?: string;
} {
	if (certBase64List.length === 0) {
		return { status: 'not-checked' };
	}
	try {
		const chain = certBase64List.map((value) => {
			const der = forge.util.decode64(value);
			return forge.pki.certificateFromAsn1(forge.asn1.fromDer(der));
		});
		const rootPem = [...tls.rootCertificates, ...additionalRootsPem];
		const caStore = forge.pki.createCaStore(rootPem);
		const verified = forge.pki.verifyCertificateChain(caStore, chain);
		return verified
			? { status: 'trusted' }
			: {
					status: 'untrusted',
					error: 'Certificate chain is not trusted.',
				};
	} catch (error) {
		return {
			status: 'untrusted',
			error: `Certificate trust validation failed: ${String(error)}`,
		};
	}
}

function signatureAlgorithmToVerifyAlgorithm(
	signatureMethod: string | undefined,
): string | undefined {
	switch (signatureMethod) {
		case 'http://www.w3.org/2000/09/xmldsig#rsa-sha1':
			return 'RSA-SHA1';
		case 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256':
			return 'RSA-SHA256';
		case 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha384':
			return 'RSA-SHA384';
		case 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha512':
			return 'RSA-SHA512';
		default:
			return undefined;
	}
}

/**
 * Cryptographically verify the SignatureValue in an XML signature
 * using the embedded certificate.
 */
export function verifySignatureValue(
	signatureXml: string,
	certBase64List: string[],
): 'verified' | 'invalid' | 'not-checked' {
	try {
		const parser = new DOMParser();
		const doc = parser.parseFromString(signatureXml, 'text/xml') as unknown as XmlDocument;
		const signatureNode = doc.getElementsByTagNameNS(XMLDSIG_NS, 'Signature')[0];
		if (!signatureNode) {
			return 'not-checked';
		}
		const certPem = certBase64List.length > 0 ? certPemFromBase64(certBase64List[0]) : undefined;
		if (!certPem) {
			return 'not-checked';
		}
		const signedInfoNode = doc.getElementsByTagNameNS(XMLDSIG_NS, 'SignedInfo')[0];
		const signatureValueNode = doc.getElementsByTagNameNS(XMLDSIG_NS, 'SignatureValue')[0];
		if (!signedInfoNode || !signatureValueNode) {
			return 'invalid';
		}
		const canonicalizationMethod =
			doc
				.getElementsByTagNameNS(XMLDSIG_NS, 'CanonicalizationMethod')
				.item(0)
				?.getAttribute('Algorithm') ?? 'http://www.w3.org/2001/10/xml-exc-c14n#';
		const signatureMethod = doc
			.getElementsByTagNameNS(XMLDSIG_NS, 'SignatureMethod')
			.item(0)
			?.getAttribute('Algorithm');
		const verifyAlgorithm = signatureAlgorithmToVerifyAlgorithm(signatureMethod ?? undefined);
		if (!verifyAlgorithm) {
			return 'invalid';
		}
		const canonicalSignedInfo = canonicalizeNode(signedInfoNode, canonicalizationMethod);
		const signatureValueBase64 = signatureValueNode.textContent?.replace(/\s+/g, '').trim() ?? '';
		if (signatureValueBase64.length === 0) {
			return 'invalid';
		}
		const verifier = crypto.createVerify(verifyAlgorithm);
		verifier.update(Buffer.from(canonicalSignedInfo, 'utf8'));
		verifier.end();
		const isValid = verifier.verify(certPem, Buffer.from(signatureValueBase64, 'base64'));
		return isValid ? 'verified' : 'invalid';
	} catch {
		return 'invalid';
	}
}

/**
 * Load a private key and certificate from a PKCS#12 (.pfx/.p12) or PEM buffer.
 */
export function loadSigningMaterialFromBuffer(
	certificateBuffer: Uint8Array,
	certificatePath: string,
	certificatePassword?: string,
): LoadedSigningMaterial {
	const extension = path.extname(certificatePath).toLowerCase();
	if (extension === '.pfx' || extension === '.p12') {
		const p12Der = forge.util.createBuffer(Buffer.from(certificateBuffer).toString('binary'));
		const p12Asn1 = forge.asn1.fromDer(p12Der);
		const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, certificatePassword || '');
		const keyBag = p12.getBags({
			bagType: forge.pki.oids.pkcs8ShroudedKeyBag,
		})[forge.pki.oids.pkcs8ShroudedKeyBag];
		const certBag = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag];
		if (!keyBag || keyBag.length === 0 || !keyBag[0]?.key) {
			throw new Error('No private key found in PKCS#12 certificate.');
		}
		if (!certBag || certBag.length === 0 || !certBag[0]?.cert) {
			throw new Error('No certificate found in PKCS#12 certificate.');
		}
		return {
			privateKeyPem: forge.pki.privateKeyToPem(keyBag[0].key),
			certificatePem: forge.pki.certificateToPem(certBag[0].cert),
		};
	}

	const pem = Buffer.from(certificateBuffer).toString('utf8');
	const privateKeyPem = extractFirstPemBlock(pem, PRIVATE_KEY_PEM_LABELS);
	const certificatePem = extractFirstPemBlock(pem, ['CERTIFICATE']);
	if (!privateKeyPem || !certificatePem) {
		throw new Error('PEM certificate must contain both private key and certificate.');
	}
	return {
		privateKeyPem,
		certificatePem,
	};
}

/** Convert a PEM certificate to Base64-encoded DER (strip armour + whitespace). */
export function pemCertificateToBase64(pem: string): string {
	return pem
		.replace(/-----BEGIN CERTIFICATE-----/g, '')
		.replace(/-----END CERTIFICATE-----/g, '')
		.replace(/\s+/g, '')
		.trim();
}
