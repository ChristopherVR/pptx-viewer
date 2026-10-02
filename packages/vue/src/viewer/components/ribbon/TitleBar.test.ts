import { mount } from '@vue/test-utils';
import { translationsEn } from 'pptx-viewer-shared/i18n';
import { describe, expect, it, vi } from 'vitest';
import { h } from 'vue';

import TitleBar from './TitleBar.vue';

/**
 * The Vue TitleBar is an adapter over the shared `pptx-ui-title-bar`: these tests
 * cover state mapping, event routing, slots and placement; the view itself is
 * covered in `pptx-viewer-shared`.
 */
function open(props: Partial<Record<string, unknown>> = {}, slots?: Record<string, () => unknown>) {
	const wrapper = mount(TitleBar, {
		props: {
			mode: 'edit',
			canEdit: true,
			isDirty: false,
			autosaveEnabled: true,
			onToggleAutosave: () => {},
			canUndo: false,
			canRedo: false,
			onUndo: () => {},
			onRedo: () => {},
			onSave: () => {},
			findReplaceOpen: false,
			onToggleFindReplace: () => {},
			...props,
		},
		slots: slots as never,
	});
	const host = wrapper.get('pptx-ui-title-bar').element;
	const root = host.shadowRoot!;
	const button = (name: string) =>
		root.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`);
	return { wrapper, host, root, button };
}

describe('titleBar adapter', () => {
	it('renders the AutoSave switch and On/Off label from the autosave flag', () => {
		const on = open({ autosaveEnabled: true });
		expect(on.root.querySelector('[role="switch"]')!.getAttribute('aria-checked')).toBe('true');
		expect(on.root.textContent).toContain('On');
		const off = open({ autosaveEnabled: false });
		expect(off.root.querySelector('[role="switch"]')!.getAttribute('aria-checked')).toBe('false');
		expect(off.root.textContent).toContain('Off');
	});

	it('renders the AutoSave switch inert when the host forbids autosave', () => {
		expect(
			open({ autosaveToggleAvailable: false }).root.querySelector<HTMLButtonElement>('.switch')!
				.disabled,
		).toBeTruthy();
		expect(open({}).root.querySelector<HTMLButtonElement>('.switch')!.disabled).toBeFalsy();
	});

	it('routes every typed event to the matching host handler', () => {
		const h2 = {
			onToggleAutosave: vi.fn(),
			onSave: vi.fn(),
			onUndo: vi.fn(),
			onRedo: vi.fn(),
			onQuickCommand: vi.fn(),
		};
		const { root } = open({ ...h2, canUndo: true, canRedo: true });
		root.querySelector<HTMLButtonElement>('[role="switch"]')!.click();
		for (const name of ['Save', 'Undo', 'Redo', 'From Beginning']) {
			root.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`)!.click();
		}
		expect(h2.onToggleAutosave).toHaveBeenCalledOnce();
		expect(h2.onSave).toHaveBeenCalledOnce();
		expect(h2.onUndo).toHaveBeenCalledOnce();
		expect(h2.onRedo).toHaveBeenCalledOnce();
		expect(h2.onQuickCommand).toHaveBeenCalledWith('presentFromStart');
	});

	it('shows the host file name or the default', () => {
		expect(open({ fileName: 'Quarterly.pptx' }).root.textContent).toContain('Quarterly.pptx');
		expect(open({ fileName: undefined }).root.textContent).toContain('Presentation');
	});

	it('disables undo and redo when they cannot run', () => {
		const { button } = open();
		expect(button('Undo')!.disabled).toBeTruthy();
		expect(button('Redo')!.disabled).toBeTruthy();
	});

	it('gates Save on a save handler and Undo/Redo on hiddenActions', () => {
		expect(open({ onSave: undefined }).button('Save')).toBeNull();
		const undoHidden = open({ hiddenActions: ['undo'] });
		expect(undoHidden.button('Undo')).toBeNull();
		expect(undoHidden.button('Redo')).not.toBeNull();
		const redoHidden = open({ hiddenActions: ['redo'] });
		expect(redoHidden.button('Undo')).not.toBeNull();
		expect(redoHidden.button('Redo')).toBeNull();
	});

	it('hides the editing controls and search in preview mode', () => {
		const { root, button } = open({ mode: 'preview', canEdit: false });
		expect(root.querySelector<HTMLElement>('.autosave')!.hidden).toBeTruthy();
		expect(root.querySelector<HTMLElement>('.box')!.hidden).toBeTruthy();
		expect(button('Undo')).toBeNull();
	});

	it('names the pending action in the Undo/Redo tooltips', () => {
		const { button } = open({
			canUndo: true,
			canRedo: true,
			undoLabel: 'Delete shape',
			redoLabel: 'Move',
		});
		expect(button('Undo')!.title).toBe('Undo: Delete shape');
		expect(button('Redo')!.title).toBe('Redo: Move');
	});

	it('shows the disabled-by-host reason as the status text', () => {
		const { root } = open({ autosaveStatus: 'disabled', autosaveDisabledReason: 'no_file_path' });
		expect(root.querySelector('.status')!.textContent).toBe(
			translationsEn['pptx.autosave.disabledNoFilePath'],
		);
	});

	it('renders the options-driven commands after Save/Undo/Redo', () => {
		const labels = [...open().root.querySelectorAll('.qat button')].map((b) =>
			b.getAttribute('aria-label'),
		);
		expect(labels.slice(0, 3)).toStrictEqual(['Save', 'Undo', 'Redo']);
		expect(labels).toContain('From Beginning');
	});

	it('sends a content search to Find & Replace and a command to the dispatcher', () => {
		const onToggleFindReplace = vi.fn();
		const onCommandSearch = vi.fn();
		const { root } = open({ onToggleFindReplace, onCommandSearch });
		const search = root.querySelector<HTMLElement & { value: string }>('pptx-ui-search')!;
		search.value = 'zzzz';
		search.dispatchEvent(new Event('input', { bubbles: true }));
		search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		expect(onToggleFindReplace).toHaveBeenCalledOnce();
		search.value = 'bold';
		search.dispatchEvent(new Event('input', { bubbles: true }));
		search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		expect(onCommandSearch).toHaveBeenCalledWith('format.bold');
	});

	it('projects the collaboration and account slots', () => {
		const { host } = open({}, { collaboration: () => h('b', 'c'), account: () => h('i', 'a') });
		expect(host.querySelector('[slot="collaboration"]')!.textContent).toBe('c');
		expect(host.querySelector('[slot="account"]')!.textContent).toBe('a');
		expect(open().host.querySelector('[slot]')).toBeNull();
	});

	it('renders only the extras row below the ribbon', () => {
		const { host, root } = open({ placement: 'belowRibbon' });
		expect(host.getAttribute('placement')).toBe('belowRibbon');
		const labels = [...root.querySelectorAll('.qat button')].map((b) =>
			b.getAttribute('aria-label'),
		);
		// Default position is `above`, so nothing belongs below the ribbon.
		expect(labels).toStrictEqual([]);
		expect(host.hasAttribute('data-empty')).toBeTruthy();
	});
});
