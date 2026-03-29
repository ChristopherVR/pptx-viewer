import { DOMParser } from '@xmldom/xmldom';
import { describe, it, expect } from 'vitest';

import { extractReferenceTransforms } from './reference-transforms';

// ---------------------------------------------------------------------------
// extractReferenceTransforms
// ---------------------------------------------------------------------------

describe('extractReferenceTransforms', () => {
	const parser = new DOMParser();

	it('parses transforms with correct algorithm from a Reference element', () => {
		const xml = [
			'<ds:Reference URI="/part.xml" xmlns:ds="http://www.w3.org/2000/09/xmldsig#">',
			'  <ds:Transforms>',
			'    <ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>',
			'  </ds:Transforms>',
			'</ds:Reference>',
		].join('\n');
		const doc = parser.parseFromString(xml, 'text/xml');
		const referenceElement = doc.documentElement!;
		const transforms = extractReferenceTransforms(referenceElement);

		expect(transforms).toHaveLength(1);
		expect(transforms[0].algorithm).toBe('http://www.w3.org/2001/10/xml-exc-c14n#');
		expect(transforms[0].relationshipReferenceIds).toStrictEqual([]);
	});

	it('parses multiple transforms', () => {
		const xml = [
			'<ds:Reference URI="/part.xml" xmlns:ds="http://www.w3.org/2000/09/xmldsig#">',
			'  <ds:Transforms>',
			'    <ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>',
			'    <ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>',
			'  </ds:Transforms>',
			'</ds:Reference>',
		].join('\n');
		const doc = parser.parseFromString(xml, 'text/xml');
		const transforms = extractReferenceTransforms(doc.documentElement!);

		expect(transforms).toHaveLength(2);
		expect(transforms[0].algorithm).toBe('http://www.w3.org/2001/10/xml-exc-c14n#');
		expect(transforms[1].algorithm).toBe('http://www.w3.org/2000/09/xmldsig#enveloped-signature');
	});

	it('returns empty array when no transforms present', () => {
		const xml = '<ds:Reference URI="/part.xml" xmlns:ds="http://www.w3.org/2000/09/xmldsig#"/>';
		const doc = parser.parseFromString(xml, 'text/xml');
		const transforms = extractReferenceTransforms(doc.documentElement!);

		expect(transforms).toStrictEqual([]);
	});

	it('extracts RelationshipReference SourceId values', () => {
		const xml = [
			'<ds:Reference URI="/part.xml" xmlns:ds="http://www.w3.org/2000/09/xmldsig#">',
			'  <ds:Transforms>',
			'    <ds:Transform Algorithm="http://schemas.openxmlformats.org/package/2006/RelationshipTransform">',
			'      <mdssi:RelationshipReference xmlns:mdssi="http://schemas.openxmlformats.org/package/2006/digital-signature" SourceId="rId1"/>',
			'      <mdssi:RelationshipReference xmlns:mdssi="http://schemas.openxmlformats.org/package/2006/digital-signature" SourceId="rId2"/>',
			'    </ds:Transform>',
			'  </ds:Transforms>',
			'</ds:Reference>',
		].join('\n');
		const doc = parser.parseFromString(xml, 'text/xml');
		const transforms = extractReferenceTransforms(doc.documentElement!);

		expect(transforms).toHaveLength(1);
		expect(transforms[0].algorithm).toBe(
			'http://schemas.openxmlformats.org/package/2006/RelationshipTransform',
		);
		expect(transforms[0].relationshipReferenceIds).toStrictEqual(['rId1', 'rId2']);
	});
});
