import { describe, it, expect } from 'vitest';

import { normalizePartPath, resolveReferenceUriToPart } from './signature-reference-utils';

describe('normalizePartPath', () => {
	it('converts backslashes to forward slashes', () => {
		expect(normalizePartPath('ppt\\slides\\slide1.xml')).toBe('ppt/slides/slide1.xml');
	});

	it('strips leading forward slashes', () => {
		expect(normalizePartPath('/ppt/slides/slide1.xml')).toBe('ppt/slides/slide1.xml');
	});

	it('strips multiple leading forward slashes', () => {
		expect(normalizePartPath('///ppt/slides/slide1.xml')).toBe('ppt/slides/slide1.xml');
	});

	it('handles backslashes and leading slashes together', () => {
		expect(normalizePartPath('\\ppt\\slides\\slide1.xml')).toBe('ppt/slides/slide1.xml');
	});

	it('returns the same string when already normalized', () => {
		expect(normalizePartPath('ppt/slides/slide1.xml')).toBe('ppt/slides/slide1.xml');
	});

	it('handles an empty string', () => {
		expect(normalizePartPath('')).toBe('');
	});
});

describe('resolveReferenceUriToPart', () => {
	it('returns undefined for an empty string', () => {
		expect(resolveReferenceUriToPart('')).toBeUndefined();
	});

	it('returns undefined for whitespace-only input', () => {
		expect(resolveReferenceUriToPart('   ')).toBeUndefined();
	});

	it('returns undefined for a fragment-only URI', () => {
		expect(resolveReferenceUriToPart('#idPackageObject')).toBeUndefined();
	});

	it('returns undefined for a fragment-only URI with complex fragment', () => {
		expect(resolveReferenceUriToPart('#_xmlsignatures/sig1')).toBeUndefined();
	});

	it('resolves a URI with a leading slash', () => {
		expect(resolveReferenceUriToPart('/ppt/slides/slide1.xml')).toBe('ppt/slides/slide1.xml');
	});

	it('resolves a normal relative path', () => {
		expect(resolveReferenceUriToPart('ppt/slides/slide1.xml')).toBe('ppt/slides/slide1.xml');
	});

	it('decodes URL-encoded characters', () => {
		expect(resolveReferenceUriToPart('/ppt/slides/slide%201.xml')).toBe('ppt/slides/slide 1.xml');
	});

	it('decodes percent-encoded special characters', () => {
		expect(resolveReferenceUriToPart('/ppt/%5BContent_Types%5D.xml')).toBe(
			'ppt/[Content_Types].xml',
		);
	});

	it('handles a URI with query-like content type suffix', () => {
		const result = resolveReferenceUriToPart('/ppt/presentation.xml?ContentType=application/xml');
		expect(result).toBe('ppt/presentation.xml?ContentType=application/xml');
	});

	it('trims surrounding whitespace before processing', () => {
		expect(resolveReferenceUriToPart('  /ppt/slides/slide1.xml  ')).toBe('ppt/slides/slide1.xml');
	});
});
