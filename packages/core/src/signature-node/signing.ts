/**
 * PPTX digital signature creation.
 *
 * Node-only — signs all content in a PPTX package with a certificate
 * and returns the signed data along with a verification report.
 */

import crypto from 'node:crypto';

import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import JSZip from 'jszip';

import {
	DIGITAL_SIGNATURE_ORIGIN_REL_TYPE,
	DIGITAL_SIGNATURE_REL_TYPE,
	XMLDSIG_NS,
} from '../core/utils/signature-constants';
import { normalizePartPath } from '../core/utils/signature-reference-utils';
import type {
	DigitalSignatureReport,
	OfficeSignatureReference,
	SignOptions,
	SignResult,
} from '../core/utils/signature-types';
import { escapeXmlAttr, escapeXmlText, isValidBase64 } from '../core/utils/signature-xml-utils';
import { loadSigningMaterialFromBuffer, pemCertificateToBase64 } from './certificate-utils';
import { inspectPptxDigitalSignatures } from './inspection';
import { canonicalizeSignedInfoXml } from './xml-canonicalization';

async function upsertRootOriginRelationship(zip: JSZip): Promise<void> {
	const parser = new DOMParser();
	const serializer = new XMLSerializer();
	const relsPath = '_rels/.rels';
	const xml =
		(await zip.file(relsPath)?.async('string')) ||
		'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
	const doc = parser.parseFromString(xml, 'text/xml');
	const relationships = doc.documentElement;
	if (!relationships) {
		throw new Error('Unable to sign package: invalid _rels/.rels XML.');
	}
	const existing = Array.from(relationships.getElementsByTagName('Relationship')).find(
		(node) => node.getAttribute('Type') === DIGITAL_SIGNATURE_ORIGIN_REL_TYPE,
	);
	if (!existing) {
		const rel = doc.createElement('Relationship');
		rel.setAttribute('Id', 'rIdDigitalSignatureOrigin');
		rel.setAttribute('Type', DIGITAL_SIGNATURE_ORIGIN_REL_TYPE);
		rel.setAttribute('Target', '_xmlsignatures/origin.sigs');
		relationships.appendChild(rel);
	}
	zip.file(relsPath, serializer.serializeToString(doc));
}

async function upsertContentTypesForSignature(zip: JSZip, signaturePath: string): Promise<void> {
	const parser = new DOMParser();
	const serializer = new XMLSerializer();
	const pathInContentTypes = '[Content_Types].xml';
	const xml = (await zip.file(pathInContentTypes)?.async('string')) || '';
	if (!xml) {
		return;
	}
	const doc = parser.parseFromString(xml, 'text/xml');
	const types = doc.documentElement;
	if (!types) {
		return;
	}
	const ensureOverride = (partName: string, contentType: string): void => {
		const existing = Array.from(types.getElementsByTagName('Override')).find(
			(node) => node.getAttribute('PartName') === partName,
		);
		if (existing) {
			existing.setAttribute('ContentType', contentType);
			return;
		}
		const override = doc.createElement('Override');
		override.setAttribute('PartName', partName);
		override.setAttribute('ContentType', contentType);
		types.appendChild(override);
	};
	ensureOverride(
		'/_xmlsignatures/origin.sigs',
		'application/vnd.openxmlformats-package.digital-signature-origin',
	);
	ensureOverride(
		`/${signaturePath}`,
		'application/vnd.openxmlformats-package.digital-signature-xmlsignature+xml',
	);
	zip.file(pathInContentTypes, serializer.serializeToString(doc));
}

async function buildOfficeReferenceList(zip: JSZip): Promise<OfficeSignatureReference[]> {
	const references: OfficeSignatureReference[] = [];
	const digestMethod = 'http://www.w3.org/2001/04/xmlenc#sha256';
	for (const entryPath of Object.keys(zip.files)) {
		const entry = zip.file(entryPath);
		if (!entry || entry.dir) {
			continue;
		}
		if (entryPath.startsWith('_xmlsignatures/')) {
			continue;
		}
		const entryBytes = await entry.async('uint8array');
		const digestValue = crypto
			.createHash('sha256')
			.update(Buffer.from(entryBytes))
			.digest('base64');
		references.push({
			uri: `/${normalizePartPath(entryPath)}`,
			digestMethod,
			digestValue,
		});
	}
	references.sort((left, right) => left.uri.localeCompare(right.uri));
	return references;
}

