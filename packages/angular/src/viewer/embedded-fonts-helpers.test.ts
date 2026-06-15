/**
 * embedded-fonts-helpers.test.ts — Unit tests for the pure embedded-font
 * helpers (vitest + happy-dom, no TestBed). Ports the Vue `useEmbeddedFonts`
 * coverage to the pure string-building layer.
 */

import type { PptxEmbeddedFont } from 'pptx-viewer-core';
import { obfuscateFont } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	buildEmbeddedFontStyles,
	buildFontFaceRule,
	fontMimeForFormat,
	isInjectableUrl,
	normalizeFontFormat,
	resolveFontVariant,
} from './embedded-fonts-helpers';

/** Minimal valid TrueType sfnt header (0x00010000) so `detectFontFormat` is happy. */
function makeTtfBytes(): Uint8Array {
	const bytes = new Uint8Array(48);
	bytes[0] = 0x00;
	bytes[1] = 0x01;
	bytes[2] = 0x00;
	bytes[3] = 0x00;
	for (let i = 4; i < bytes.length; i++) {
		bytes[i] = (i * 7) & 0xff;
	}
	return bytes;
}

const TINY_DATA_URL = 'data:font/ttf;base64,AAEAAA==';

function makeFont(overrides: Partial<PptxEmbeddedFont>): PptxEmbeddedFont {
	return {
		name: 'CustomSans',
		dataUrl: TINY_DATA_URL,
		format: 'truetype',
		...overrides,
	};
}

/** A deterministic object-URL factory so resolution stays pure in tests. */
function fakeUrlFactory(): { mint: (bytes: Uint8Array, mime: string) => string; minted: string[] } {
	const minted: string[] = [];
	let n = 0;
	return {
		minted,
		mint: (_bytes, _mime) => {
			const url = `blob:fake/${n++}`;
			minted.push(url);
			return url;
		},
	};
}

function countFontFaceRules(css: string): number {
	return (css.match(/@font-face/gu) ?? []).length;
}

// ---------------------------------------------------------------------------
// isInjectableUrl
// ---------------------------------------------------------------------------

describe('isInjectableUrl', () => {
	it('accepts blob: URLs', () => {
		expect(isInjectableUrl('blob:http://x/abc')).toBeTruthy();
	});

	it('accepts base64 data:font/ URLs', () => {
		expect(isInjectableUrl(TINY_DATA_URL)).toBeTruthy();
	});

	it('rejects empty / non-string input', () => {
		expect(isInjectableUrl('')).toBeFalsy();
		// @ts-expect-error — guarding the runtime non-string path
		expect(isInjectableUrl(null)).toBeFalsy();
	});

	it('rejects non-font data URLs and arbitrary schemes', () => {
		expect(isInjectableUrl('data:image/png;base64,AAAA')).toBeFalsy();
		expect(isInjectableUrl('https://evil.example/font.ttf')).toBeFalsy();
		// eslint-disable-next-line no-script-url -- security test fixture: verifies the scheme is rejected.
		expect(isInjectableUrl('javascript:alert(1)')).toBeFalsy();
	});
});

// ---------------------------------------------------------------------------
// normalizeFontFormat / fontMimeForFormat
// ---------------------------------------------------------------------------

describe('normalizeFontFormat', () => {
	it('passes through allowed formats', () => {
		expect(normalizeFontFormat('opentype')).toBe('opentype');
		expect(normalizeFontFormat('woff2')).toBe('woff2');
	});

	it('falls back to truetype for missing / unsupported formats', () => {
		expect(normalizeFontFormat(undefined)).toBe('truetype');
		expect(normalizeFontFormat('svg')).toBe('truetype');
	});
});

describe('fontMimeForFormat', () => {
	it('maps known formats to MIME types', () => {
		expect(fontMimeForFormat('truetype')).toBe('font/ttf');
		expect(fontMimeForFormat('opentype')).toBe('font/otf');
		expect(fontMimeForFormat('woff')).toBe('font/woff');
		expect(fontMimeForFormat('woff2')).toBe('font/woff2');
	});

	it('falls back to font/ttf for unknown formats', () => {
		expect(fontMimeForFormat('weird')).toBe('font/ttf');
	});
});

// ---------------------------------------------------------------------------
// buildFontFaceRule
// ---------------------------------------------------------------------------

describe('buildFontFaceRule', () => {
	it('emits a well-formed @font-face rule', () => {
		const rule = buildFontFaceRule({
			name: 'CustomSans',
			url: TINY_DATA_URL,
			format: 'truetype',
			weight: '700',
			style: 'italic',
		});
		expect(rule).toContain('@font-face {');
		expect(rule).toContain('font-family: "CustomSans";');
		expect(rule).toContain(`src: url("${TINY_DATA_URL}") format("truetype");`);
		expect(rule).toContain('font-weight: 700;');
		expect(rule).toContain('font-style: italic;');
		expect(rule).toContain('font-display: swap;');
	});
});

// ---------------------------------------------------------------------------
// resolveFontVariant
// ---------------------------------------------------------------------------

