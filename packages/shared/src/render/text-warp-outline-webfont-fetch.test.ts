import { describe, expect, it, vi } from 'vitest';

import type { FetchLike } from './text-warp-outline-webfont-fetch';
import { fetchGoogleWebfontOutlineBytes } from './text-warp-outline-webfont-fetch';

const CSS_HREF = 'https://fonts.googleapis.com/css2?family=Open+Sans';

const SAMPLE_CSS = `
/* latin-ext */
@font-face {
  font-family: 'Open Sans';
  font-style: normal;
  font-weight: 400;
  src: url(https://fonts.gstatic.com/s/opensans/latin-ext-400.woff2) format('woff2');
  unicode-range: U+0100-024F, U+0259, U+1E00-1EFF;
}
/* latin */
@font-face {
  font-family: 'Open Sans';
  font-style: normal;
  font-weight: 400;
  src: url(https://fonts.gstatic.com/s/opensans/latin-400.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153;
}
/* latin, bold */
@font-face {
  font-family: 'Open Sans';
  font-style: normal;
  font-weight: 700;
  src: url(https://fonts.gstatic.com/s/opensans/latin-700.woff2) format('woff2');
  unicode-range: U+0000-00FF;
}
/* latin, italic */
@font-face {
  font-family: 'Open Sans';
  font-style: italic;
  font-weight: 400;
  src: url(https://fonts.gstatic.com/s/opensans/latin-400i.woff2) format('woff2');
  unicode-range: U+0000-00FF;
}
`;

function fakeFetch(fontBytesUrl?: string): FetchLike {
	return vi.fn(async (url: string) => {
		if (url === CSS_HREF) {
			return {
				ok: true,
				text: async () => SAMPLE_CSS,
				arrayBuffer: async () => new ArrayBuffer(0),
			};
		}
		if (fontBytesUrl && url === fontBytesUrl) {
			return {
				ok: true,
				text: async () => '',
				arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
			};
		}
		return { ok: false, text: async () => '', arrayBuffer: async () => new ArrayBuffer(0) };
	});
}

describe('fetchGoogleWebfontOutlineBytes', () => {
	it('fetches the basic-Latin regular block for a catalogue family', async () => {
		const fetchImpl = fakeFetch('https://fonts.gstatic.com/s/opensans/latin-400.woff2');
		const bytes = await fetchGoogleWebfontOutlineBytes(
			CSS_HREF,
			'Open Sans',
			false,
			false,
			fetchImpl,
		);
		expect(bytes).toStrictEqual(new Uint8Array([1, 2, 3, 4]));
		expect(fetchImpl).toHaveBeenCalledWith(CSS_HREF);
		expect(fetchImpl).toHaveBeenCalledWith('https://fonts.gstatic.com/s/opensans/latin-400.woff2');
	});

	it('picks the bold block when bold is requested', async () => {
		const fetchImpl = fakeFetch('https://fonts.gstatic.com/s/opensans/latin-700.woff2');
		const bytes = await fetchGoogleWebfontOutlineBytes(
			CSS_HREF,
			'Open Sans',
			true,
			false,
			fetchImpl,
		);
		expect(bytes).toStrictEqual(new Uint8Array([1, 2, 3, 4]));
	});

	it('picks the italic block when italic is requested', async () => {
		const fetchImpl = fakeFetch('https://fonts.gstatic.com/s/opensans/latin-400i.woff2');
		const bytes = await fetchGoogleWebfontOutlineBytes(
			CSS_HREF,
			'Open Sans',
			false,
			true,
			fetchImpl,
		);
		expect(bytes).toStrictEqual(new Uint8Array([1, 2, 3, 4]));
	});

	it('resolves a metric-compatible clone for a family Google never published under its own name', async () => {
		// "Calibri" is not on Google Fonts; it should resolve through the same
		// clone map google-webfonts.ts already uses ("Carlito").
		const fetchImpl: FetchLike = vi.fn(async (url: string) => {
			if (url === CSS_HREF) {
				return {
					ok: true,
					text: async () =>
						`@font-face { font-family: 'Carlito'; font-style: normal; font-weight: 400; src: url(https://fonts.gstatic.com/s/carlito/latin-400.woff2) format('woff2'); unicode-range: U+0000-00FF; }`,
					arrayBuffer: async () => new ArrayBuffer(0),
				};
			}
			return {
				ok: true,
				text: async () => '',
				arrayBuffer: async () => new Uint8Array([9, 9]).buffer,
			};
		});
		const bytes = await fetchGoogleWebfontOutlineBytes(
			CSS_HREF,
			'Calibri',
			false,
			false,
			fetchImpl,
		);
		expect(bytes).toStrictEqual(new Uint8Array([9, 9]));
	});

	it('returns undefined when the family is not resolvable at all', async () => {
		const fetchImpl = fakeFetch();
		const bytes = await fetchGoogleWebfontOutlineBytes(
			CSS_HREF,
			'Definitely Not A Real Font Name 12345',
			false,
			false,
			fetchImpl,
		);
		expect(bytes).toBeUndefined();
	});

	it('returns undefined when the stylesheet fetch fails, never throws', async () => {
		const fetchImpl: FetchLike = vi.fn(async () => ({
			ok: false,
			text: async () => '',
			arrayBuffer: async () => new ArrayBuffer(0),
		}));
		await expect(
			fetchGoogleWebfontOutlineBytes(CSS_HREF, 'Open Sans', false, false, fetchImpl),
		).resolves.toBeUndefined();
	});

	it('returns undefined when the font-file fetch fails, never throws', async () => {
		const fetchImpl: FetchLike = vi.fn(async (url: string) => {
			if (url === CSS_HREF) {
				return {
					ok: true,
					text: async () => SAMPLE_CSS,
					arrayBuffer: async () => new ArrayBuffer(0),
				};
			}
			return { ok: false, text: async () => '', arrayBuffer: async () => new ArrayBuffer(0) };
		});
		await expect(
			fetchGoogleWebfontOutlineBytes(CSS_HREF, 'Open Sans', false, false, fetchImpl),
		).resolves.toBeUndefined();
	});
});
