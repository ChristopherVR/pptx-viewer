import { describe, it, expect } from 'vitest';
import {
	detectTargetType,
	parseEmailUrl,
	parseSlideFromUrl,
	resolveHyperlinkEditResult,
} from './hyperlink-edit-utils';
import type { HyperlinkEditData } from './hyperlink-edit-types';

describe('detectTargetType', () => {
	it('should detect "slide" for hlinksldjump action', () => {
		expect(detectTargetType(undefined, 'ppaction://hlinksldjump')).toBe('slide');
	});

	it('should detect "action" for known ppaction verbs', () => {
		expect(
			detectTargetType(undefined, 'ppaction://hlinkshowjump?jump=nextslide'),
		).toBe('action');
	});

	it('should detect "action" for unknown ppaction verbs', () => {
		expect(
			detectTargetType(undefined, 'ppaction://someunknown'),
		).toBe('action');
	});

	it('should detect "email" for mailto URLs', () => {
		expect(detectTargetType('mailto:test@example.com', undefined)).toBe('email');
	});

	it('should detect "file" for Windows file paths', () => {
		expect(detectTargetType('C:\\Documents\\file.pptx', undefined)).toBe('file');
	});

	it('should detect "file" for relative paths', () => {
		expect(detectTargetType('../folder/file.txt', undefined)).toBe('file');
		expect(detectTargetType('./file.txt', undefined)).toBe('file');
	});

	it('should detect "file" for file: URIs', () => {
		expect(detectTargetType('file:///home/user/doc.pdf', undefined)).toBe('file');
	});

	it('should default to "url" for regular URLs', () => {
		expect(detectTargetType('https://example.com', undefined)).toBe('url');
	});

	it('should default to "url" when both url and action are undefined', () => {
		expect(detectTargetType(undefined, undefined)).toBe('url');
	});

	it('should prefer action detection over URL detection', () => {
		expect(
			detectTargetType('mailto:test@example.com', 'ppaction://hlinksldjump'),
		).toBe('slide');
	});
});

describe('parseEmailUrl', () => {
	it('should parse simple mailto URL', () => {
		const result = parseEmailUrl('mailto:user@example.com');
		expect(result.address).toBe('user@example.com');
		expect(result.subject).toBe('');
	});

	it('should parse mailto URL with subject', () => {
		const result = parseEmailUrl('mailto:user@example.com?subject=Hello%20World');
		expect(result.address).toBe('user@example.com');
		expect(result.subject).toBe('Hello World');
	});

	it('should return raw string when not a mailto URL', () => {
		const result = parseEmailUrl('user@example.com');
		expect(result.address).toBe('user@example.com');
		expect(result.subject).toBe('');
	});

	it('should handle mailto with empty address', () => {
		const result = parseEmailUrl('mailto:?subject=Test');
		expect(result.address).toBe('');
		expect(result.subject).toBe('Test');
	});

	it('should handle mailto with no query parameters', () => {
		const result = parseEmailUrl('mailto:test@test.com');
		expect(result.address).toBe('test@test.com');
		expect(result.subject).toBe('');
	});

	it('should handle mailto with multiple query params', () => {
		const result = parseEmailUrl('mailto:user@test.com?subject=Hi&cc=other@test.com');
		expect(result.address).toBe('user@test.com');
		expect(result.subject).toBe('Hi');
	});

	it('should handle empty string', () => {
		const result = parseEmailUrl('');
		expect(result.address).toBe('');
		expect(result.subject).toBe('');
	});

	it('should handle special characters in subject', () => {
		const result = parseEmailUrl('mailto:user@test.com?subject=Hello%20%26%20Goodbye');
		expect(result.address).toBe('user@test.com');
		expect(result.subject).toBe('Hello & Goodbye');
	});
});

describe('parseSlideFromUrl', () => {
	it('should parse slide number from PPTX-style URL with action', () => {
		expect(parseSlideFromUrl('slide5.xml', 'ppaction://hlinksldjump')).toBe(5);
	});

	it('should parse slide number from full path', () => {
		expect(
			parseSlideFromUrl('ppt/slides/slide12.xml', 'ppaction://hlinksldjump'),
		).toBe(12);
	});

	it('should parse slide number from hash-based URL', () => {
		expect(parseSlideFromUrl('#Slide 3', undefined)).toBe(3);
	});

	it('should default to 1 when no slide number can be parsed', () => {
		expect(parseSlideFromUrl('https://example.com', undefined)).toBe(1);
	});

	it('should default to 1 when both url and action are undefined', () => {
		expect(parseSlideFromUrl(undefined, undefined)).toBe(1);
	});

	it('should handle case-insensitive slide pattern', () => {
		expect(parseSlideFromUrl('SLIDE10.XML', 'ppaction://hlinksldjump')).toBe(10);
	});

	it('should not parse when action is not hlinksldjump', () => {
		expect(parseSlideFromUrl('slide5.xml', 'ppaction://other')).toBe(1);
	});

	it('should return 1 for undefined URL with valid action', () => {
		expect(parseSlideFromUrl(undefined, 'ppaction://hlinksldjump')).toBe(1);
	});
});

