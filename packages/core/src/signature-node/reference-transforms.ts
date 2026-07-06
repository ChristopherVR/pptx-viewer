/**
 * XML reference transform processing for digital signature verification.
 *
 * Node-only — depends on `@xmldom/xmldom` for DOM parsing and
 * `xml-crypto` (via xml-canonicalization) for C14N transforms.
 */

import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

import {
	OPC_RELATIONSHIP_TRANSFORM,
	SUPPORTED_XML_CANON_TRANSFORMS,
	XMLDSIG_NS,
} from '../core/utils/signature-constants';
import type {
	ParsedReferenceTransform,
	ReferenceTransformResult,
} from '../core/utils/signature-types';
import {
	canonicalizeNode,
	getFirstDescendantElementByLocalName,
	getNodeLocalName,
} from './xml-canonicalization';
import type { XmlDocument, XmlElement } from './xml-canonicalization';

/**
 * Parse `<ds:Transform>` elements from a `<ds:Reference>` node.
 */
export function extractReferenceTransforms(referenceNode: XmlElement): ParsedReferenceTransform[] {
	const transforms: ParsedReferenceTransform[] = [];
	const transformNodes = referenceNode.getElementsByTagNameNS(XMLDSIG_NS, 'Transform');
	for (let index = 0; index < transformNodes.length; index += 1) {
		const transformNode = transformNodes.item(index);
		if (!transformNode) {
			continue;
		}
		const algorithm = transformNode.getAttribute('Algorithm')?.trim();
		if (!algorithm) {
			continue;
		}
		const relationshipReferenceIds: string[] = [];
		const childNodes = transformNode.getElementsByTagName('*');
		for (let childIndex = 0; childIndex < childNodes.length; childIndex += 1) {
			const childNode = childNodes.item(childIndex);
			if (!childNode) {
				continue;
			}
			if (getNodeLocalName(childNode) !== 'RelationshipReference') {
				continue;
			}
			const sourceId = childNode.getAttribute('SourceId')?.trim();
			if (sourceId && sourceId.length > 0) {
				relationshipReferenceIds.push(sourceId);
			}
		}
		transforms.push({ algorithm, relationshipReferenceIds });
	}
	return transforms;
}

/**
 * Apply the OPC Relationship Transform: filter `<Relationship>` elements
 * to only those whose Id matches the given set.
 */
function applyRelationshipTransform(
	xmlText: string,
	relationshipIds: string[],
): string | undefined {
	try {
		const parser = new DOMParser();
		const serializer = new XMLSerializer();
		const doc = parser.parseFromString(xmlText, 'text/xml') as unknown as XmlDocument;
		const relationshipsRoot = getFirstDescendantElementByLocalName(doc, 'Relationships');
		if (!relationshipsRoot) {
			return undefined;
		}
		if (relationshipIds.length === 0) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			return serializer.serializeToString(doc as any);
		}
		const idSet = new Set<string>(relationshipIds);
		const relationshipNodes = Array.from(relationshipsRoot.getElementsByTagName('*')).filter(
			(node) => getNodeLocalName(node) === 'Relationship',
		);
		for (const relationshipNode of relationshipNodes) {
			const relId = relationshipNode.getAttribute('Id')?.trim();
			if (!relId || !idSet.has(relId)) {
				relationshipNode.parentNode?.removeChild(relationshipNode);
			}
		}
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return serializer.serializeToString(doc as any);
	} catch {
		return undefined;
	}
}

/**
 * Apply a chain of transforms to binary part data.
 * Supports OPC Relationship Transform and XML canonicalization algorithms.
 */
export function applyReferenceTransforms(
	partBytes: Uint8Array,
	transforms: ParsedReferenceTransform[],
): ReferenceTransformResult {
	let transformedBytes = partBytes;
	const unsupportedAlgorithms: string[] = [];
	for (const transform of transforms) {
		if (transform.algorithm === OPC_RELATIONSHIP_TRANSFORM) {
			const nextXml = applyRelationshipTransform(
				Buffer.from(transformedBytes).toString('utf8'),
				transform.relationshipReferenceIds,
			);
			if (!nextXml) {
				unsupportedAlgorithms.push(transform.algorithm);
				continue;
			}
			transformedBytes = new Uint8Array(Buffer.from(nextXml, 'utf8'));
			continue;
		}

		if (!SUPPORTED_XML_CANON_TRANSFORMS.has(transform.algorithm)) {
			unsupportedAlgorithms.push(transform.algorithm);
			continue;
		}

		try {
			const parser = new DOMParser();
			const doc = parser.parseFromString(
				Buffer.from(transformedBytes).toString('utf8'),
				'text/xml',
			) as unknown as XmlDocument;
			if (!doc.documentElement) {
				unsupportedAlgorithms.push(transform.algorithm);
				continue;
			}
			const canonical = canonicalizeNode(doc.documentElement, transform.algorithm);
			transformedBytes = new Uint8Array(Buffer.from(canonical, 'utf8'));
		} catch {
			unsupportedAlgorithms.push(transform.algorithm);
		}
	}
	return { data: transformedBytes, unsupportedAlgorithms };
}
