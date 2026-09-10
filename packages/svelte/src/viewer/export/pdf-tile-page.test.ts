import { describe, expect, it, vi } from 'vitest';

import { addTiledPageImages } from './pdf-tile-page';

function fakeTileCanvas(tag: string): HTMLCanvasElement {
	return { toDataURL: () => `data:image/png;base64,${tag}` } as unknown as HTMLCanvasElement;
}

describe('addTiledPageImages', () => {
	it('draws a single full-page image for a one-tile result', () => {
		const addImage = vi.fn();
		addTiledPageImages(
			{ addImage },
			{
				fullWidth: 1920,
				fullHeight: 1080,
				tiled: false,
				tiles: [
					{
						col: 0,
						row: 0,
						x: 0,
						y: 0,
						width: 1920,
						height: 1080,
						canvas: fakeTileCanvas('a'),
						strategy: 'foreignObject',
					},
				],
			},
			960,
			540,
		);

		expect(addImage).toHaveBeenCalledExactlyOnceWith(
			'data:image/png;base64,a',
			'PNG',
			0,
			0,
			960,
			540,
		);
	});

	it('draws one image per tile, each at its proportional placement', () => {
		const addImage = vi.fn();
		addTiledPageImages(
			{ addImage },
			{
				fullWidth: 1920,
				fullHeight: 1080,
				tiled: true,
				tiles: [
					{
						col: 0,
						row: 0,
						x: 0,
						y: 0,
						width: 960,
						height: 1080,
						canvas: fakeTileCanvas('left'),
						strategy: 'foreignObject',
					},
					{
						col: 1,
						row: 0,
						x: 960,
						y: 0,
						width: 960,
						height: 1080,
						canvas: fakeTileCanvas('right'),
						strategy: 'foreignObject',
					},
				],
			},
			960,
			540,
		);

		expect(addImage).toHaveBeenCalledTimes(2);
		expect(addImage).toHaveBeenNthCalledWith(
			1,
			'data:image/png;base64,left',
			'PNG',
			0,
			0,
			480,
			540,
		);
		expect(addImage).toHaveBeenNthCalledWith(
			2,
			'data:image/png;base64,right',
			'PNG',
			480,
			0,
			480,
			540,
		);
	});
});
