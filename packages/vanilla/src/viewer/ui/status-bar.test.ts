import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../i18n';
import type { StatusBarHandlers } from './status-bar';
import { createStatusBar } from './status-bar';

function makeHandlers(): StatusBarHandlers {
	return {
		toggleNotes: vi.fn(),
		openSlideSorter: vi.fn(),
		togglePresentation: vi.fn(),
		zoomIn: vi.fn(),
		zoomOut: vi.fn(),
		zoomToFit: vi.fn(),
	};
}

describe('createStatusBar', () => {
	it('omitting hiddenActions renders notes, slide show, and the zoom cluster (backward compatible default)', () => {
		const t = createTranslator();
		const statusBar = createStatusBar(document, t, makeHandlers());
		expect(statusBar.el.querySelector('.pptxv-statusbar-notes')).not.toBeNull();
		expect(
			statusBar.el.querySelector(`[aria-label="${t('pptx.statusBar.slideShow')}"]`),
		).not.toBeNull();
		expect(statusBar.el.querySelector('.pptxv-statusbar-zoom')).not.toBeNull();
	});

	it("hides the notes toggle on 'notes' without affecting zoom/fullscreen", () => {
		const t = createTranslator();
		const statusBar = createStatusBar(document, t, makeHandlers(), ['notes']);
		expect(statusBar.el.querySelector('.pptxv-statusbar-notes')).toBeNull();
		expect(statusBar.el.querySelector('.pptxv-statusbar-zoom')).not.toBeNull();
		expect(
			statusBar.el.querySelector(`[aria-label="${t('pptx.statusBar.slideShow')}"]`),
		).not.toBeNull();
	});

	it("hides the slide-show toggle on 'fullscreen'", () => {
		const t = createTranslator();
		const statusBar = createStatusBar(document, t, makeHandlers(), ['fullscreen']);
		expect(
			statusBar.el.querySelector(`[aria-label="${t('pptx.statusBar.slideShow')}"]`),
		).toBeNull();
	});

	it("hides the whole zoom cluster on 'zoom' and update() no longer touches it", () => {
		const t = createTranslator();
		const statusBar = createStatusBar(document, t, makeHandlers(), ['zoom']);
		expect(statusBar.el.querySelector('.pptxv-statusbar-zoom')).toBeNull();
		expect(() => statusBar.update({ current: 0, total: 3, zoomPercent: 150 })).not.toThrow();
	});
});