function buildOfficeSignatureXml(
	references: OfficeSignatureReference[],
	privateKeyPem: string,
	certificatePem: string,
): string {
	const signedInfoReferencesXml = references
		.map(
			(reference) =>
				`<Reference URI="${escapeXmlAttr(reference.uri)}">` +
				`<DigestMethod Algorithm="${escapeXmlAttr(reference.digestMethod)}"/>` +
				`<DigestValue>${escapeXmlText(reference.digestValue)}</DigestValue>` +
				'</Reference>',
		)
		.join('');
	const signedInfoXml =
		`<SignedInfo xmlns="${XMLDSIG_NS}">` +
		'<CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>' +
		'<SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>' +
		`${signedInfoReferencesXml}` +
		'</SignedInfo>';
	const canonicalSignedInfo = canonicalizeSignedInfoXml(signedInfoXml);
	const signer = crypto.createSign('RSA-SHA256');
	signer.update(Buffer.from(canonicalSignedInfo, 'utf8'));
	signer.end();
	const signatureValueBase64 = signer.sign(privateKeyPem).toString('base64');
	const certificateBase64 = pemCertificateToBase64(certificatePem);
	if (!isValidBase64(signatureValueBase64)) {
		throw new Error('Generated SignatureValue is not valid base64');
	}
	if (!isValidBase64(certificateBase64)) {
		throw new Error('X.509 certificate is not valid base64');
	}
	const signingTime = new Date().toISOString();
	return (
		`<Signature xmlns="${XMLDSIG_NS}">${signedInfoXml}` +
		`<SignatureValue>${escapeXmlText(signatureValueBase64)}</SignatureValue>` +
		`<KeyInfo><X509Data><X509Certificate>${escapeXmlText(certificateBase64)}</X509Certificate></X509Data></KeyInfo>` +
		`<Object><SignatureProperties><SignatureProperty>` +
		`<SigningTime>${escapeXmlText(signingTime)}</SigningTime>` +
		`</SignatureProperty></SignatureProperties></Object></Signature>`
	);
}

/**
 * Sign all content in a PPTX package with a certificate.
 *
 * Removes any existing signatures, creates a new XML-DSig signature
 * covering all non-signature parts, and returns the signed data
 * along with a post-sign verification report.
 */
export async function signPptxWithCertificate(
	data: Uint8Array,
	certificateBuffer: Uint8Array,
	options: SignOptions,
): Promise<SignResult> {
	try {
		const signing = loadSigningMaterialFromBuffer(
			certificateBuffer,
			options.certificatePath,
			options.certificatePassword,
		);
		const zip = await JSZip.loadAsync(Buffer.from(data));

		for (const entryPath of Object.keys(zip.files)) {
			if (entryPath.startsWith('_xmlsignatures/')) {
				zip.remove(entryPath);
			}
		}

		const signaturePath = '_xmlsignatures/sig1.xml';
		await upsertRootOriginRelationship(zip);
		await upsertContentTypesForSignature(zip, signaturePath);
		const references = await buildOfficeReferenceList(zip);
		const signatureXml = buildOfficeSignatureXml(
			references,
			signing.privateKeyPem,
			signing.certificatePem,
		);
		zip.file(signaturePath, signatureXml);
		zip.file('_xmlsignatures/origin.sigs', '<SignatureOrigin/>');
		zip.file(
			'_xmlsignatures/_rels/origin.sigs.rels',
			`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdSig1" Type="${DIGITAL_SIGNATURE_REL_TYPE}" Target="sig1.xml"/></Relationships>`,
		);

		const signedData = await zip.generateAsync({ type: 'uint8array' });
		const report = await inspectPptxDigitalSignatures(signedData);
		return { success: true, signedData, report };
	} catch (error) {
		const errorReport: DigitalSignatureReport = {
			supported: true,
			hasSignature: false,
			signatureCount: 0,
			signaturePaths: [],
			verificationStatus: 'error',
			error: `Failed to sign PPTX: ${String(error)}`,
		};
		return {
			success: false,
			report: errorReport,
			error: `Failed to sign PPTX: ${String(error)}`,
		};
	}
}
