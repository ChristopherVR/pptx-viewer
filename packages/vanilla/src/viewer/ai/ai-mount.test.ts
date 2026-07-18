import type { PptxAiConfig } from 'pptx-viewer-shared/ai';
import { afterEach, describe, expect, it } from 'vitest';

import { createPptxViewer, PptxViewer } from '../PptxViewer';
import type { PptxViewerInstance } from '../types';

let active: PptxViewerInstance[] = [];

function mount(options?: ConstructorParameters<typeof PptxViewer>[1]): HTMLElement {
	const container = document.createElement('div');
	document.body.appendChild(container);
	const viewer = createPptxViewer(container, options);
	active.push(viewer);
	return container;
}

afterEach(() => {
	for (const viewer of active) {
		viewer.destroy();
	}
	active = [];
	document.body.replaceChildren();
});

// A config whose transport is only touched if the panel is actually opened, so
// the gating checks never construct a chat or hit the network.
const aiConfig: PptxAiConfig = {
	connection: { kind: 'transport', transport: {} as never },
};

describe('ai chat mounting', () => {
	it('adds no AI toggle or panel when the `ai` option is absent', () => {
		const container = mount();
		expect(container.querySelector('.pptxv-ai-toggle')).toBeNull();
		expect(container.querySelector('.pptxv-ai-panel')).toBeNull();
	});

	it('adds a title-bar toggle and a hidden panel host when `ai` is provided', () => {
		const container = mount({ ai: aiConfig });
		const toggle = container.querySelector<HTMLButtonElement>('.pptxv-ai-toggle');
		expect(toggle).toBeTruthy();
		expect(toggle?.getAttribute('aria-expanded')).toBe('false');
		const panel = container.querySelector<HTMLElement>('.pptxv-ai-panel');
		expect(panel).toBeTruthy();
		// The panel is mounted but hidden until the toggle is first clicked; the
		// heavy panel builder (and the optional `ai` SDK) load lazily on open.
		expect(panel?.hidden).toBeTruthy();
		expect(panel?.childElementCount).toBe(0);
	});

	it('removes the toggle + panel on destroy', () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const viewer = createPptxViewer(container, { ai: aiConfig });
		expect(container.querySelector('.pptxv-ai-toggle')).toBeTruthy();
		viewer.destroy();
		expect(container.querySelector('.pptxv-ai-toggle')).toBeNull();
		expect(container.querySelector('.pptxv-ai-panel')).toBeNull();
	});
});
