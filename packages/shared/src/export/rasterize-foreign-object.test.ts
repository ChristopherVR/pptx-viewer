// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	FOREIGN_OBJECT_SVG_DATA_URL_PREFIX,
	ForeignObjectRasterError,
	foreignObjectSvgToDataUrl,
	rasterizeForeignObjectSvg,
} from './rasterize-foreign-object';

const SVG =
	'<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div>a & b</div></foreignObject></svg>';

/** Minimal `Image` stand-in that fires `onload` (or `onerror`) on `src` assignment. */
function installFakeImage(outcome: 'load' | 'error'): { srcs: string[] } {
	const srcs: string[] = [];
	class FakeImage {
		onload: (() => void) | null = null;
		onerror: ((event: unknown) => void) | null = null;
		#src = '';
		get src(): string {
			return this.#src;
		}
		set src(value: string) {
			this.#src = value;
			srcs.push(value);
			queueMicrotask(() => {
				if (outcome === 'load') {
					this.onload?.();
				} else {
					this.onerror?.(new Event('error'));
				}
			});
		}
	}
	vi.stubGlobal('Image', FakeImage);
	return { srcs };
}

function installFakeCanvas(tainted: boolean): { drawImage: ReturnType<typeof vi.fn> } {
	const drawImage = vi.fn();
	const ctx = {
		fillStyle: '',
		fillRect: vi.fn(),
		drawImage,
		getImageData: tainted
			? vi.fn(() => {
					throw new DOMException('tainted', 'SecurityError');
				})
			: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
	};
	vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
		ctx as unknown as CanvasRenderingContext2D,
	);
	return { drawImage };
}

describe('foreignObjectSvgToDataUrl', () => {
	it('encodes the SVG as a data: URL, never a blob: object URL', () => {
		const url = foreignObjectSvgToDataUrl(SVG);
		expect(url.startsWith(FOREIGN_OBJECT_SVG_DATA_URL_PREFIX)).toBeTruthy();
		expect(decodeURIComponent(url.slice(FOREIGN_OBJECT_SVG_DATA_URL_PREFIX.length))).toBe(SVG);
		// The e2e fallback stub keys on this exact encoded token.
		expect(url).toContain('%3CforeignObject');
	});
});

describe('rasterizeForeignObjectSvg', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('loads the SVG through a data: URL (a blob: URL taints the canvas in Chromium)', async () => {
		const { srcs } = installFakeImage('load');
		const { drawImage } = installFakeCanvas(false);
		const createObjectURL = vi.fn();
		vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL: vi.fn() });

		const canvas = await rasterizeForeignObjectSvg(SVG, 40, 30, '#fff');

		expect(srcs).toStrictEqual([foreignObjectSvgToDataUrl(SVG)]);
		expect(createObjectURL).not.toHaveBeenCalled();
		expect(canvas.width).toBe(40);
		expect(canvas.height).toBe(30);
		expect(drawImage).toHaveBeenCalledOnce();
	});

	it('throws a typed error when the image fails to load', async () => {
		installFakeImage('error');
		installFakeCanvas(false);
		await expect(rasterizeForeignObjectSvg(SVG, 4, 4)).rejects.toBeInstanceOf(
			ForeignObjectRasterError,
		);
	});

	it('throws a typed error when the drawn canvas cannot be read back', async () => {
		installFakeImage('load');
		installFakeCanvas(true);
		await expect(rasterizeForeignObjectSvg(SVG, 4, 4)).rejects.toThrow(/tainted/u);
	});
});
