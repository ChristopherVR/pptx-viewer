/**
 * Full PPTX digital signature inspection (Node-only).
 *
 * Orchestrates all sub-modules to analyze every signature in a PPTX package:
 * reference digest checks, certificate chain validation, OCSP revocation,
 * and timestamp authority evaluation.
 */

import JSZip from 'jszip';

import { DIGITAL_SIGNATURE_ORIGIN_REL_TYPE } from '../core/utils/signature-constants';
import {
	computeDetailStatus,
	computeVerificationStatus,
} from '../core/utils/signature-inspection-status';
import type { DigitalSignatureReport, SignatureDetail } from '../core/utils/signature-types';
import {
	extractAllTagText,
	extractFirstTagText,
	extractTagAttribute,
} from '../core/utils/signature-xml-utils';
import {
	certificateInfoFromBase64,
	validateCertificateChain,
	verifySignatureValue,
} from './certificate-utils';
import { getSignatureValidationPolicy, loadEnterpriseTrustRoots } from './environment';
import { evaluateCertificateRevocation } from './ocsp';
import {
	certFingerprintSha256,
	certPemFromBase64,
	evaluateTimestampAuthority,
} from './pki-validation';
import {
	buildReferenceChecksFromPptxViewerManifest,
	buildReferenceChecksFromSignatureXml,
} from './reference-checks';

/**
 * Inspect all digital signatures in a PPTX package.
 *
 * Performs full cryptographic verification including:
 * - Reference digest checks (standard XML-DSig + PptxViewer manifest)
 * - Signature value verification (RSA-SHA256/384/512)
 * - Certificate chain validation against system + enterprise trust roots
 * - OCSP revocation checking
 * - Timestamp authority evaluation
 *
 * @param data - The raw PPTX file bytes.
 * @returns A comprehensive digital signature report.
 */
export async function inspectPptxDigitalSignatures(
	data: Uint8Array,
): Promise<DigitalSignatureReport> {
	try {
		const zip = await JSZip.loadAsync(Buffer.from(data));
		const signaturePaths = Object.keys(zip.files).filter(
			(entryPath) => entryPath.startsWith('_xmlsignatures/') && entryPath.endsWith('.xml'),
		);
		const rootRelsXml = await zip.file('_rels/.rels')?.async('string');
		const hasOriginRelationship = Boolean(rootRelsXml?.includes(DIGITAL_SIGNATURE_ORIGIN_REL_TYPE));
		if (signaturePaths.length === 0) {
			return {
				supported: true,
				hasSignature: false,
				signatureCount: 0,
				signaturePaths: [],
				verificationStatus: 'unsigned',
				hasOriginRelationship,
			};
		}

		const additionalRootsPem = await loadEnterpriseTrustRoots();
		const policy = getSignatureValidationPolicy();
		const details: SignatureDetail[] = [];
		for (const signaturePath of signaturePaths) {
			const signatureXml = (await zip.file(signaturePath)?.async('string')) ?? '';
			const manifestChecks = await buildReferenceChecksFromPptxViewerManifest(zip, signatureXml);
			const referenceChecks =
				manifestChecks.length > 0
					? manifestChecks
					: await buildReferenceChecksFromSignatureXml(zip, signatureXml);
			const missingPartReferences = referenceChecks
				.filter((check) => check.digestStatus === 'missing-part')
				.map((check) => check.uri);
			const unsupportedTransforms = referenceChecks
				.flatMap((check) =>
					check.digestStatus === 'unsupported-transform' ? check.transformAlgorithms : [],
				)
				.filter((value, index, all) => all.indexOf(value) === index);
			const certs = extractAllTagText(signatureXml, 'X509Certificate');
			const trust = validateCertificateChain(certs, additionalRootsPem);
			const signatureValueStatus = verifySignatureValue(signatureXml, certs);
			const leafCertPem = certs.length > 0 ? certPemFromBase64(certs[0]) : undefined;
			const issuerCertPem = certs.length > 1 ? certPemFromBase64(certs[1]) : leafCertPem;
			const revocation = leafCertPem
				? await evaluateCertificateRevocation(leafCertPem, issuerCertPem)
				: {
						status: 'not-checked' as const,
						checkedOcspUrls: [],
						checkedCrlUrls: [],
					};
			const timestamp = await evaluateTimestampAuthority(signatureXml);
			const detailBase = {
				path: signaturePath,
				signatureMethod: extractTagAttribute(
					signatureXml,
					'([\\w.-]+:)?SignatureMethod',
					'Algorithm',
				),
				canonicalizationMethod: extractTagAttribute(
					signatureXml,
					'([\\w.-]+:)?CanonicalizationMethod',
					'Algorithm',
				),
				signingTime: extractFirstTagText(signatureXml, 'SigningTime'),
				referenceCount: referenceChecks.length,
				missingPartReferences,
				unsupportedTransforms,
				referenceChecks,
				certificate: certs.length > 0 ? certificateInfoFromBase64(certs[0]) : undefined,
				signatureValueStatus,
				certificateTrustStatus: trust.status,
				certificateTrustError: trust.error,
				certificateRevocationStatus: revocation.status,
				certificateRevocationError: revocation.error,
				timestampAuthorityStatus: timestamp.status,
				timestampAuthorityError: timestamp.error,
				certificateFingerprintSha256: leafCertPem ? certFingerprintSha256(leafCertPem) : undefined,
			};
			details.push({
				...detailBase,
				status: computeDetailStatus(detailBase, policy),
			});
		}

		return {
			supported: true,
			hasSignature: true,
			signatureCount: signaturePaths.length,
			signaturePaths,
			verificationStatus: computeVerificationStatus(details),
			details,
			hasOriginRelationship,
		};
	} catch (error) {
		return {
			supported: true,
			hasSignature: false,
			signatureCount: 0,
			signaturePaths: [],
			verificationStatus: 'invalid-package',
			error: `Unable to inspect digital signature parts: ${String(error)}`,
		};
	}
}
