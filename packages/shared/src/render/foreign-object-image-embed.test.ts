// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { embedImagesOnClone, extractCssUrl } from './foreign-object-image-embed';

function mockFetchOk(dataUrl: string): void {
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => ({
			ok: true,
			blob: async () => new Blob(['x']),
		})),
	);
	const OriginalFileReader = FileReader;
	class FakeFileReader extends OriginalFileReader {
		override readAsDataURL(): void {
			Object.defineProperty(this, 'result', { value: dataUrl, configurable: true });
			this.onloadend?.(new ProgressEvent('loadend'));
		}
	}
	vi.stubGlobal('FileReader', FakeFileReader);
}

function mockFetchFail(): void {
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => ({ ok: false, blob: async () => new Blob([]) })),
	);
}

describe('embedImagesOnClone', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('leaves already-data: image sources untouched and reports fully embedded', async () => {
		const root = document.createElement('div');
		const img = document.createElement('img');
		img.src = 'data:image/png;base64,AAAA';
		root.appendChild(img);

		const result = await embedImagesOnClone(root);

		expect(result).toStrictEqual({ allEmbedded: true, unembeddableCount: 0 });
		expect(img.getAttribute('src')).toBe('data:image/png;base64,AAAA');
	});

	it('inlines a blob: image src as a data: URI', async () => {
		mockFetchOk('data:image/png;base64,ZmFrZQ==');
		const root = document.createElement('div');
		const img = document.createElement('img');
		img.src = 'blob:http://localhost/abc-123';
		root.appendChild(img);

		const result = await embedImagesOnClone(root);

		expect(result.allEmbedded).toBeTruthy();
		expect(img.getAttribute('src')).toBe('data:image/png;base64,ZmFrZQ==');
	});

	it('inlines an http(s) background-image url()', async () => {
		mockFetchOk('data:image/jpeg;base64,ZmFrZQ==');
		const root = document.createElement('div');
		root.style.backgroundImage = "url('https://example.com/bg.jpg')";

		const result = await embedImagesOnClone(root);

		expect(result.allEmbedded).toBeTruthy();
		expect(root.style.backgroundImage).toContain('data:image/jpeg;base64,ZmFrZQ==');
	});

	it('reports unembeddableCount when a fetch fails (CORS/network)', async () => {
		mockFetchFail();
		const root = document.createElement('div');
		const img = document.createElement('img');
		img.src = 'https://cross-origin.example/no-cors.png';
		root.appendChild(img);

		const result = await embedImagesOnClone(root);

		expect(result.allEmbedded).toBeFalsy();
		expect(result.unembeddableCount).toBe(1);
		// Left as the original (unembeddable) URL so the caller can detect and fall back.
		expect(img.getAttribute('src')).toBe('https://cross-origin.example/no-cors.png');
	});

	it('inlines an SVG <image> href', async () => {
		mockFetchOk('data:image/png;base64,c3Zn');
		const root = document.createElement('div');
		const svgImg = document.createElementNS('http://www.w3.org/2000/svg', 'image');
		svgImg.setAttribute('href', 'blob:http://localhost/svg-icon');
		root.appendChild(svgImg);

		const result = await embedImagesOnClone(root);

		expect(result.allEmbedded).toBeTruthy();
		expect(svgImg.getAttribute('href')).toBe('data:image/png;base64,c3Zn');
	});
});

describe('extractCssUrl', () => {
	it('extracts a double-quoted url()', () => {
		expect(extractCssUrl('url("https://example.com/bg.jpg")')).toBe('https://example.com/bg.jpg');
	});

	it('extracts a single-quoted url()', () => {
		expect(extractCssUrl("url('https://example.com/bg.jpg')")).toBe('https://example.com/bg.jpg');
	});

	it('extracts an unquoted url()', () => {
		expect(extractCssUrl('url(https://example.com/bg.jpg)')).toBe('https://example.com/bg.jpg');
	});

	it('tolerates surrounding whitespace inside the parens', () => {
		expect(extractCssUrl('url(  "https://example.com/bg.jpg"  )')).toBe(
			'https://example.com/bg.jpg',
		);
	});

	it('returns null when there is no url()', () => {
		expect(extractCssUrl('none')).toBeNull();
	});

	it('does not exhibit polynomial blow-up on many tab repetitions after an unclosed url(', () => {
		// Regression test for the CodeQL js/polynomial-redos finding: the
		// original `\s*["']?([^"')]+)["']?\s*` let whitespace split between the
		// leading `\s*` and the content group in exponentially many equivalent
		// ways. This should stay fast even for a large pathological input.
		const pathological = `url(${'\t'.repeat(50000)}`;
		const start = performance.now();
		expect(extractCssUrl(pathological)).toBeNull();
		expect(performance.now() - start).toBeLessThan(1000);
	});
});
