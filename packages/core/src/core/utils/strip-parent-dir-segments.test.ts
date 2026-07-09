import { describe, it, expect } from 'vitest';

import { stripParentDirSegments } from './strip-parent-dir-segments';

describe('stripParentDirSegments', () => {
	it('returns strings with no ../ unchanged', () => {
		expect(stripParentDirSegments('slideLayouts/slideLayout1.xml')).toBe(
			'slideLayouts/slideLayout1.xml',
		);
	});

	it('removes a single ../ occurrence', () => {
		expect(stripParentDirSegments('foo/../bar')).toBe('foo/bar');
	});

	it('removes multiple non-overlapping ../ occurrences', () => {
		expect(stripParentDirSegments('../foo/../bar/../baz')).toBe('foo/bar/baz');
	});

	it('removes ../ sequences reconstructed by deleting an inner match', () => {
		// A single global-regex pass deletes the middle "../" and leaves the
		// remaining ".." and "/" adjacent, reforming a "../" that a naive
		// single-pass sanitizer would miss.
		expect(stripParentDirSegments('....//')).toBe('');
	});

	it('never leaves a ../ substring behind, however deep the reconstruction chain', () => {
		for (const input of [
			'......//',
			'.'.repeat(20) + '/'.repeat(10),
			'.'.repeat(37) + '/'.repeat(19),
		]) {
			expect(stripParentDirSegments(input)).not.toContain('../');
		}
	});

	it('handles an empty string', () => {
		expect(stripParentDirSegments('')).toBe('');
	});

	it('leaves unrelated dots and slashes alone', () => {
		expect(stripParentDirSegments('a.b/c.d')).toBe('a.b/c.d');
	});
});
