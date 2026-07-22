import type { PptxSlide } from 'pptx-viewer-core';
import { afterEach, describe, expect, it } from 'vitest';

import { createTranslator } from '../i18n';
import { createInitialViewerState, createStore } from '../state';
import { mountAiContextMenu } from './ai-context-menu';
import { createAiFocusController } from './ai-panel-controller';

const t = createTranslator('en');

function slideWith(elementId: string): PptxSlide {
	return {
		id: 's1',
		slideNumber: 1,
		elements: [{ id: elementId, type: 'shape', x: 0, y: 0, width: 10, height: 10 }],
	} as unknown as PptxSlide;
}

function buildDom() {
	const viewport = document.createElement('div');
	const stage = document.createElement('div');
	stage.className = 'pptxv-stage';
	const el = document.createElement('div');
	el.dataset.elementId = 'el-7';
	stage.appendChild(el);
	viewport.appendChild(stage);
	document.body.appendChild(viewport);
	return { viewport, stage, el };
}

afterEach(() => {
	document.body.replaceChildren();
});

describe('mountAiContextMenu', () => {
	it('offers Ask AI / Fix with AI on a right-clicked element and pre-fills (not sends)', () => {
		const { viewport, stage, el } = buildDom();
		const store = createStore({ ...createInitialViewerState(), slides: [slideWith('el-7')] });
		let openCount = 0;
		const controller = createAiFocusController({ store, requestOpen: () => (openCount += 1) });
		const menu = mountAiContextMenu({
			doc: document,
			t,
			store,
			controller,
			viewport,
			getStageRoot: () => stage,
		});

		el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));

		const items = document.querySelectorAll('.pptxv-ai-menu-item');
		expect(items).toHaveLength(2);
		expect(items[0]?.textContent).toContain('Ask AI about this');
		expect(items[1]?.textContent).toContain('Fix with AI');
		// The element became the live selection so the pin scopes to it.
		expect(store.get().selectedElementId).toBe('el-7');

		const nonceBefore = controller.getPrefill().nonce;
		(items[1] as HTMLButtonElement).click();
		// Fix pre-fills the composer (bumped nonce, non-empty text) and opens the panel.
		const prefill = controller.getPrefill();
		expect(prefill.nonce).toBe(nonceBefore + 1);
		expect(prefill.text).toContain('slide 1');
		expect(openCount).toBeGreaterThan(0);
		// The menu closes after a choice.
		expect(document.querySelector('.pptxv-ai-menu')).toBeNull();

		menu.destroy();
	});

	it('does nothing when the right-click is not on a canvas element', () => {
		const { viewport, stage } = buildDom();
		const store = createStore(createInitialViewerState());
		const controller = createAiFocusController({ store, requestOpen: () => undefined });
		mountAiContextMenu({
			doc: document,
			t,
			store,
			controller,
			viewport,
			getStageRoot: () => stage,
		});

		viewport.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
		expect(document.querySelector('.pptxv-ai-menu')).toBeNull();
	});
});
