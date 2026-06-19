import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
	isUrlSafe,
	safeOpenUrl,
	clampSlideIndex,
	resolveSlideJump,
	isPpactionUrl,
	parsePpactionUrl,
	resolveHyperlinkHref,
} from './hyperlink-security';

describe('isUrlSafe', () => {
	it('accepts https URLs', () => {
		expect(isUrlSafe('https://example.com')).toBeTruthy();
	});

	it('accepts http URLs', () => {
		expect(isUrlSafe('http://example.com')).toBeTruthy();
	});

	it('accepts mailto URLs', () => {
		expect(isUrlSafe('mailto:user@example.com')).toBeTruthy();
	});

	it('accepts tel URLs', () => {
		expect(isUrlSafe('tel:+1234567890')).toBeTruthy();
	});

	it('accepts ftp URLs', () => {
		expect(isUrlSafe('ftp://files.example.com')).toBeTruthy();
	});

	it('accepts relative URLs', () => {
		expect(isUrlSafe('/page/about')).toBeTruthy();
	});

	it('accepts hash-only URLs', () => {
		expect(isUrlSafe('#section')).toBeTruthy();
	});

	it('blocks javascript: protocol', () => {
		expect(isUrlSafe(`${'javascript'}:alert(1)`)).toBeFalsy();
	});

	it('blocks JAVASCRIPT: (case-insensitive)', () => {
		expect(isUrlSafe(`${'JAVASCRIPT'}:alert(1)`)).toBeFalsy();
	});

	it('blocks JaVaScRiPt: mixed case', () => {
		expect(isUrlSafe(`${'JaVaScRiPt'}:alert(1)`)).toBeFalsy();
	});

	it('blocks data: protocol', () => {
		expect(isUrlSafe('data:text/html,<h1>XSS</h1>')).toBeFalsy();
	});

	it('blocks vbscript: protocol', () => {
		expect(isUrlSafe("vbscript:MsgBox('XSS')")).toBeFalsy();
	});

	it('blocks mhtml: protocol', () => {
		expect(isUrlSafe('mhtml:file://C:/test.mht')).toBeFalsy();
	});

	it('blocks javascript: with whitespace bypass', () => {
		expect(isUrlSafe('  javascript:alert(1)')).toBeFalsy();
	});

	it('blocks javascript: with zero-width spaces', () => {
		expect(isUrlSafe('java​script:alert(1)')).toBeFalsy();
	});

	it('blocks javascript: with null bytes', () => {
		expect(isUrlSafe('java\0script:alert(1)')).toBeFalsy();
	});

	it('rejects empty string', () => {
		expect(isUrlSafe('')).toBeFalsy();
	});

	it('rejects whitespace-only string', () => {
		expect(isUrlSafe('   ')).toBeFalsy();
	});

	it('rejects null-ish values', () => {
		expect(isUrlSafe(null as unknown as string)).toBeFalsy();
		expect(isUrlSafe(undefined)).toBeFalsy();
	});

	it("accepts URL that contains 'javascript' in path (not protocol)", () => {
		expect(isUrlSafe('https://example.com/javascript/docs')).toBeTruthy();
	});
});

