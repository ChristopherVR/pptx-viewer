import { DEFAULT_VIEWER_OPTIONS } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../i18n';
import type { TitleBarDeps, TitleBarQuickAccessState } from './title-bar';
import { createTitleBar } from './title-bar';

function makeDeps(over: Partial<TitleBarDeps> = {}): TitleBarDeps {
	return {
		// The viewer now starts the switch ON wherever the host permits autosave
		// (the option is a policy ceiling, not the user's preference).
		autosaveEnabled: true,
		onToggleAutosave: vi.fn(() => true),
		save: vi.fn(),
		undo: vi.fn(),
		redo: vi.fn(),
		commands: [],
		...over,
	};
}

/** The shared element keeps its markup in an open shadow root. */
const shadow = (el: HTMLElement): ShadowRoot => el.shadowRoot as ShadowRoot;
const named = (el: HTMLElement, name: string) => shadow(el).querySelector(`[aria-label="${name}"]`);

describe('createTitleBar', () => {
	it('is the shared pptx-ui-title-bar element', () => {
		const titleBar = createTitleBar(document, createTranslator(), makeDeps());
		expect(titleBar.el.localName).toBe('pptx-ui-title-bar');
		expect(titleBar.el.hasAttribute('data-pptx-title-bar')).toBeTruthy();
		expect(titleBar.getQuickAccessElement().hasAttribute('data-pptx-title-bar')).toBeFalsy();
	});

	it('omitting hiddenActions renders both Undo and Redo (backward compatible default)', () => {
		const t = createTranslator();
		const titleBar = createTitleBar(document, t, makeDeps());
		expect(named(titleBar.el, t('pptx.toolbar.undo'))).not.toBeNull();
		expect(named(titleBar.el, t('pptx.toolbar.redo'))).not.toBeNull();
	});

	it('hides Undo independently of Redo', () => {
		const t = createTranslator();
		const titleBar = createTitleBar(document, t, makeDeps({ hiddenActions: ['undo'] }));
		expect(named(titleBar.el, t('pptx.toolbar.undo'))).toBeNull();
		expect(named(titleBar.el, t('pptx.toolbar.redo'))).not.toBeNull();
	});

	it('hides Redo independently of Undo', () => {
		const t = createTranslator();
		const titleBar = createTitleBar(document, t, makeDeps({ hiddenActions: ['redo'] }));
		expect(named(titleBar.el, t('pptx.toolbar.undo'))).not.toBeNull();
		expect(named(titleBar.el, t('pptx.toolbar.redo'))).toBeNull();
	});

	it('setEditState does not throw when both Undo and Redo are hidden', () => {
		const t = createTranslator();
		const titleBar = createTitleBar(document, t, makeDeps({ hiddenActions: ['undo', 'redo'] }));
		expect(() =>
			titleBar.setEditState({ editable: true, canUndo: true, canRedo: true }),
		).not.toThrow();
	});

	it('routes strip activations and command search to the viewer handlers', () => {
		const t = createTranslator();
		const deps = makeDeps({
			commands: [{ labelKey: 'pptx.titleBar.save', run: vi.fn() }],
		});
		const titleBar = createTitleBar(document, t, deps);
		titleBar.setEditState({ editable: true, canUndo: true, canRedo: true });
		(named(titleBar.el, t('pptx.titleBar.save')) as HTMLButtonElement).click();
		(named(titleBar.el, t('pptx.toolbar.undo')) as HTMLButtonElement).click();
		(named(titleBar.el, t('pptx.toolbar.redo')) as HTMLButtonElement).click();
		expect(deps.save).toHaveBeenCalledOnce();
		expect(deps.undo).toHaveBeenCalledOnce();
		expect(deps.redo).toHaveBeenCalledOnce();
		titleBar.el.dispatchEvent(
			new CustomEvent('command-search', { detail: { query: 'sa', command: '0' } }),
		);
		expect(deps.commands[0]?.run).toHaveBeenCalledOnce();
	});

	it('enables undo/redo from the edit state and hides editing parts when read-only', () => {
		const t = createTranslator();
		const titleBar = createTitleBar(document, t, makeDeps());
		titleBar.setEditState({ editable: true, canUndo: true, canRedo: false });
		const undo = named(titleBar.el, t('pptx.toolbar.undo')) as HTMLButtonElement;
		const redo = named(titleBar.el, t('pptx.toolbar.redo')) as HTMLButtonElement;
		expect([undo.disabled, redo.disabled]).toStrictEqual([false, true]);
		titleBar.setEditState({ editable: false, canUndo: false, canRedo: false });
		expect(shadow(titleBar.el).querySelector<HTMLElement>('.qat')?.hidden).toBeTruthy();
		expect(shadow(titleBar.el).querySelector<HTMLElement>('.autosave')?.hidden).toBeTruthy();
	});
});

