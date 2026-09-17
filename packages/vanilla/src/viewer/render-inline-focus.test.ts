import { createTextElement, PptxHandler } from 'pptx-viewer-core';
import { expect, test } from 'vitest';

import { PptxViewer } from './PptxViewer';

test('preserves plain inline focus and selection while repainting another element', async () => {
	const container = document.createElement('div');
	document.body.appendChild(container);
	const viewer = new PptxViewer(container, { editable: true });
	const { handler, data } = await PptxHandler.create({ initialSlideCount: 1 });
	data.slides[0].elements.push(createTextElement('Local text'), createTextElement('Remote text'));
	try {
		await viewer.loadFile(await handler.save(data.slides));
		const target = [...container.querySelectorAll<HTMLElement>('[data-pptx-element="true"]')].find(
			(node) => node.textContent?.includes('Local text'),
		)!;
		target.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
		const surface = container.querySelector<HTMLElement>('[data-inline-editor]')!;
		expect(surface).not.toBeNull();
		surface.focus();
		const range = document.createRange();
		range.selectNodeContents(surface);
		range.collapse(false);
		window.getSelection()!.removeAllRanges();
		window.getSelection()!.addRange(range);
		const anchor = window.getSelection()!.anchorNode;
		const slides = viewer.store.get().slides.map((slide) => ({
			...slide,
			elements: slide.elements.map((element) =>
				'text' in element && element.text === 'Remote text'
					? {
							...element,
							text: 'Peer changed this',
							textSegments: [{ text: 'Peer changed this', style: {} }],
						}
					: element,
			),
		}));
		viewer.store.set({ slides });
		expect(container.querySelector('[data-inline-editor]')).toBe(surface);
		expect(document.activeElement).toBe(surface);
		expect(window.getSelection()!.anchorNode).toBe(anchor);
	} finally {
		viewer.destroy();
		handler.dispose();
		container.remove();
	}
});
