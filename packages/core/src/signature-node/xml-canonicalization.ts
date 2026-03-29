/**
 * XML canonicalization and DOM navigation utilities for digital signatures.
 *
 * Node-only — depends on `@xmldom/xmldom` and `xml-crypto`.
 */

import { DOMParser } from '@xmldom/xmldom';
import { SignedXml } from 'xml-crypto';

interface LocalNameNode {
	localName?: string | null;
	nodeName: string;
}

/** Get the local name of a DOM node, stripping any namespace prefix. */
export function getNodeLocalName(node: Node): string {
	const localNameNode = node as unknown as LocalNameNode;
	if (localNameNode.localName) {
		return localNameNode.localName;
	}
	const nodeName = node.nodeName || '';
	const sep = nodeName.indexOf(':');
	return sep >= 0 ? nodeName.slice(sep + 1) : nodeName;
}

/**
 * Find the first descendant element matching a local name,
 * ignoring namespace prefixes.
 */
export function getFirstDescendantElementByLocalName(
	parent: Document | Element,
	localName: string,
): Element | undefined {
	const elements = parent.getElementsByTagName('*');
	for (let index = 0; index < elements.length; index += 1) {
		const element = elements.item(index);
		if (!element) {
			continue;
		}
		if (getNodeLocalName(element) === localName) {
			return element;
		}
	}
	return undefined;
}

/**
 * Canonicalize a DOM node using the specified canonicalization algorithm.
 * Delegates to xml-crypto's C14N implementation.
 */
export function canonicalizeNode(node: Node, algorithm: string): string {
	const canonicalizer = new SignedXml();
	return canonicalizer.getCanonXml([algorithm], node);
}

/**
 * Canonicalize a `<SignedInfo>` XML fragment for signature verification.
 * Uses Exclusive XML Canonicalization (exc-c14n#).
 */
export function canonicalizeSignedInfoXml(signedInfoXml: string): string {
	const parser = new DOMParser();
	const signedInfoDoc = parser.parseFromString(signedInfoXml, 'text/xml');
	if (!signedInfoDoc.documentElement) {
		throw new Error('Unable to canonicalize SignedInfo: invalid XML.');
	}
	return canonicalizeNode(signedInfoDoc.documentElement, 'http://www.w3.org/2001/10/xml-exc-c14n#');
}