describe('resolveHyperlinkEditResult', () => {
	it('should resolve URL type correctly', () => {
		const data: HyperlinkEditData = {
			targetType: 'url',
			url: 'https://example.com',
			tooltip: 'Example',
			emailAddress: '',
			emailSubject: '',
			slideNumber: 1,
			filePath: '',
			actionVerb: 'nextSlide',
		};
		const result = resolveHyperlinkEditResult(data);
		expect(result.url).toBe('https://example.com');
		expect(result.tooltip).toBe('Example');
		expect(result.action).toBeUndefined();
	});

	it('should resolve email type with subject', () => {
		const data: HyperlinkEditData = {
			targetType: 'email',
			url: '',
			tooltip: '',
			emailAddress: 'user@test.com',
			emailSubject: 'Hello World',
			slideNumber: 1,
			filePath: '',
			actionVerb: 'nextSlide',
		};
		const result = resolveHyperlinkEditResult(data);
		expect(result.url).toContain('mailto:user@test.com');
		expect(result.url).toContain('subject=Hello%20World');
	});

	it('should resolve email type without subject', () => {
		const data: HyperlinkEditData = {
			targetType: 'email',
			url: '',
			tooltip: '',
			emailAddress: 'user@test.com',
			emailSubject: '',
			slideNumber: 1,
			filePath: '',
			actionVerb: 'nextSlide',
		};
		const result = resolveHyperlinkEditResult(data);
		expect(result.url).toBe('mailto:user@test.com');
	});

	it('should resolve slide type with ppaction', () => {
		const data: HyperlinkEditData = {
			targetType: 'slide',
			url: '',
			tooltip: '',
			emailAddress: '',
			emailSubject: '',
			slideNumber: 5,
			filePath: '',
			actionVerb: 'nextSlide',
		};
		const result = resolveHyperlinkEditResult(data);
		expect(result.url).toBe('slide5.xml');
		expect(result.action).toBe('ppaction://hlinksldjump');
	});

	it('should resolve file type', () => {
		const data: HyperlinkEditData = {
			targetType: 'file',
			url: '',
			tooltip: 'My File',
			emailAddress: '',
			emailSubject: '',
			slideNumber: 1,
			filePath: 'C:\\docs\\file.pptx',
			actionVerb: 'nextSlide',
		};
		const result = resolveHyperlinkEditResult(data);
		expect(result.url).toBe('C:\\docs\\file.pptx');
		expect(result.tooltip).toBe('My File');
	});

	it('should resolve action type with ppaction', () => {
		const data: HyperlinkEditData = {
			targetType: 'action',
			url: '',
			tooltip: '',
			emailAddress: '',
			emailSubject: '',
			slideNumber: 1,
			filePath: '',
			actionVerb: 'nextSlide',
		};
		const result = resolveHyperlinkEditResult(data);
		expect(result.action).toBe('ppaction://hlinkshowjump?jump=nextslide');
	});

	it('should omit tooltip when empty', () => {
		const data: HyperlinkEditData = {
			targetType: 'url',
			url: 'https://example.com',
			tooltip: '',
			emailAddress: '',
			emailSubject: '',
			slideNumber: 1,
			filePath: '',
			actionVerb: 'nextSlide',
		};
		const result = resolveHyperlinkEditResult(data);
		expect(result.tooltip).toBeUndefined();
	});

	it('should trim whitespace-only tooltip to undefined', () => {
		const data: HyperlinkEditData = {
			targetType: 'url',
			url: 'https://example.com',
			tooltip: '   ',
			emailAddress: '',
			emailSubject: '',
			slideNumber: 1,
			filePath: '',
			actionVerb: 'nextSlide',
		};
		const result = resolveHyperlinkEditResult(data);
		expect(result.tooltip).toBeUndefined();
	});
});
