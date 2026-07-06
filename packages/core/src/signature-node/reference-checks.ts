/**
 * Full reference digest verification for digital signatures.
 *
 * Node-only — uses `node:crypto` for synchronous hashing,
 * `jszip` for ZIP access, and `@xmldom/xmldom` for DOM parsing.
 */

import crypto from 'node:crypto';

import { DOMParser } from '@xmldom/xmldom';
import type JSZip from 'jszip';

import {
	DIGEST_ALGORITHM_TO_HASH,
	PPTX_VIEWER_MANIFEST_NS,
	XMLDSIG_NS,
} from '../core/utils/signature-constants';
import { resolveReferenceUriToPart } from '../core/utils/signature-reference-utils';
import type { SignatureReferenceCheck } from '../core/utils/signature-types';
import { extractReferenceTransforms, applyReferenceTransforms } from './reference-transforms';
import { getFirstDescendantElementByLocalName } from './xml-canonicalization';
import type { XmlDocument } from './xml-canonicalization';

/**
 * Compute a Base64-encoded digest using Node.js `crypto` (synchronous).
 */
export function computeDigestBase64(
	content: Uint8Array,
	digestAlgorithmUri: string,
): string | undefined {
	const hashName = DIGEST_ALGORITHM_TO_HASH[digestAlgorithmUri];
	if (!hashName) {
		return undefined;
	}
	return crypto.createHash(hashName).update(Buffer.from(content)).digest('base64');
}

/**
 * Verify all `<ds:Reference>` digests in an XML signature.
 */
export async function buildReferenceChecksFromSignatureXml(
	zip: JSZip,
	signatureXml: string,
): Promise<SignatureReferenceCheck[]> {
	const parser = new DOMParser();
	const doc = parser.parseFromString(signatureXml, 'text/xml') as unknown as XmlDocument;
	const referenceNodes = doc.getElementsByTagNameNS(XMLDSIG_NS, 'Reference');
	const checks: SignatureReferenceCheck[] = [];
	for (let index = 0; index < referenceNodes.length; index += 1) {
		const referenceNode = referenceNodes.item(index);
		if (!referenceNode) {
			continue;
		}
		const uri = referenceNode.getAttribute('URI')?.trim() ?? '';
		const digestMethodNode = getFirstDescendantElementByLocalName(referenceNode, 'DigestMethod');
		const digestValueNode = getFirstDescendantElementByLocalName(referenceNode, 'DigestValue');
		const digestAlgorithm = digestMethodNode?.getAttribute('Algorithm')?.trim();
		const digestExpectedBase64 = digestValueNode?.textContent?.replace(/\s+/g, '').trim();
		const transforms = extractReferenceTransforms(referenceNode);
		const transformAlgorithms = transforms.map((transform) => transform.algorithm);
		const resolvedPartPath = resolveReferenceUriToPart(uri);
		if (!resolvedPartPath) {
			checks.push({
				uri,
				existsInPackage: true,
				digestAlgorithm,
				digestExpectedBase64,
				digestStatus: 'insufficient-data',
				transformAlgorithms,
			});
			continue;
		}
		const part = zip.file(resolvedPartPath);
		if (!part) {
			checks.push({
				uri,
				resolvedPartPath,
				existsInPackage: false,
				digestAlgorithm,
				digestExpectedBase64,
				digestStatus: 'missing-part',
				transformAlgorithms,
			});
			continue;
		}
		if (!digestAlgorithm || !digestExpectedBase64) {
			checks.push({
				uri,
				resolvedPartPath,
				existsInPackage: true,
				digestAlgorithm,
				digestExpectedBase64,
				digestStatus: 'insufficient-data',
				transformAlgorithms,
			});
			continue;
		}
		const rawContent = await part.async('uint8array');
		const transformed = applyReferenceTransforms(rawContent, transforms);
		if (transformed.unsupportedAlgorithms.length > 0) {
			checks.push({
				uri,
				resolvedPartPath,
				existsInPackage: true,
				digestAlgorithm,
				digestExpectedBase64,
				digestStatus: 'unsupported-transform',
				transformAlgorithms,
			});
			continue;
		}
		const digestActualBase64 = computeDigestBase64(transformed.data, digestAlgorithm);
		if (!digestActualBase64) {
			checks.push({
				uri,
				resolvedPartPath,
				existsInPackage: true,
				digestAlgorithm,
				digestExpectedBase64,
				digestStatus: 'unsupported-algorithm',
				transformAlgorithms,
			});
			continue;
		}
		checks.push({
			uri,
			resolvedPartPath,
			existsInPackage: true,
			digestAlgorithm,
			digestExpectedBase64,
			digestActualBase64,
			digestStatus: digestActualBase64 === digestExpectedBase64 ? 'verified' : 'mismatch',
			transformAlgorithms,
		});
	}
	return checks;
}

/**
 * Verify references from a PptxViewer manifest extension in the signature XML.
 */
export async function buildReferenceChecksFromPptxViewerManifest(
	zip: JSZip,
	signatureXml: string,
): Promise<SignatureReferenceCheck[]> {
	const parser = new DOMParser();
	const doc = parser.parseFromString(signatureXml, 'text/xml');
	const partNodes = Array.from(doc.getElementsByTagNameNS(PPTX_VIEWER_MANIFEST_NS, 'Part'));
	const checks: SignatureReferenceCheck[] = [];
	for (const partNode of partNodes) {
		const rawName = partNode.getAttribute('Name') || '';
		const digestAlgorithm = partNode.getAttribute('DigestMethod') || undefined;
		const digestExpectedBase64 = partNode.getAttribute('DigestValue') || undefined;
		const resolvedPartPath = resolveReferenceUriToPart(rawName);
		if (!resolvedPartPath) {
			checks.push({
				uri: rawName,
				existsInPackage: true,
				digestAlgorithm,
				digestExpectedBase64,
				digestStatus: 'insufficient-data',
				transformAlgorithms: [],
			});
			continue;
		}
		const partFile = zip.file(resolvedPartPath);
		if (!partFile) {
			checks.push({
				uri: rawName,
				resolvedPartPath,
				existsInPackage: false,
				digestAlgorithm,
				digestExpectedBase64,
				digestStatus: 'missing-part',
				transformAlgorithms: [],
			});
			continue;
		}
		if (!digestAlgorithm || !digestExpectedBase64) {
			checks.push({
				uri: rawName,
				resolvedPartPath,
				existsInPackage: true,
				digestAlgorithm,
				digestExpectedBase64,
				digestStatus: 'insufficient-data',
				transformAlgorithms: [],
			});
			continue;
		}
		const partBytes = await partFile.async('uint8array');
		const actualDigest = computeDigestBase64(partBytes, digestAlgorithm);
		if (!actualDigest) {
			checks.push({
				uri: rawName,
				resolvedPartPath,
				existsInPackage: true,
				digestAlgorithm,
				digestExpectedBase64,
				digestStatus: 'unsupported-algorithm',
				transformAlgorithms: [],
			});
			continue;
		}
		checks.push({
			uri: rawName,
			resolvedPartPath,
			existsInPackage: true,
			digestAlgorithm,
			digestExpectedBase64,
			digestActualBase64: actualDigest,
			digestStatus: actualDigest === digestExpectedBase64 ? 'verified' : 'mismatch',
			transformAlgorithms: [],
		});
	}
	return checks;
}
