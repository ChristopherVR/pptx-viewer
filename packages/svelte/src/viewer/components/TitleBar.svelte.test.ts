import { mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import TitleBar from './TitleBar.svelte';

/**
 * The title bar's quick-access strip is options-driven, and this binding used
 * to hardcode Save/Undo/Redo and ignore `options.quickAccess` entirely, so it
 * rendered three commands where the shared default (and Angular) had four.
 * Mounted without an options context, so it exercises the shipped defaults.
 */

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function renderTitleBar(props: Record<string, unknown> = {}): HTMLElement {
	const target = document.createElement('div');
	const instance = mount(TitleBar, {
		target,
		props: {
			editable: true,
			isDirty: false,
			autosaveEnabled: true,
			canUndo: false,
			canRedo: false,
			findReplaceOpen: false,
			onautosavetoggle: vi.fn(),
			onsave: vi.fn(),
			onundo: vi.fn(),
			onredo: vi.fn(),
			onfindreplace: vi.fn(),
			...props,
		},
	});
	cleanup = () => unmount(instance);
	return target;
}

const root = (target: HTMLElement) => target.querySelector('pptx-ui-title-bar')!.shadowRoot!;

/** Accessible names of the quick-access buttons, in DOM order. */
function quickAccessNames(target: HTMLElement): (string | null)[] {
	return [...root(target).querySelectorAll('.qat button')].map((button) =>
		button.getAttribute('aria-label'),
	);
}

describe('the quick-access strip follows File > Options', () => {
	it('renders the shipped default, which is four commands and not three', () => {
		expect(quickAccessNames(renderTitleBar())).toStrictEqual([
			'Save',
			'Undo',
			'Redo',
			'From Beginning',
		]);
	});

	it('routes a quick-access command to the host by catalog id', () => {
		const onquickcommand = vi.fn();
		const target = renderTitleBar({ onquickcommand });
		root(target).querySelector<HTMLButtonElement>('button[aria-label="From Beginning"]')?.click();
		expect(onquickcommand).toHaveBeenCalledWith('presentFromStart');
	});
});

describe('the title bar adapter', () => {
	it('is the shared element, marked for tests, with the AutoSave state mapped', () => {
		const target = renderTitleBar({ autosaveEnabled: false, isDirty: true });
		const host = target.querySelector('pptx-ui-title-bar')!;
		expect(host.hasAttribute('data-pptx-title-bar')).toBeTruthy();
		const toggle = root(target).querySelector('.switch')!;
		expect(toggle.getAttribute('aria-checked')).toBe('false');
		expect(root(target).querySelector('.status')!.textContent).toBe('Unsaved changes');
	});

	it('routes switch, save, undo and redo to their callbacks', () => {
		const props = {
			canUndo: true,
			canRedo: true,
			onautosavetoggle: vi.fn(),
			onsave: vi.fn(),
			onundo: vi.fn(),
			onredo: vi.fn(),
		};
		const target = renderTitleBar(props);
		root(target).querySelector<HTMLButtonElement>('.switch')!.click();
		for (const id of ['save', 'undo', 'redo']) {
			root(target).querySelector<HTMLButtonElement>(`[data-command="${id}"]`)!.click();
		}
		expect(props.onautosavetoggle).toHaveBeenCalledOnce();
		expect(props.onsave).toHaveBeenCalledOnce();
		expect(props.onundo).toHaveBeenCalledOnce();
		expect(props.onredo).toHaveBeenCalledOnce();
	});

	it('routes command search to a command or to Find & Replace', () => {
		const oncommand = vi.fn();
		const onfindreplace = vi.fn();
		const target = renderTitleBar({ oncommand, onfindreplace });
		const host = target.querySelector('pptx-ui-title-bar')!;
		const emit = (detail: object) =>
			host.dispatchEvent(new CustomEvent('command-search', { detail, bubbles: true }));
		emit({ query: 'bold', command: 'format.bold' });
		emit({ query: 'zzz' });
		expect(oncommand).toHaveBeenCalledWith('format.bold');
		expect(onfindreplace).toHaveBeenCalledOnce();
	});

	it('gates the strip on editability and honours hiddenActions and policy', () => {
		const readOnly = renderTitleBar({ editable: false });
		expect(quickAccessNames(readOnly)).toStrictEqual([]);
		cleanup?.();
		const target = renderTitleBar({ hiddenActions: ['undo'], autosaveToggleAvailable: false });
		expect(quickAccessNames(target)).not.toContain('Undo');
		expect(root(target).querySelector<HTMLButtonElement>('.switch')!.disabled).toBeTruthy();
	});

	it('renders host-owned slots', () => {
		const target = renderTitleBar();
		expect(
			[...target.querySelector('pptx-ui-title-bar')!.shadowRoot!.querySelectorAll('slot')].map(
				(slot) => slot.name,
			),
		).toStrictEqual(['collaboration', 'account']);
	});
});
