import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../i18n';
import type { MobileToolbarHandlers } from './mobile-toolbar';
import { createMobileToolbar } from './mobile-toolbar';

function makeHandlers(): MobileToolbarHandlers {
	return {
		openMenu: vi.fn(),
		undo: vi.fn(),
		redo: vi.fn(),
		save: vi.fn(),
		present: vi.fn(),
	};
}

describe('createMobileToolbar', () => {
	it('omitting hiddenActions renders Undo, Redo, and Present (backward compatible default)', () => {
		const t = createTranslator();
		const toolbar = createMobileToolbar(document, t, makeHandlers());
		expect(toolbar.el.querySelector(`[aria-label="${t('pptx.toolbar.undo')}"]`)).not.toBeNull();
		expect(toolbar.el.querySelector(`[aria-label="${t('pptx.toolbar.redo')}"]`)).not.toBeNull();
		expect(toolbar.el.querySelector(`[aria-label="${t('pptx.toolbar.present')}"]`)).not.toBeNull();
	});

	it('hides Undo and Redo independently', () => {
		const t = createTranslator();
		const toolbar = createMobileToolbar(document, t, makeHandlers(), ['undo']);
		expect(toolbar.el.querySelector(`[aria-label="${t('pptx.toolbar.undo')}"]`)).toBeNull();
		expect(toolbar.el.querySelector(`[aria-label="${t('pptx.toolbar.redo')}"]`)).not.toBeNull();
	});

	it("hides Present on the shared 'fullscreen' action", () => {
		const t = createTranslator();
		const toolbar = createMobileToolbar(document, t, makeHandlers(), ['fullscreen']);
		expect(toolbar.el.querySelector(`[aria-label="${t('pptx.toolbar.present')}"]`)).toBeNull();
		// Save is not a hideable action; it always stays.
		expect(toolbar.el.querySelector(`[aria-label="${t('pptx.toolbar.save')}"]`)).not.toBeNull();
	});

	it('setEditState does not throw when Undo/Redo are hidden', () => {
		const t = createTranslator();
		const toolbar = createMobileToolbar(document, t, makeHandlers(), ['undo', 'redo']);
		expect(() =>
			toolbar.setEditState({ editable: true, canUndo: true, canRedo: true }),
		).not.toThrow();
	});
});
