// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { resolveTitleBarStrip } from '../render';
import type { TitleBarViewState } from '../render';
import { registerPptxWebControls } from './index';

beforeAll(registerPptxWebControls);
afterEach(() => document.body.replaceChildren());

const base: TitleBarViewState = {
	editing: true,
	searchVisible: true,
	fileName: 'deck.pptx',
	autosave: { enabled: true, statusKey: 'pptx.titleBar.savedToThisPc', tone: 'idle' },
	history: { canUndo: true, canRedo: false },
	quickAccess: {
		visible: true,
		position: 'above',
		showCommandLabels: false,
		commandIds: ['save', 'undo', 'redo', 'print', 'zoomIn'],
	},
	translate: (key, params) => (params?.action ? `${key}:${params.action}` : key),
};

function mount(state: Partial<TitleBarViewState> = {}, placement?: string) {
	const host = document.createElement('pptx-ui-title-bar');
	if (placement) {
		host.setAttribute('placement', placement);
	}
	host.state = { ...base, ...state };
	document.body.append(host);
	return host;
}
const root = (host: HTMLElement) => host.shadowRoot!;
const names = (host: HTMLElement) =>
	[...root(host).querySelectorAll<HTMLButtonElement>('.qat button')].map((b) =>
		b.getAttribute('aria-label'),
	);

describe('resolveTitleBarStrip', () => {
	it('puts Save, Undo, Redo first, then extras in configured order', () => {
		const items = resolveTitleBarStrip(
			{ ...base, quickAccess: { ...base.quickAccess, commandIds: ['zoomIn', 'save', 'print'] } },
			'titleBar',
		);
		expect(items.map((i) => i.id)).toStrictEqual(['save', 'undo', 'redo', 'zoomIn', 'print']);
	});

	it('moves the extras below the ribbon and drops the dedicated trio there', () => {
		const below = { ...base, quickAccess: { ...base.quickAccess, position: 'below' as const } };
		expect(resolveTitleBarStrip(below, 'titleBar').map((i) => i.id)).toStrictEqual([
			'save',
			'undo',
			'redo',
		]);
		expect(resolveTitleBarStrip(below, 'belowRibbon').map((i) => i.id)).toStrictEqual([
			'print',
			'zoomIn',
		]);
		expect(resolveTitleBarStrip(base, 'belowRibbon')).toStrictEqual([]);
	});

	it('gates on editing, visibility, showSave and hidden undo/redo; drops unknown ids', () => {
		expect(resolveTitleBarStrip({ ...base, editing: false }, 'titleBar')).toStrictEqual([]);
		expect(
			resolveTitleBarStrip(
				{ ...base, quickAccess: { ...base.quickAccess, visible: false } },
				'titleBar',
			),
		).toStrictEqual([]);
		const gated = resolveTitleBarStrip(
			{
				...base,
				showSave: false,
				history: { ...base.history, showUndo: false },
				quickAccess: { ...base.quickAccess, commandIds: ['bogus', 'print', 'print'] },
			},
			'titleBar',
		);
		expect(gated.map((i) => i.id)).toStrictEqual(['redo', 'print']);
	});
});

