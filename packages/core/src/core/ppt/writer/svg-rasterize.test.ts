import { afterEach, describe, expect, it, vi } from 'vitest';

import { rasterizeSvg, svgRasterSize } from './svg-rasterize';
import { rasterizeSvgInNode } from './svg-rasterize-node';

vi.mock(import('./svg-rasterize-node'), () => ({
	rasterizeSvgInNode: vi.fn(async () => new Uint8Array([9, 9])),
}));

const SVG = new TextEncoder().encode(
	'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="60"/>',
);
const DOM_PNG = new Uint8Array([1, 2, 3]);

/** A browser-shaped runtime whose canvas records the size it was given. */
function stubBrowserCanvas(): { size: { width: number; height: number } } {
	const drawn = { size: { width: 0, height: 0 } };
	class FakeImage {
		naturalWidth = 100;
		naturalHeight = 60;
		onload: (() => void) | null = null;
		onerror: (() => void) | null = null;
		#src = '';
		get src(): string {
			return this.#src;
		}
		set src(url: string) {
			this.#src = url;
			queueMicrotask(() => this.onload?.());
		}
	}
	const canvas = {
		width: 0,
		height: 0,
		getContext: () => ({ drawImage: () => undefined }),
		toBlob(callback: (blob: Blob | null) => void) {
			drawn.size = { width: canvas.width, height: canvas.height };
			callback(new Blob([DOM_PNG]));
		},
	};
	vi.stubGlobal('Image', FakeImage);
	vi.stubGlobal('document', { createElement: () => canvas });
	vi.stubGlobal('URL', {
		createObjectURL: () => 'blob:svg',
		revokeObjectURL: () => undefined,
	});
	return drawn;
}

afterEach(() => {
	vi.unstubAllGlobals();
	vi.mocked(rasterizeSvgInNode).mockClear();
});

describe('rasterizeSvg', () => {
	it("uses the browser's own canvas when there is a DOM, never the Node canvas package", async () => {
		const drawn = stubBrowserCanvas();
		const picture = await rasterizeSvg(SVG, 10, 10);
		expect(picture).toStrictEqual({ extension: 'png', bytes: DOM_PNG });
		expect(drawn.size).toStrictEqual({ width: 200, height: 120 });
		expect(rasterizeSvgInNode).not.toHaveBeenCalled();
	});

	it('falls back to the Node canvas package only without a DOM', async () => {
		vi.stubGlobal('document', undefined);
		const picture = await rasterizeSvg(SVG, 10, 10);
		expect(picture).toStrictEqual({ extension: 'png', bytes: new Uint8Array([9, 9]) });
		expect(rasterizeSvgInNode).toHaveBeenCalledOnce();
	});
});

describe('svgRasterSize', () => {
	it('doubles the intrinsic size and clamps the longest edge to 2048 px', () => {
		expect(svgRasterSize(100, 60, 0, 0)).toStrictEqual({ width: 200, height: 120 });
		expect(svgRasterSize(0, 0, 50, 40)).toStrictEqual({ width: 100, height: 80 });
		expect(svgRasterSize(4096, 1024, 0, 0)).toStrictEqual({ width: 2048, height: 512 });
	});
});