describe('resolveFontVariant', () => {
	it('resolves a data-URL entry without minting an object URL', () => {
		const { mint, minted } = fakeUrlFactory();
		const variant = resolveFontVariant(makeFont({ bold: true, italic: false }), mint);
		expect(variant).not.toBeNull();
		expect(variant?.url).toBe(TINY_DATA_URL);
		expect(variant?.weight).toBe('700');
		expect(variant?.style).toBe('normal');
		expect(variant?.objectUrl).toBeUndefined();
		expect(minted).toHaveLength(0);
	});

	it('rejects an unsafe family name', () => {
		const { mint } = fakeUrlFactory();
		const variant = resolveFontVariant(
			makeFont({ name: 'Evil"; } body { display:none } @font-face { src:url(x' }),
			mint,
		);
		expect(variant).toBeNull();
	});

	it('returns null when raw bytes are unusable and no data URL exists', () => {
		const { mint, minted } = fakeUrlFactory();
		const variant = resolveFontVariant(
			{ name: 'NoData', dataUrl: '', bold: false, italic: false },
			mint,
		);
		expect(variant).toBeNull();
		expect(minted).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// buildEmbeddedFontStyles
// ---------------------------------------------------------------------------

describe('buildEmbeddedFontStyles', () => {
	it('builds two @font-face rules for a font with regular + bold variants', () => {
		const { mint } = fakeUrlFactory();
		const fonts: PptxEmbeddedFont[] = [
			makeFont({ name: 'CustomSans', bold: false, italic: false }),
			makeFont({ name: 'CustomSans', bold: true, italic: false }),
		];

		const { fontFaceCss, fontFamilies } = buildEmbeddedFontStyles(fonts, mint);
		expect(countFontFaceRules(fontFaceCss)).toBe(2);
		expect(fontFaceCss).toContain('font-family: "CustomSans"');
		expect(fontFaceCss).toMatch(/font-weight: 400;/u);
		expect(fontFaceCss).toMatch(/font-weight: 700;/u);

		// A single distinct embedded family (with substitution fallbacks).
		expect(fontFamilies).toHaveLength(1);
		expect(fontFamilies[0]).toContain('"CustomSans"');
	});

	it('maps italic and boldItalic variants to the right font-style', () => {
		const { mint } = fakeUrlFactory();
		const fonts: PptxEmbeddedFont[] = [
			makeFont({ name: 'Fancy', bold: false, italic: true }),
			makeFont({ name: 'Fancy', bold: true, italic: true }),
		];
		const { fontFaceCss } = buildEmbeddedFontStyles(fonts, mint);
		expect(countFontFaceRules(fontFaceCss)).toBe(2);
		const italicRules = fontFaceCss.match(/font-style: italic;/gu) ?? [];
		expect(italicRules).toHaveLength(2);
		expect(fontFaceCss).toMatch(/font-weight: 700;/u);
	});

	it('de-obfuscates obfuscated bytes when no data URL is present', () => {
		const guid = 'F7A0C94A-3F90-4C3A-AE50-B05A7B0F6C65';
		const clear = makeTtfBytes();
		// obfuscateFont === deobfuscateFont (XOR self-inverse) — produce the
		// scrambled bytes a PPTX would have stored on disk.
		const obfuscated = obfuscateFont(clear, guid);

		const font: PptxEmbeddedFont = {
			name: 'ObfFont',
			dataUrl: '', // loader could not build a usable data URL
			format: 'truetype',
			bold: false,
			italic: false,
			fontGuid: guid,
			originalPartBytes: obfuscated,
		};

		const { mint, minted } = fakeUrlFactory();
		const { fontFaceCss, objectUrls } = buildEmbeddedFontStyles([font], mint);
		expect(countFontFaceRules(fontFaceCss)).toBe(1);
		expect(fontFaceCss).toContain('font-family: "ObfFont"');
		// A blob: object URL should have been minted for the de-obfuscated bytes.
		expect(fontFaceCss).toMatch(/url\("blob:/u);
		expect(objectUrls).toHaveLength(1);
		expect(minted).toHaveLength(1);
	});

	it('uses clear-text rawFontData directly when present', () => {
		const font: PptxEmbeddedFont = {
			name: 'RawFont',
			dataUrl: '',
			bold: false,
			italic: false,
			rawFontData: makeTtfBytes(),
		};
		const { mint } = fakeUrlFactory();
		const { fontFaceCss, objectUrls } = buildEmbeddedFontStyles([font], mint);
		expect(countFontFaceRules(fontFaceCss)).toBe(1);
		expect(fontFaceCss).toContain('font-family: "RawFont"');
		expect(objectUrls).toHaveLength(1);
	});

	it('rejects fonts whose name could break out of the @font-face block', () => {
		const { mint } = fakeUrlFactory();
		const malicious = makeFont({ name: 'Evil"; } body { display:none } @font-face { src:url(x' });
		const { fontFaceCss, fontFamilies } = buildEmbeddedFontStyles([malicious], mint);
		expect(fontFaceCss).toBe('');
		expect(fontFamilies).toHaveLength(0);
	});

	it('produces no CSS for an empty font list', () => {
		const { mint } = fakeUrlFactory();
		const empty = buildEmbeddedFontStyles([], mint);
		expect(empty.fontFaceCss).toBe('');
		expect(empty.fontFamilies).toHaveLength(0);
		expect(empty.objectUrls).toHaveLength(0);
	});

	it('produces no CSS for a null/undefined font list', () => {
		const { mint } = fakeUrlFactory();
		expect(buildEmbeddedFontStyles(null, mint).fontFaceCss).toBe('');
		expect(buildEmbeddedFontStyles(undefined, mint).fontFaceCss).toBe('');
	});

	it('de-duplicates families but keeps every variant rule', () => {
		const { mint } = fakeUrlFactory();
		const fonts: PptxEmbeddedFont[] = [
			makeFont({ name: 'Dup', bold: false }),
			makeFont({ name: 'Dup', bold: true }),
			makeFont({ name: 'Other', bold: false }),
		];
		const { fontFaceCss, fontFamilies } = buildEmbeddedFontStyles(fonts, mint);
		expect(countFontFaceRules(fontFaceCss)).toBe(3);
		expect(fontFamilies).toHaveLength(2);
	});
});
