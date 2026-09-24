import html2canvasPro from 'html2canvas-pro';
import { describe, expect, it, vi } from 'vitest';

import { renderToCanvas } from './render-to-canvas';

vi.mock(import('html2canvas-pro'), () => ({ default: vi.fn() }));

/**
 * The html2canvas `onclone` pass is the shared `prepareHtml2CanvasClone`:
 * editor-only nodes leave the clone, and a ready `<pptx-three-view>` (faked
 * here by its marker attribute plus the element's state/canvas surface)
 * becomes an `<img>` of its live pixels before the caller's own onclone runs.
 */
function liveStage(): HTMLElement {
	const stage = document.createElement('div');
	stage.innerHTML =
		'<div data-export-ignore="true">Cursor</div><div data-pptx-three-view="" data-state="ready"><span>2D fallback</span></div>';
	const view = stage.querySelector('[data-pptx-three-view]') as HTMLElement;
	const canvas = document.createElement('canvas');
	canvas.width = 20;
	canvas.height = 10;
	Object.assign(canvas, { toDataURL: () => 'data:image/png;base64,view' });
	Object.assign(view, { state: 'ready', spec: {}, canvas, flush: () => {} });
	return stage;
}

describe('renderToCanvas clone pass (shared prepareHtml2CanvasClone)', () => {
	it('drops editor-only nodes and snapshots 3D views before the caller onclone', async () => {
		const source = liveStage();
		const clone = source.cloneNode(true) as HTMLElement;
		const canvas = document.createElement('canvas');
		vi.mocked(html2canvasPro).mockImplementationOnce(async (_element, options) => {
			await options!.onclone!(document, clone);
			return canvas;
		});
		const onclone = vi.fn((_doc: Document, element: HTMLElement) => {
			expect(element.querySelector('[data-export-ignore]')).toBeNull();
			const img = element.querySelector('img[data-three-view-snapshot="true"]');
			expect(img?.getAttribute('src')).toBe('data:image/png;base64,view');
			expect(element.textContent).not.toContain('2D fallback');
		});

		await expect(renderToCanvas(source, { onclone })).resolves.toBe(canvas);

		expect(onclone).toHaveBeenCalledOnce();
		expect(source.querySelector('[data-export-ignore]')).not.toBeNull();
		expect(source.textContent).toContain('2D fallback');
	});
});
