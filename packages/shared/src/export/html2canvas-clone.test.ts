// @vitest-environment jsdom
/**
 * Unit tests for html2canvas-clone.ts: the shared `onclone` pass swaps each
 * `<pptx-three-view>` in html2canvas's clone for its live pixels plus its DOM
 * overlay, and drops editor-only nodes, before the colour/CSS passes.
 *
 * html2canvas re-creates a custom element as a `<div>` that keeps the
 * element's attributes and gets its own (cloned) shadow root, and it clones
 * into a separate iframe document. Both are simulated here, and the live view
 * is a `<div>` carrying the marker plus the `state`/`canvas`/`flush` surface
 * of the real element (which is not registered in jsdom).
 */
import { describe, expect, it } from 'vitest';

import { THREE_VIEW_MARKER_ATTR } from '../three-view/element';
import { THREE_VIEW_SNAPSHOT_ATTR } from '../three-view/export-snapshot';
import { prepareHtml2CanvasClone } from './html2canvas-clone';

const PIXELS = 'data:image/png;base64,chart';

function liveSlide(): HTMLElement {
	const slide = document.createElement('div');
	const view = document.createElement('div');
	view.setAttribute(THREE_VIEW_MARKER_ATTR, '');
	view.setAttribute('data-state', 'ready');
	const shadow = view.attachShadow({ mode: 'open' });
	shadow.innerHTML =
		'<div class="stage"><canvas></canvas><div class="overlay"><svg class="chrome"><text>Chart Title</text></svg></div></div>';
	const canvas = shadow.querySelector('canvas') as HTMLCanvasElement;
	canvas.width = 40;
	canvas.height = 30;
	(canvas as unknown as { toDataURL: () => string }).toDataURL = () => PIXELS;
	Object.assign(view, { state: 'ready', spec: {}, canvas, flush: () => {} });
	view.append(Object.assign(document.createElement('span'), { className: 'fallback-2d' }));
	const handle = document.createElement('div');
	handle.setAttribute('data-export-ignore', 'true');
	slide.append(view, handle);
	document.body.append(slide);
	return slide;
}

/** What html2canvas hands `onclone`: a copy in its own document, views as shadow-hosting divs. */
function html2canvasClone(live: HTMLElement): { doc: Document; clonedEl: HTMLElement } {
	const doc = document.implementation.createHTMLDocument('capture');
	const clonedEl = doc.importNode(live, true) as HTMLElement;
	doc.body.append(clonedEl);
	const view = clonedEl.querySelector(`[${THREE_VIEW_MARKER_ATTR}]`) as HTMLElement;
	view.attachShadow({ mode: 'open' }).innerHTML = '<canvas></canvas><span>fallback copy</span>';
	return { doc, clonedEl };
}

describe('prepareHtml2CanvasClone', () => {
	it('replaces a ready 3D view with its pixels and overlay, in light and shadow DOM', async () => {
		const live = liveSlide();
		const { doc, clonedEl } = html2canvasClone(live);

		await prepareHtml2CanvasClone(live, doc, clonedEl);

		const view = clonedEl.querySelector(`[${THREE_VIEW_MARKER_ATTR}]`) as HTMLElement;
		for (const root of [view, view.shadowRoot as ShadowRoot]) {
			const img = root.querySelector<HTMLImageElement>(`img[${THREE_VIEW_SNAPSHOT_ATTR}="true"]`);
			expect(img?.getAttribute('src')).toBe(PIXELS);
			const overlay = root.querySelector(`[${THREE_VIEW_SNAPSHOT_ATTR}="overlay"]`);
			expect(overlay?.querySelector('svg.chrome')?.textContent).toBe('Chart Title');
			expect(root.querySelector('canvas')).toBeNull();
			expect(root.querySelector('.fallback-2d')).toBeNull();
		}
		// The copies belong to html2canvas's document, not the live one.
		expect(view.firstElementChild?.ownerDocument).toBe(doc);
		live.remove();
	});

	it('drops editor-only nodes from the clone and leaves the live tree untouched', async () => {
		const live = liveSlide();
		const { doc, clonedEl } = html2canvasClone(live);

		await prepareHtml2CanvasClone(live, doc, clonedEl);

		expect(clonedEl.querySelector('[data-export-ignore="true"]')).toBeNull();
		expect(live.querySelector('[data-export-ignore="true"]')).not.toBeNull();
		expect(live.querySelector('.fallback-2d')).not.toBeNull();
		live.remove();
	});

	it('keeps the 2D fallback of a view that never became ready', async () => {
		const live = liveSlide();
		const liveView = live.querySelector(`[${THREE_VIEW_MARKER_ATTR}]`) as HTMLElement;
		Object.assign(liveView, { state: 'unavailable' });
		const { doc, clonedEl } = html2canvasClone(live);

		await prepareHtml2CanvasClone(live, doc, clonedEl);

		expect(clonedEl.querySelector(`img[${THREE_VIEW_SNAPSHOT_ATTR}]`)).toBeNull();
		expect(clonedEl.querySelector('.fallback-2d')).not.toBeNull();
		live.remove();
	});
});
