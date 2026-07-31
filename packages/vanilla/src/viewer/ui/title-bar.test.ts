import { DEFAULT_VIEWER_OPTIONS } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../i18n';
import type { TitleBarDeps, TitleBarQuickAccessState } from './title-bar';
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

/**
 * The strip's CONTENTS are options-driven. Four of the five bindings used to
 * hardcode Save/Undo/Redo and ignore the options model, so this pins that the
 * shipped default reaches the DOM and that a reconfigured list follows.
 */
describe('the quick-access strip follows File > Options', () => {
	function withQuickAccess(state: Partial<TitleBarQuickAccessState>, run = vi.fn()) {
		const t = createTranslator();
		const titleBar = createTitleBar(
			document,
			t,
			makeDeps({
				quickAccess: {
					getState: () => ({
						visible: true,
						showCommandLabels: false,
						commandIds: DEFAULT_VIEWER_OPTIONS.quickAccess.commandIds,
						...state,
					}),
					run,
					screenTip: (label) => label,
				},
			}),
		);
		const labels = [...titleBar.el.querySelectorAll('.pptxv-qat button')].map((button) =>
			button.getAttribute('aria-label'),
		);
		return { t, titleBar, labels, run };
	}

	it('renders the shipped default, which is four commands and not three', () => {
		const { t, labels } = withQuickAccess({});
		expect(labels).toStrictEqual([
			t('pptx.toolbar.save'),
			t('pptx.toolbar.undo'),
			t('pptx.toolbar.redo'),
			t('pptx.options.quickAccess.command.presentFromStart'),
		]);
	});

	it('honours a reconfigured order and drops unknown ids', () => {
		const { t, labels } = withQuickAccess({ commandIds: ['print', 'save', 'nope'] });
		expect(labels).toStrictEqual([
			t('pptx.options.quickAccess.command.print'),
			t('pptx.toolbar.save'),
		]);
	});

	it('routes a non-core command to the host runner', () => {
		const { titleBar, t, run } = withQuickAccess({ commandIds: ['presentFromStart'] });
		titleBar.el
			.querySelector<HTMLButtonElement>(
				`.pptxv-qat button[aria-label="${t('pptx.options.quickAccess.command.presentFromStart')}"]`,
			)
			?.click();
		expect(run).toHaveBeenCalledWith('presentFromStart');
	});

	it('hides the whole strip when the options hide it', () => {
		const { titleBar } = withQuickAccess({ visible: false });
		expect(titleBar.el.querySelector<HTMLElement>('.pptxv-qat')?.hidden).toBeTruthy();
	});
});
