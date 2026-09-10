import { describe, expect, it, vi } from 'vitest';

import { exportAllSlidesAsGif } from './export-gif';
import { renderElementToTiledCanvas } from './export-helpers';

vi.mock<typeof import('./export-helpers')>(import('./export-helpers'), () => ({
	downloadBlob: vi.fn(),
	downloadDataUrl: vi.fn(),
	renderElementToRaster: vi.fn(),
	renderElementToTiles: vi.fn(),
	renderElementToTiledCanvas: vi.fn(() => {
		const imageData = { data: new Uint8ClampedArray(4 * 4 * 4), width: 4, height: 4 };
		const canvas = {
			width: 4,
			height: 4,
			getContext: () => ({ getImageData: () => imageData }),
		} as unknown as HTMLCanvasElement;
		return Promise.resolve({
			kind: 'canvas' as const,
			canvas,
			strategy: 'foreignObject' as const,
			width: 4,
			height: 4,
			tiled: false,
		});
	}),
	rasterResultToPngBlob: vi.fn(),
	rasterResultToPngDataUrl: vi.fn(),
	waitForRender: vi.fn(() => Promise.resolve()),
}));

function makeMockElement(): HTMLElement {
	return {} as HTMLElement;
}

describe('exportAllSlidesAsGif', () => {
	it('captures every slide via the tiled foreignObject-fidelity path, not raw html2canvas', async () => {
		const stageEl = makeMockElement();
		const ref = { current: stageEl } as React.RefObject<HTMLElement | null>;

		const blob = await exportAllSlidesAsGif(ref, 2, vi.fn(), 0);

		expect(renderElementToTiledCanvas).toHaveBeenCalledTimes(2);
		expect(renderElementToTiledCanvas).toHaveBeenCalledWith(stageEl, 0.5);
		expect(blob.type).toBe('image/gif');
	});

	it('throws when no slide stage was ever found', async () => {
		const ref = { current: null } as React.RefObject<HTMLElement | null>;

		await expect(exportAllSlidesAsGif(ref, 2, vi.fn(), 0)).rejects.toThrow(
			'No slides were captured for GIF export',
		);
	});

	it('rejects with AbortError before capturing anything when already cancelled', async () => {
		vi.mocked(renderElementToTiledCanvas).mockClear();
		const ref = { current: makeMockElement() } as React.RefObject<HTMLElement | null>;

		await expect(
			exportAllSlidesAsGif(ref, 2, vi.fn(), 0, { signal: AbortSignal.abort() }),
		).rejects.toMatchObject({ name: 'AbortError' });

		expect(renderElementToTiledCanvas).not.toHaveBeenCalled();
	});
});