/**
 * The AutoSave switch is the user's PREFERENCE inside the host's policy: it
 * starts on, and it goes inert (not merely ignored) when the host passed
 * `autosave: false`, because a switch that silently does nothing is worse than
 * a visibly disabled one.
 */
describe('the title-bar AutoSave switch', () => {
	function autosaveSwitch(deps: Partial<TitleBarDeps> = {}) {
		const t = createTranslator();
		const titleBar = createTitleBar(document, t, makeDeps(deps));
		const toggle = shadow(titleBar.el).querySelector<HTMLButtonElement>('.switch');
		return { t, titleBar, toggle: toggle as HTMLButtonElement };
	}

	it('starts on and reports its state through aria-checked', () => {
		const { toggle } = autosaveSwitch();
		expect(toggle.getAttribute('aria-checked')).toBe('true');
		expect(toggle.disabled).toBeFalsy();
	});

	it('flips to whatever the viewer reports back', () => {
		const onToggleAutosave = vi.fn(() => false);
		const { toggle } = autosaveSwitch({ onToggleAutosave });
		toggle.click();
		expect(onToggleAutosave).toHaveBeenCalledOnce();
		expect(toggle.getAttribute('aria-checked')).toBe('false');
	});

	it('follows a host-driven change', () => {
		const { titleBar, toggle } = autosaveSwitch();
		titleBar.setAutosaveEnabled(false);
		expect(toggle.getAttribute('aria-checked')).toBe('false');
	});

	it('is inert when the host forbade autosave', () => {
		const onToggleAutosave = vi.fn(() => true);
		const { t, toggle } = autosaveSwitch({
			autosaveEnabled: false,
			autosaveToggleAvailable: false,
			onToggleAutosave,
		});
		expect(toggle.disabled).toBeTruthy();
		expect(toggle.title).toBe(t('pptx.autosave.disabledByHost'));
		toggle.click();
		expect(onToggleAutosave).not.toHaveBeenCalled();
		expect(toggle.getAttribute('aria-checked')).toBe('false');
	});
});

/**
 * The strip's CONTENTS are options-driven. Save, Undo and Redo always lead (in
 * that order), then the other configured commands in File > Options order.
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
		const labels = [...shadow(titleBar.el).querySelectorAll('.qat button')].map((button) =>
			button.getAttribute('aria-label'),
		);
		return { t, titleBar, labels, run };
	}

	it('renders the shipped default, which is four commands and not three', () => {
		const { t, labels } = withQuickAccess({});
		expect(labels).toStrictEqual([
			t('pptx.titleBar.save'),
			t('pptx.toolbar.undo'),
			t('pptx.toolbar.redo'),
			t('pptx.options.quickAccess.command.presentFromStart'),
		]);
	});

	it('keeps the trio first, follows the configured order for the rest and drops unknown ids', () => {
		const { t, labels } = withQuickAccess({ commandIds: ['print', 'zoomIn', 'nope'] });
		expect(labels).toStrictEqual([
			t('pptx.titleBar.save'),
			t('pptx.toolbar.undo'),
			t('pptx.toolbar.redo'),
			t('pptx.options.quickAccess.command.print'),
			t('pptx.options.quickAccess.command.zoomIn'),
		]);
	});

	it('routes a non-core command to the host runner', () => {
		const { titleBar, t, run } = withQuickAccess({ commandIds: ['presentFromStart'] });
		(
			named(
				titleBar.el,
				t('pptx.options.quickAccess.command.presentFromStart'),
			) as HTMLButtonElement
		).click();
		expect(run).toHaveBeenCalledWith('presentFromStart');
	});

	it('hides the whole strip when the options hide it', () => {
		const { titleBar } = withQuickAccess({ visible: false });
		expect(shadow(titleBar.el).querySelector<HTMLElement>('.qat')?.hidden).toBeTruthy();
	});

	it('moves the extras into the below-ribbon element and reports when it is empty', () => {
		const t = createTranslator();
		const onQuickAccessVisibilityChange = vi.fn();
		const titleBar = createTitleBar(
			document,
			t,
			makeDeps({
				onQuickAccessVisibilityChange,
				quickAccess: {
					getState: () => ({
						visible: true,
						showCommandLabels: false,
						commandIds: ['save', 'print'],
					}),
					run: vi.fn(),
					screenTip: (label) => label,
				},
			}),
		);
		const dock = document.createElement('div');
		dock.append(titleBar.getQuickAccessElement());
		titleBar.setQuickAccessDetached(true);
		const strip = titleBar.getQuickAccessElement();
		expect([...shadow(strip).querySelectorAll('.qat button')]).toHaveLength(1);
		expect(shadow(titleBar.el).querySelectorAll('.qat button')).toHaveLength(3);
		expect(onQuickAccessVisibilityChange).toHaveBeenLastCalledWith(false);
		titleBar.dockQuickAccessElement();
		expect(strip.parentElement).toBeNull();
	});
});
