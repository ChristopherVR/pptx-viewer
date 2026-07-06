/**
 * XML canonicalization and DOM navigation utilities for digital signatures.
 *
 * Node-only — depends on `@xmldom/xmldom` and `xml-crypto`.
 *
 * All public functions use minimal structural (duck-typed) interfaces instead
 * of the standard lib.dom.d.ts types. @xmldom/xmldom's Document/Element/Node
 * types do not extend the standard DOM interfaces in TypeScript 6 (the old DOM
 * lib baked into @xmldom/xmldom's .d.ts predates properties like
 * activeViewTransition), so using the standard types causes TS2345 errors in
 * the DTS build. These structural interfaces are satisfied by both xmldom and
 * standard DOM objects at runtime.
 */

import { DOMParser } from '@xmldom/xmldom';
import { SignedXml } from 'xml-crypto';

/** A DOM element-like collection returned by getElementsByTagName. */
export interface XmlElementCollection {
	readonly length: number;
	item(index: number): XmlElement | null;
	[index: number]: XmlElement;
	[Symbol.iterator](): Iterator<XmlElement>;
}

/** Structural interface covering the @xmldom/xmldom Element operations used here. */
export interface XmlElement {
	readonly nodeName: string;
	readonly localName?: string | null;
	readonly textContent: string | null;
	readonly parentNode: { removeChild(child: XmlElement): XmlElement } | null;
	getAttribute(name: string): string | null;
	getElementsByTagName(localName: string): XmlElementCollection;
	getElementsByTagNameNS(namespaceURI: string | null, localName: string): XmlElementCollection;
}

/** Structural interface covering @xmldom/xmldom Document operations used here. */
export interface XmlDocument {
	readonly documentElement: XmlElement | null;
	getElementsByTagName(localName: string): XmlElementCollection;
	getElementsByTagNameNS(namespaceURI: string | null, localName: string): XmlElementCollection;
}

/** Get the local name of a DOM node, stripping any namespace prefix. */
export function getNodeLocalName(node: XmlElement): string {
	if (node.localName) {
		return node.localName;
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
	parent: XmlDocument | XmlElement,
	localName: string,
): XmlElement | undefined {
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
 * Accepts `any` because @xmldom/xmldom nodes are not assignable to
 * lib.dom.d.ts Node in TypeScript 6.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function canonicalizeNode(node: any, algorithm: string): string {
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