describe('pptx-ui-title-bar', () => {
	it('renders the row, names, status and gates editing-only parts', () => {
		const host = mount();
		expect(host.hasAttribute('data-pptx-title-bar')).toBeTruthy();
		expect(root(host).querySelector('.name')!.textContent).toBe('deck.pptx');
		expect(root(host).querySelector('.status')!.textContent).toBe('pptx.titleBar.savedToThisPc');
		expect(names(host)).toStrictEqual([
			'pptx.titleBar.save',
			'pptx.toolbar.undo',
			'pptx.toolbar.redo',
			'pptx.options.quickAccess.command.print',
			'pptx.options.quickAccess.command.zoomIn',
		]);
		host.state = { ...base, editing: false, searchVisible: false, fileName: '' };
		expect(root(host).querySelector('.name')!.textContent).toBe('pptx.titleBar.defaultFileName');
		expect(root(host).querySelector<HTMLElement>('.autosave')!.hidden).toBeTruthy();
		expect(root(host).querySelector<HTMLElement>('.qat')!.hidden).toBeTruthy();
		expect(root(host).querySelector<HTMLElement>('.status')!.hidden).toBeTruthy();
		expect(root(host).querySelector<HTMLElement>('.box')!.hidden).toBeTruthy();
	});

	it('applies the single tooltip rule and disables undo/redo from history', () => {
		const host = mount({
			history: { canUndo: true, canRedo: false, undoLabel: 'Delete shape' },
			screenTip: (label) => (label.startsWith('pptx.toolbar.redo') ? undefined : `tip ${label}`),
		});
		const [save, undo, redo] = [...root(host).querySelectorAll<HTMLButtonElement>('.qat button')];
		expect(save!.title).toBe('tip pptx.titleBar.save');
		expect(undo!.title).toBe('tip pptx.toolbar.undoAction:Delete shape');
		expect(undo!.getAttribute('aria-label')).toBe('pptx.toolbar.undo');
		expect(undo!.disabled).toBeFalsy();
		expect(redo!.disabled).toBeTruthy();
		expect(redo!.hasAttribute('title')).toBeFalsy();
	});

	it('emits one typed event per activation and none for programmatic updates', () => {
		const host = mount();
		const seen: Array<[string, unknown]> = [];
		for (const name of ['toggle-autosave', 'save', 'undo', 'redo', 'quick-command']) {
			host.addEventListener(name, (event) => seen.push([name, (event as CustomEvent).detail]));
		}
		host.state = { ...base };
		expect(seen).toStrictEqual([]);
		root(host).querySelector<HTMLElement & { disabled: boolean }>('.switch')!.click();
		for (const id of ['save', 'undo', 'print']) {
			root(host).querySelector<HTMLButtonElement>(`[data-command="${id}"]`)!.click();
		}
		expect(seen).toStrictEqual([
			['toggle-autosave', null],
			['save', null],
			['undo', null],
			['quick-command', { id: 'print' }],
		]);
	});

	it('renders an inert switch when the host forbids autosave', () => {
		const host = mount({ autosave: { ...base.autosave, enabled: false, toggleAvailable: false } });
		const toggle = root(host).querySelector<HTMLElement & { disabled: boolean }>('.switch')!;
		const spy = vi.fn();
		host.addEventListener('toggle-autosave', spy);
		expect(toggle.disabled).toBeTruthy();
		expect(toggle.getAttribute('aria-checked')).toBe('false');
		toggle.click();
		expect(spy).not.toHaveBeenCalled();
	});

	it('keeps focus on a strip button across updates and roves with the arrow keys', () => {
		const host = mount();
		const get = (id: string) =>
			root(host).querySelector<HTMLButtonElement>(`[data-command="${id}"]`)!;
		const qat = root(host).querySelector('.qat')!;
		// One tab stop: the first enabled button.
		expect(get('save').tabIndex).toBe(0);
		expect(get('undo').tabIndex).toBe(-1);
		get('undo').focus();
		get('undo').dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
		expect(get('undo').tabIndex).toBe(0);
		host.state = { ...base, history: { canUndo: true, canRedo: true } };
		expect(root(host).querySelector('[data-command="undo"]')).toBe(get('undo'));
		get('undo').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
		expect(root(host).activeElement).toBe(get('redo'));
		qat.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
		get('redo').dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
		expect(root(host).activeElement).toBe(get('zoomIn'));
		// Disabled buttons leave the roving order.
		host.state = { ...base, history: { canUndo: false, canRedo: false } };
		get('zoomIn').dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
		expect(root(host).activeElement).toBe(get('save'));
		expect(qat.getAttribute('role')).toBe('toolbar');
	});

	it('shows only the extras row below the ribbon and hides when empty', () => {
		const below = { ...base.quickAccess, position: 'below' as const };
		const host = mount({ quickAccess: below }, 'belowRibbon');
		expect(host.hasAttribute('data-pptx-title-bar')).toBeFalsy();
		expect(host.getAttribute('data-pptx-quick-access')).toBe('below');
		expect(names(host)).toStrictEqual([
			'pptx.options.quickAccess.command.print',
			'pptx.options.quickAccess.command.zoomIn',
		]);
		expect(root(host).querySelector('.logo')).toBeNull();
		expect(host.hasAttribute('data-empty')).toBeFalsy();
		// No second search field or switch hides in the page.
		expect(root(host).querySelector('pptx-ui-search')).toBeNull();
		expect(root(host).querySelector('.switch')).toBeNull();
		host.setAttribute('placement', 'titleBar');
		expect(root(host).querySelector('pptx-ui-search')).not.toBeNull();
		host.setAttribute('placement', 'belowRibbon');
		host.state = { ...base, quickAccess: { ...below, visible: false } };
		expect(host.hasAttribute('data-empty')).toBeTruthy();
	});

	it('projects host-owned slots', () => {
		const host = document.createElement('pptx-ui-title-bar');
		host.innerHTML = '<b slot="collaboration">c</b><i slot="account">a</i>';
		document.body.append(host);
		const slots = [...root(host).querySelectorAll('slot')].map((s) => s.name);
		expect(slots).toStrictEqual(['actions', 'collaboration', 'account']);
	});

	it('searches commands, caps results and offers content search', () => {
		const host = mount({
			commands: Array.from({ length: 12 }, (_, i) => ({
				labelKey: `cmd.${i}`,
				command: `c.${i}`,
				category: 'insert' as const,
			})),
		});
		const search = root(host).querySelector<HTMLElement & { value: string }>('pptx-ui-search')!;
		const requests: unknown[] = [];
		host.addEventListener('command-search', (e) => requests.push((e as CustomEvent).detail));
		search.value = 'cmd';
		search.dispatchEvent(new Event('input', { bubbles: true }));
		expect(root(host).querySelectorAll('[role="option"]')).toHaveLength(8);
		expect(root(host).querySelector('.cat')!.textContent).toBe('insert');
		search.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
		search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		expect(requests).toStrictEqual([{ query: 'cmd', command: 'c.1' }]);
		expect(search.value).toBe('');
		search.value = 'zzz';
		search.dispatchEvent(new Event('input', { bubbles: true }));
		expect(root(host).querySelector('.empty')!.textContent).toBe('pptx.titleBar.searchNoResults');
		search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		expect(requests[1]).toStrictEqual({ query: 'zzz' });
		search.value = 'x';
		search.dispatchEvent(new Event('input', { bubbles: true }));
		search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		expect(root(host).querySelector<HTMLElement>('.results')!.hidden).toBeTruthy();
		host.state = { ...base, contentSearch: false };
		search.value = 'zzz';
		search.dispatchEvent(new Event('input', { bubbles: true }));
		expect(root(host).querySelector('.content')).toBeNull();
	});

	it('keeps typing out of the viewer shortcuts', () => {
		const host = mount();
		const outer = vi.fn();
		document.addEventListener('keydown', outer);
		root(host)
			.querySelector('pptx-ui-search')!
			.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, composed: true }));
		document.removeEventListener('keydown', outer);
		expect(outer).not.toHaveBeenCalled();
	});
});
