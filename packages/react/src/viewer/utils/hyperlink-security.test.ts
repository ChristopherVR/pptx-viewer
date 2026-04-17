import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
	isUrlSafe,
	safeOpenUrl,
	clampSlideIndex,
	resolveSlideJump,
	isPpactionUrl,
	parsePpactionUrl,
} from './hyperlink-security';

// ---------------------------------------------------------------------------
// isUrlSafe
// ---------------------------------------------------------------------------

describe('isUrlSafe', () => {
	// --- Safe URLs ---
	it('should accept https URLs', () => {
		expect(isUrlSafe('https://example.com')).toBeTruthy();
	});

	it('should accept http URLs', () => {
		expect(isUrlSafe('http://example.com')).toBeTruthy();
	});

	it('should accept mailto URLs', () => {
		expect(isUrlSafe('mailto:user@example.com')).toBeTruthy();
	});

	it('should accept tel URLs', () => {
		expect(isUrlSafe('tel:+1234567890')).toBeTruthy();
	});

	it('should accept ftp URLs', () => {
		expect(isUrlSafe('ftp://files.example.com')).toBeTruthy();
	});

	it('should accept relative URLs', () => {
		expect(isUrlSafe('/page/about')).toBeTruthy();
	});

	it('should accept hash-only URLs', () => {
		expect(isUrlSafe('#section')).toBeTruthy();
	});

	// --- Blocked protocols ---
	it('should block javascript: protocol', () => {
		expect(isUrlSafe(`${'javascript'}:alert(1)`)).toBeFalsy();
	});

	it('should block JAVASCRIPT: (case-insensitive)', () => {
		expect(isUrlSafe(`${'JAVASCRIPT'}:alert(1)`)).toBeFalsy();
	});

	it('should block JaVaScRiPt: mixed case', () => {
		expect(isUrlSafe(`${'JaVaScRiPt'}:alert(1)`)).toBeFalsy();
	});

	it('should block data: protocol', () => {
		expect(isUrlSafe('data:text/html,<h1>XSS</h1>')).toBeFalsy();
	});

	it('should block vbscript: protocol', () => {
		expect(isUrlSafe("vbscript:MsgBox('XSS')")).toBeFalsy();
	});

	it('should block mhtml: protocol', () => {
		expect(isUrlSafe('mhtml:file://C:/test.mht')).toBeFalsy();
	});

	it('should block javascript: with whitespace bypass', () => {
		expect(isUrlSafe('  javascript:alert(1)')).toBeFalsy();
	});

	it('should block javascript: with zero-width spaces', () => {
		expect(isUrlSafe('java\u200bscript:alert(1)')).toBeFalsy();
	});

	it('should block javascript: with null bytes', () => {
		expect(isUrlSafe('java\0script:alert(1)')).toBeFalsy();
	});

	// --- Edge cases ---
	it('should reject empty string', () => {
		expect(isUrlSafe('')).toBeFalsy();
	});

	it('should reject whitespace-only string', () => {
		expect(isUrlSafe('   ')).toBeFalsy();
	});

	it('should reject null-ish values', () => {
		expect(isUrlSafe(null as unknown as string)).toBeFalsy();
		expect(isUrlSafe(undefined as unknown as string)).toBeFalsy();
	});

	it("should accept URL that contains 'javascript' in path (not protocol)", () => {
		expect(isUrlSafe('https://example.com/javascript/docs')).toBeTruthy();
	});
});

// ---------------------------------------------------------------------------
// safeOpenUrl
// ---------------------------------------------------------------------------

