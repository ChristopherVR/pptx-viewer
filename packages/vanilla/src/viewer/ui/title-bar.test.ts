import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../i18n';
import type { TitleBarDeps } from './title-bar';
import { createTitleBar } from './title-bar';

function makeDeps(over: Partial<TitleBarDeps> = {}): TitleBarDeps {
	return {
		autosaveEnabled: false,
		onToggleAutosave: vi.fn(() => true),
		save: vi.fn(),
		undo: vi.fn(),
		redo: vi.fn(),
		commands: [],
		...over,
	};
}

describe('createTitleBar', () => {
	it('omitting hiddenActions renders both Undo and Redo (backward compatible default)', () => {
		const t = createTranslator();
		const titleBar = createTitleBar(document, t, makeDeps());
		expect(titleBar.el.querySelector(`[aria-label="${t('pptx.toolbar.undo')}"]`)).not.toBeNull();
		expect(titleBar.el.querySelector(`[aria-label="${t('pptx.toolbar.redo')}"]`)).not.toBeNull();
	});

	it('hides Undo independently of Redo', () => {
		const t = createTranslator();
		const titleBar = createTitleBar(document, t, makeDeps({ hiddenActions: ['undo'] }));
		expect(titleBar.el.querySelector(`[aria-label="${t('pptx.toolbar.undo')}"]`)).toBeNull();
		expect(titleBar.el.querySelector(`[aria-label="${t('pptx.toolbar.redo')}"]`)).not.toBeNull();
	});

	it('hides Redo independently of Undo', () => {
		const t = createTranslator();
		const titleBar = createTitleBar(document, t, makeDeps({ hiddenActions: ['redo'] }));
		expect(titleBar.el.querySelector(`[aria-label="${t('pptx.toolbar.undo')}"]`)).not.toBeNull();
		expect(titleBar.el.querySelector(`[aria-label="${t('pptx.toolbar.redo')}"]`)).toBeNull();
	});

	it('setEditState does not throw when both Undo and Redo are hidden', () => {
		const t = createTranslator();
		const titleBar = createTitleBar(document, t, makeDeps({ hiddenActions: ['undo', 'redo'] }));
		expect(() =>
			titleBar.setEditState({ editable: true, canUndo: true, canRedo: true }),
		).not.toThrow();
	});
});
