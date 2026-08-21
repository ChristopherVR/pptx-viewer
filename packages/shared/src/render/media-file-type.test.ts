import { describe, expect, it } from 'vitest';

import { classifyMediaType } from './media-file-type';

describe('classifyMediaType', () => {
	it('classifies audio MIME types', () => {
		expect(classifyMediaType('audio/mpeg')).toBe('audio');
		expect(classifyMediaType('audio/ogg')).toBe('audio');
	});

	it('classifies video MIME types', () => {
		expect(classifyMediaType('video/mp4')).toBe('video');
		expect(classifyMediaType('video/webm')).toBe('video');
	});

	it('returns null for anything else, rather than defaulting to video', () => {
		expect(classifyMediaType('image/png')).toBeNull();
		expect(classifyMediaType('application/pdf')).toBeNull();
		expect(classifyMediaType('text/plain')).toBeNull();
		expect(classifyMediaType('')).toBeNull();
	});
});
