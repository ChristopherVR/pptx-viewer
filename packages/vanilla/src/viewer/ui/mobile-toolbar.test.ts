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

/** A control by accessible name in the shared element's shadow root; null when hidden. */
function control(toolbar: ReturnType<typeof createMobileToolbar>, name: string) {
	const button = toolbar.el.shadowRoot?.querySelector<HTMLButtonElement>(
		`button[aria-label="${name}"]`,
	);
	return button && !button.hidden ? button : null;
}

describe('createMobileToolbar', () => {
	it('omitting hiddenActions renders Undo, Redo, and Present (backward compatible default)', () => {
		const t = createTranslator();
		const toolbar = createMobileToolbar(document, t, makeHandlers());
		expect(control(toolbar, t('pptx.toolbar.undo'))).not.toBeNull();
		expect(control(toolbar, t('pptx.toolbar.redo'))).not.toBeNull();
		expect(control(toolbar, t('pptx.toolbar.present'))).not.toBeNull();
	});

	it('hides Undo and Redo independently', () => {
		const t = createTranslator();
		const toolbar = createMobileToolbar(document, t, makeHandlers(), ['undo']);
		expect(control(toolbar, t('pptx.toolbar.undo'))).toBeNull();
		expect(control(toolbar, t('pptx.toolbar.redo'))).not.toBeNull();
	});

	it("hides Present on the shared 'fullscreen' action", () => {
		const t = createTranslator();
		const toolbar = createMobileToolbar(document, t, makeHandlers(), ['fullscreen']);
		expect(control(toolbar, t('pptx.toolbar.present'))).toBeNull();
		// Save is not a hideable action; it always stays.
		expect(control(toolbar, t('pptx.toolbar.save'))).not.toBeNull();
	});

	it('setEditState does not throw when Undo/Redo are hidden', () => {
		const t = createTranslator();
		const toolbar = createMobileToolbar(document, t, makeHandlers(), ['undo', 'redo']);
		expect(() =>
			toolbar.setEditState({ editable: true, canUndo: true, canRedo: true }),
		).not.toThrow();
	});

	it('routes the controls to the handlers and never draws Share (the collaboration pill is slotted)', () => {
		const t = createTranslator();
		const handlers = makeHandlers();
		const toolbar = createMobileToolbar(document, t, handlers);
		toolbar.setEditState({ editable: true, canUndo: true, canRedo: true });
		for (const key of [
			'pptx.mobileToolbar.menu',
			'pptx.toolbar.undo',
			'pptx.toolbar.redo',
			'pptx.toolbar.save',
			'pptx.toolbar.present',
		]) {
			control(toolbar, t(key))!.click();
		}
		for (const handler of Object.values(handlers)) {
			expect(handler).toHaveBeenCalledOnce();
		}
		expect(control(toolbar, t('pptx.toolbar.share'))).toBeNull();
		expect(toolbar.collaborationHost.slot).toBe('collaboration');
		expect(toolbar.aiHost.slot).toBe('ai');
	});

	it('hides the editing controls and host slots when not editable', () => {
		const t = createTranslator();
		const toolbar = createMobileToolbar(document, t, makeHandlers());
		toolbar.setEditState({ editable: false, canUndo: false, canRedo: false });
		expect(control(toolbar, t('pptx.mobileToolbar.menu'))).toBeNull();
		expect(control(toolbar, t('pptx.toolbar.save'))).not.toBeNull();
		expect(
			toolbar.el.shadowRoot!.querySelector<HTMLElement>('slot[name="ai"]')!.hidden,
		).toBeTruthy();
	});
});