describe('safeOpenUrl', () => {
	beforeEach(() => {
		vi.stubGlobal('window', {
			open: vi.fn<() => void>(),
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('should open safe URL and return true', () => {
		const result = safeOpenUrl('https://example.com');
		expect(result).toBeTruthy();
		expect(window.open).toHaveBeenCalledWith(
			'https://example.com',
			'_blank',
			'noopener,noreferrer',
		);
	});

	it('should block javascript: URL and return false', () => {
		const result = safeOpenUrl(`${'javascript'}:alert(1)`);
		expect(result).toBeFalsy();
		expect(window.open).not.toHaveBeenCalled();
	});

	it('should block data: URL and return false', () => {
		const result = safeOpenUrl('data:text/html,<script>alert(1)</script>');
		expect(result).toBeFalsy();
		expect(window.open).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// clampSlideIndex
// ---------------------------------------------------------------------------

describe('clampSlideIndex', () => {
	it('should return index when within range', () => {
		expect(clampSlideIndex(3, 10)).toBe(3);
	});

	it('should clamp to 0 when negative', () => {
		expect(clampSlideIndex(-1, 10)).toBe(0);
	});

	it('should clamp to last when beyond range', () => {
		expect(clampSlideIndex(15, 10)).toBe(9);
	});

	it('should floor fractional indices', () => {
		expect(clampSlideIndex(2.7, 10)).toBe(2);
	});

	it('should return null when totalSlides is 0', () => {
		expect(clampSlideIndex(0, 0)).toBeNull();
	});

	it('should return null when totalSlides is negative', () => {
		expect(clampSlideIndex(0, -1)).toBeNull();
	});

	it('should return null for NaN index', () => {
		expect(clampSlideIndex(NaN, 10)).toBeNull();
	});

	it('should return null for Infinity index', () => {
		expect(clampSlideIndex(Infinity, 10)).toBeNull();
	});

	it('should handle index 0 with 1 slide', () => {
		expect(clampSlideIndex(0, 1)).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// resolveSlideJump
// ---------------------------------------------------------------------------

describe('resolveSlideJump', () => {
	it("should resolve 'slide' to the provided targetSlideIndex", () => {
		expect(resolveSlideJump('slide', 2, 10, 5)).toBe(5);
	});

	it("should clamp 'slide' targetSlideIndex to valid range", () => {
		expect(resolveSlideJump('slide', 2, 10, 20)).toBe(9);
	});

	it("should return null for 'slide' without targetSlideIndex", () => {
		expect(resolveSlideJump('slide', 2, 10)).toBeNull();
	});

	it("should resolve 'firstSlide' to 0", () => {
		expect(resolveSlideJump('firstSlide', 5, 10)).toBe(0);
	});

	it("should resolve 'lastSlide' to totalSlides - 1", () => {
		expect(resolveSlideJump('lastSlide', 0, 10)).toBe(9);
	});

	it("should resolve 'nextSlide' to currentSlideIndex + 1", () => {
		expect(resolveSlideJump('nextSlide', 3, 10)).toBe(4);
	});

	it("should clamp 'nextSlide' at last slide", () => {
		expect(resolveSlideJump('nextSlide', 9, 10)).toBe(9);
	});

	it("should resolve 'prevSlide' to currentSlideIndex - 1", () => {
		expect(resolveSlideJump('prevSlide', 3, 10)).toBe(2);
	});

	it("should clamp 'prevSlide' at first slide", () => {
		expect(resolveSlideJump('prevSlide', 0, 10)).toBe(0);
	});

	it("should resolve 'endShow' to the string 'endShow'", () => {
		expect(resolveSlideJump('endShow', 5, 10)).toBe('endShow');
	});

	it("should return null for 'none'", () => {
		expect(resolveSlideJump('none', 0, 10)).toBeNull();
	});

	it("should return null for 'url'", () => {
		expect(resolveSlideJump('url', 0, 10)).toBeNull();
	});

	it("should return null for 'lastSlide' with 0 slides", () => {
		expect(resolveSlideJump('lastSlide', 0, 0)).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// isPpactionUrl
// ---------------------------------------------------------------------------

describe('isPpactionUrl', () => {
	it('should return true for ppaction://hlinksldjump', () => {
		expect(isPpactionUrl('ppaction://hlinksldjump')).toBeTruthy();
	});

	it('should return true for ppaction://hlinkshowjump?jump=nextslide', () => {
		expect(isPpactionUrl('ppaction://hlinkshowjump?jump=nextslide')).toBeTruthy();
	});

	it('should be case-insensitive', () => {
		expect(isPpactionUrl('PPACTION://hlinksldjump')).toBeTruthy();
		expect(isPpactionUrl('Ppaction://HLINKSLDJUMP')).toBeTruthy();
	});

	it('should return false for http URLs', () => {
		expect(isPpactionUrl('https://example.com')).toBeFalsy();
	});

	it('should return false for empty string', () => {
		expect(isPpactionUrl('')).toBeFalsy();
	});

	it('should return false for null/undefined', () => {
		expect(isPpactionUrl(null as unknown as string)).toBeFalsy();
		expect(isPpactionUrl(undefined as unknown as string)).toBeFalsy();
	});
});

// ---------------------------------------------------------------------------
// parsePpactionUrl
// ---------------------------------------------------------------------------

describe('parsePpactionUrl', () => {
	it('should parse ppaction://hlinksldjump with slideIndex', () => {
		const result = parsePpactionUrl('ppaction://hlinksldjump?slideIndex=5');
		expect(result).toStrictEqual({
			action: 'ppaction://hlinksldjump',
			targetSlideIndex: 5,
		});
	});

	it('should parse ppaction://hlinksldjump without slideIndex', () => {
		const result = parsePpactionUrl('ppaction://hlinksldjump');
		expect(result).toStrictEqual({
			action: 'ppaction://hlinksldjump',
			targetSlideIndex: undefined,
		});
	});

	it('should parse ppaction://hlinkshowjump?jump=nextslide and preserve jump verb', () => {
		const result = parsePpactionUrl('ppaction://hlinkshowjump?jump=nextslide');
		expect(result).toStrictEqual({
			action: 'ppaction://hlinkshowjump?jump=nextslide',
			targetSlideIndex: undefined,
		});
	});

	it('should preserve jump verb while extracting slideIndex', () => {
		// Edge case: both jump verb and slideIndex present
		const result = parsePpactionUrl('ppaction://hlinkshowjump?jump=nextslide&slideIndex=3');
		expect(result).toStrictEqual({
			action: 'ppaction://hlinkshowjump?jump=nextslide',
			targetSlideIndex: 3,
		});
	});

	it('should parse slideIndex=0', () => {
		const result = parsePpactionUrl('ppaction://hlinksldjump?slideIndex=0');
		expect(result).toStrictEqual({
			action: 'ppaction://hlinksldjump',
			targetSlideIndex: 0,
		});
	});

	it('should return null for non-ppaction URLs', () => {
		expect(parsePpactionUrl('https://example.com')).toBeNull();
		expect(parsePpactionUrl('')).toBeNull();
	});

	it('should ignore non-numeric slideIndex values', () => {
		const result = parsePpactionUrl('ppaction://hlinksldjump?slideIndex=abc');
		expect(result).toStrictEqual({
			action: 'ppaction://hlinksldjump',
			targetSlideIndex: undefined,
		});
	});
});
