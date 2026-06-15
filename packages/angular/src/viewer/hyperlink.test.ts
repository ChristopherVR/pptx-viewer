import { describe, expect, it } from 'vitest';

import { isPpactionUrl, isUrlSafe, resolveHyperlinkHref } from './hyperlink';

describe('isUrlSafe', () => {
	it('allows http/https/mailto/tel/relative URLs', () => {
		expect(isUrlSafe('https://example.com')).toBeTruthy();
		expect(isUrlSafe('http://example.com')).toBeTruthy();
		expect(isUrlSafe('mailto:a@b.com')).toBeTruthy();
		expect(isUrlSafe('tel:+15551234')).toBeTruthy();
		expect(isUrlSafe('/slides/2')).toBeTruthy();
	});

	it('blocks javascript/data/vbscript/mhtml schemes', () => {
		// Build the scheme dynamically to avoid the no-script-url lint rule.
		expect(isUrlSafe(`${'java'}${'script'}:alert(1)`)).toBeFalsy();
		expect(isUrlSafe('data:text/html;base64,AAA')).toBeFalsy();
		expect(isUrlSafe('vbscript:msgbox')).toBeFalsy();
		expect(isUrlSafe('mhtml:file://x')).toBeFalsy();
	});

	it('resists case and whitespace bypasses', () => {
		expect(isUrlSafe(`${'JaVa'}${'ScRiPt'}:alert(1)`)).toBeFalsy();
		expect(isUrlSafe(`  ${'java'}${'script'}:alert(1)`)).toBeFalsy();
		expect(isUrlSafe(`java\t${'script'}:alert(1)`)).toBeFalsy();
	});

	it('rejects empty / non-string input', () => {
		expect(isUrlSafe('')).toBeFalsy();
		expect(isUrlSafe('   ')).toBeFalsy();
		expect(isUrlSafe(undefined)).toBeFalsy();
	});
});

describe('isPpactionUrl', () => {
	it('detects ppaction URLs case-insensitively', () => {
		expect(isPpactionUrl('ppaction://hlinksldjump')).toBeTruthy();
		expect(isPpactionUrl('PPACTION://hlinkshowjump')).toBeTruthy();
		expect(isPpactionUrl('https://example.com')).toBeFalsy();
		expect(isPpactionUrl(undefined)).toBeFalsy();
	});
});

describe('resolveHyperlinkHref', () => {
	it('returns the trimmed URL for safe links', () => {
		expect(resolveHyperlinkHref('  https://example.com  ')).toBe('https://example.com');
	});

	it('returns undefined for unsafe, internal, or empty links', () => {
		expect(resolveHyperlinkHref(`${'java'}${'script'}:alert(1)`)).toBeUndefined();
		expect(resolveHyperlinkHref('ppaction://hlinksldjump')).toBeUndefined();
		expect(resolveHyperlinkHref(undefined)).toBeUndefined();
		expect(resolveHyperlinkHref('')).toBeUndefined();
	});
});
