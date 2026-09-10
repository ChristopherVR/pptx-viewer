// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { collectExternalFontFaceCss, collectFontFaceCss } from './foreign-object-font-embed';

describe('collectFontFaceCss', () => {
	afterEach(() => {
		document.head.innerHTML = '';
	});

	it('concatenates only <style> elements that declare @font-face', () => {
		const fontStyle = document.createElement('style');
		fontStyle.textContent =
			"@font-face { font-family: 'Calibri'; src: url(data:font/woff2;base64,AAA); }";
		document.head.appendChild(fontStyle);
		const otherStyle = document.createElement('style');
		otherStyle.textContent = 'body { color: red; }';
		document.head.appendChild(otherStyle);

		const css = collectFontFaceCss(document);

		expect(css).toContain('Calibri');
		expect(css).not.toContain('color: red');
	});

	it('returns an empty string when no @font-face style is present', () => {
		expect(collectFontFaceCss(document)).toBe('');
	});
});

describe('collectExternalFontFaceCss', () => {
	afterEach(() => {
		document.head.innerHTML = '';
		vi.unstubAllGlobals();
	});

	it('returns an empty, fully-embedded result when no <link rel="stylesheet"> is present', async () => {
		const result = await collectExternalFontFaceCss(document, async () => null);
		expect(result).toStrictEqual({ css: '', allEmbedded: true });
	});

	it('ignores a non-http(s) or non-stylesheet link', async () => {
		const icon = document.createElement('link');
		icon.rel = 'icon';
		icon.href = 'https://fonts.googleapis.com/should-be-ignored.ico';
		document.head.appendChild(icon);
		const fetchDataUrl = vi.fn(async () => 'data:font/woff2;base64,ZZZ');

		const result = await collectExternalFontFaceCss(document, fetchDataUrl);

		expect(result).toStrictEqual({ css: '', allEmbedded: true });
		expect(fetchDataUrl).not.toHaveBeenCalled();
	});

	it('fetches the stylesheet text and inlines every font url() as a data: URI', async () => {
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = 'https://fonts.googleapis.com/css2?family=Roboto';
		document.head.appendChild(link);

		vi.stubGlobal(
			'fetch',
			vi.fn(async () => ({
				ok: true,
				text: async () =>
					"@font-face{font-family:'Roboto';src:url(https://fonts.gstatic.com/roboto.woff2) format('woff2');}",
			})),
		);
		const fetchDataUrl = vi.fn(async (url: string) =>
			url.endsWith('roboto.woff2') ? 'data:font/woff2;base64,Um9ib3Rv' : null,
		);

		const result = await collectExternalFontFaceCss(document, fetchDataUrl);

		expect(result.allEmbedded).toBeTruthy();
		expect(result.css).toContain('Roboto');
		expect(result.css).toContain('data:font/woff2;base64,Um9ib3Rv');
		expect(result.css).not.toContain('https://fonts.gstatic.com/roboto.woff2');
	});

	it('inlines every url() when a @font-face rule lists more than one font file', async () => {
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = 'https://fonts.googleapis.com/css2?family=Roboto';
		document.head.appendChild(link);

		vi.stubGlobal(
			'fetch',
			vi.fn(async () => ({
				ok: true,
				text: async () =>
					"@font-face{font-family:'Roboto';src:url(https://fonts.gstatic.com/a.woff2) format('woff2'),url(https://fonts.gstatic.com/b.woff) format('woff');}",
			})),
		);
		const dataUrls: Record<string, string> = {
			'https://fonts.gstatic.com/a.woff2': 'data:font/x;base64,AAA',
			'https://fonts.gstatic.com/b.woff': 'data:font/x;base64,BBB',
		};
		const fetchDataUrl = vi.fn(async (url: string) => dataUrls[url] ?? null);

		const result = await collectExternalFontFaceCss(document, fetchDataUrl);

		expect(fetchDataUrl).toHaveBeenCalledTimes(2);
		expect(result.css).toContain('data:font/x;base64,AAA');
		expect(result.css).toContain('data:font/x;base64,BBB');
		expect(result.allEmbedded).toBeTruthy();
	});

	it('reports allEmbedded: false and drops the stylesheet when the CSS text fetch fails', async () => {
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = 'https://fonts.googleapis.com/css2?family=Unreachable';
		document.head.appendChild(link);

		vi.stubGlobal(
			'fetch',
			vi.fn(async () => ({ ok: false, text: async () => '' })),
		);

		const result = await collectExternalFontFaceCss(document, async () => null);

		expect(result).toStrictEqual({ css: '', allEmbedded: false });
	});

	it('reports allEmbedded: false but keeps the stylesheet text when one font file fails to fetch', async () => {
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = 'https://fonts.googleapis.com/css2?family=Partial';
		document.head.appendChild(link);

		vi.stubGlobal(
			'fetch',
			vi.fn(async () => ({
				ok: true,
				text: async () =>
					"@font-face{font-family:'Partial';src:url(https://fonts.gstatic.com/missing.woff2);}",
			})),
		);

		const result = await collectExternalFontFaceCss(document, async () => null);

		expect(result.allEmbedded).toBeFalsy();
		expect(result.css).toContain('https://fonts.gstatic.com/missing.woff2');
	});

	it('combines multiple external stylesheets into one CSS block', async () => {
		const linkA = document.createElement('link');
		linkA.rel = 'stylesheet';
		linkA.href = 'https://fonts.googleapis.com/css2?family=A';
		const linkB = document.createElement('link');
		linkB.rel = 'stylesheet';
		linkB.href = 'https://fonts.googleapis.com/css2?family=B';
		document.head.append(linkA, linkB);

		vi.stubGlobal(
			'fetch',
			vi.fn(async (url: string) => ({
				ok: true,
				text: async () =>
					url.includes('family=A') ? '@font-face{font-family:A;}' : '@font-face{font-family:B;}',
			})),
		);

		const result = await collectExternalFontFaceCss(document, async () => null);

		expect(result.css).toContain('font-family:A');
		expect(result.css).toContain('font-family:B');
	});
});