describe('safeOpenUrl', () => {
	beforeEach(() => {
		vi.stubGlobal('window', {
			open: vi.fn<() => void>(),
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('opens safe URL and returns true', () => {
		const result = safeOpenUrl('https://example.com');
		expect(result).toBeTruthy();
		expect(window.open).toHaveBeenCalledWith(
			'https://example.com',
			'_blank',
			'noopener,noreferrer',
		);
	});

	it('blocks javascript: URL and returns false', () => {
		const result = safeOpenUrl(`${'javascript'}:alert(1)`);
		expect(result).toBeFalsy();
		expect(window.open).not.toHaveBeenCalled();
	});

	it('blocks data: URL and returns false', () => {
		const result = safeOpenUrl('data:text/html,<script>alert(1)</script>');
		expect(result).toBeFalsy();
		expect(window.open).not.toHaveBeenCalled();
	});
});

describe('clampSlideIndex', () => {
	it('returns index when within range', () => {
		expect(clampSlideIndex(3, 10)).toBe(3);
	});

	it('clamps to 0 when negative', () => {
		expect(clampSlideIndex(-1, 10)).toBe(0);
	});

	it('clamps to last when beyond range', () => {
		expect(clampSlideIndex(15, 10)).toBe(9);
	});

	it('floors fractional indices', () => {
		expect(clampSlideIndex(2.7, 10)).toBe(2);
	});

	it('returns null when totalSlides is 0', () => {
		expect(clampSlideIndex(0, 0)).toBeNull();
	});

	it('returns null when totalSlides is negative', () => {
		expect(clampSlideIndex(0, -1)).toBeNull();
	});

	it('returns null for NaN index', () => {
		expect(clampSlideIndex(NaN, 10)).toBeNull();
	});

	it('returns null for Infinity index', () => {
		expect(clampSlideIndex(Infinity, 10)).toBeNull();
	});

	it('handles index 0 with 1 slide', () => {
		expect(clampSlideIndex(0, 1)).toBe(0);
	});
});

describe('resolveSlideJump', () => {
	it("resolves 'slide' to the provided targetSlideIndex", () => {
		expect(resolveSlideJump('slide', 2, 10, 5)).toBe(5);
	});

	it("clamps 'slide' targetSlideIndex to valid range", () => {
		expect(resolveSlideJump('slide', 2, 10, 20)).toBe(9);
	});

	it("returns null for 'slide' without targetSlideIndex", () => {
		expect(resolveSlideJump('slide', 2, 10)).toBeNull();
	});

	it("resolves 'firstSlide' to 0", () => {
		expect(resolveSlideJump('firstSlide', 5, 10)).toBe(0);
	});

	it("resolves 'lastSlide' to totalSlides - 1", () => {
		expect(resolveSlideJump('lastSlide', 0, 10)).toBe(9);
	});

	it("resolves 'nextSlide' to currentSlideIndex + 1", () => {
		expect(resolveSlideJump('nextSlide', 3, 10)).toBe(4);
	});

	it("clamps 'nextSlide' at last slide", () => {
		expect(resolveSlideJump('nextSlide', 9, 10)).toBe(9);
	});

	it("resolves 'prevSlide' to currentSlideIndex - 1", () => {
		expect(resolveSlideJump('prevSlide', 3, 10)).toBe(2);
	});

	it("clamps 'prevSlide' at first slide", () => {
		expect(resolveSlideJump('prevSlide', 0, 10)).toBe(0);
	});

	it("resolves 'endShow' to the string 'endShow'", () => {
		expect(resolveSlideJump('endShow', 5, 10)).toBe('endShow');
	});

	it("returns null for 'none'", () => {
		expect(resolveSlideJump('none', 0, 10)).toBeNull();
	});

	it("returns null for 'url'", () => {
		expect(resolveSlideJump('url', 0, 10)).toBeNull();
	});

	it("returns null for 'lastSlide' with 0 slides", () => {
		expect(resolveSlideJump('lastSlide', 0, 0)).toBeNull();
	});
});

describe('isPpactionUrl', () => {
	it('returns true for ppaction://hlinksldjump', () => {
		expect(isPpactionUrl('ppaction://hlinksldjump')).toBeTruthy();
	});

	it('returns true for ppaction://hlinkshowjump?jump=nextslide', () => {
		expect(isPpactionUrl('ppaction://hlinkshowjump?jump=nextslide')).toBeTruthy();
	});

	it('is case-insensitive', () => {
		expect(isPpactionUrl('PPACTION://hlinksldjump')).toBeTruthy();
		expect(isPpactionUrl('Ppaction://HLINKSLDJUMP')).toBeTruthy();
	});

	it('returns false for http URLs', () => {
		expect(isPpactionUrl('https://example.com')).toBeFalsy();
	});

	it('returns false for empty string', () => {
		expect(isPpactionUrl('')).toBeFalsy();
	});

	it('returns false for null/undefined', () => {
		expect(isPpactionUrl(null as unknown as string)).toBeFalsy();
		expect(isPpactionUrl(undefined)).toBeFalsy();
	});
});

describe('parsePpactionUrl', () => {
	it('parses ppaction://hlinksldjump with slideIndex', () => {
		const result = parsePpactionUrl('ppaction://hlinksldjump?slideIndex=5');
		expect(result).toStrictEqual({
			action: 'ppaction://hlinksldjump',
			targetSlideIndex: 5,
		});
	});

	it('parses ppaction://hlinksldjump without slideIndex', () => {
		const result = parsePpactionUrl('ppaction://hlinksldjump');
		expect(result).toStrictEqual({
			action: 'ppaction://hlinksldjump',
			targetSlideIndex: undefined,
		});
	});

	it('parses ppaction://hlinkshowjump?jump=nextslide and preserves jump verb', () => {
		const result = parsePpactionUrl('ppaction://hlinkshowjump?jump=nextslide');
		expect(result).toStrictEqual({
			action: 'ppaction://hlinkshowjump?jump=nextslide',
			targetSlideIndex: undefined,
		});
	});

	it('preserves jump verb while extracting slideIndex', () => {
		const result = parsePpactionUrl('ppaction://hlinkshowjump?jump=nextslide&slideIndex=3');
		expect(result).toStrictEqual({
			action: 'ppaction://hlinkshowjump?jump=nextslide',
			targetSlideIndex: 3,
		});
	});

	it('parses slideIndex=0', () => {
		const result = parsePpactionUrl('ppaction://hlinksldjump?slideIndex=0');
		expect(result).toStrictEqual({
			action: 'ppaction://hlinksldjump',
			targetSlideIndex: 0,
		});
	});

	it('returns null for non-ppaction URLs', () => {
		expect(parsePpactionUrl('https://example.com')).toBeNull();
		expect(parsePpactionUrl('')).toBeNull();
	});

	it('ignores non-numeric slideIndex values', () => {
		const result = parsePpactionUrl('ppaction://hlinksldjump?slideIndex=abc');
		expect(result).toStrictEqual({
			action: 'ppaction://hlinksldjump',
			targetSlideIndex: undefined,
		});
	});
});

describe('resolveHyperlinkHref', () => {
	it('returns the trimmed href for a safe URL', () => {
		expect(resolveHyperlinkHref('  https://example.com  ')).toBe('https://example.com');
	});

	it('returns undefined for an unsafe URL', () => {
		expect(resolveHyperlinkHref(`${'javascript'}:alert(1)`)).toBeUndefined();
	});

	it('returns undefined for a ppaction:// URL', () => {
		expect(resolveHyperlinkHref('ppaction://hlinksldjump')).toBeUndefined();
	});

	it('returns undefined for empty/undefined', () => {
		expect(resolveHyperlinkHref('')).toBeUndefined();
		expect(resolveHyperlinkHref(undefined)).toBeUndefined();
	});
});
