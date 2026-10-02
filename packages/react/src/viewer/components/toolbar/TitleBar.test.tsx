// @vitest-environment happy-dom
import { DEFAULT_VIEWER_OPTIONS, registerPptxWebControls } from 'pptx-viewer-shared';
import type { ViewerOptions } from 'pptx-viewer-shared';
import { translationsEn } from 'pptx-viewer-shared/i18n';
import React, { act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { ViewerOptionsContext } from '../viewer-options-context';
import type { TitleBarProps } from './TitleBar';
import { TitleBar } from './TitleBar';
import { TitleBarElement } from './TitleBarElement';

vi.mock<typeof import('react-i18next')>(import('react-i18next'), () => ({
	useTranslation: () => ({
		t: (key: string, opts?: Record<string, unknown>) => {
			const fallback = translationsEn[key];
			if (fallback === undefined) {
				return key;
			}
			return opts
				? fallback.replace(/\{\{(\w+)\}\}/gu, (_m, name: string) => String(opts[name] ?? ''))
				: fallback;
		},
	}),
}));

beforeAll(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	registerPptxWebControls();
});

const mounted: { root: Root; target: HTMLElement }[] = [];
afterEach(() => {
	for (const { root, target } of mounted.splice(0)) {
		act(() => root.unmount());
		target.remove();
	}
});

function props(over: Partial<TitleBarProps> = {}): TitleBarProps {
	return {
		mode: 'edit',
		canEdit: true,
		isDirty: false,
		autosaveEnabled: true,
		onToggleAutosave: vi.fn<() => void>(),
		canUndo: true,
		canRedo: false,
		onUndo: vi.fn<() => void>(),
		onRedo: vi.fn<() => void>(),
		onSave: vi.fn<() => void>(),
		findReplaceOpen: false,
		onToggleFindReplace: vi.fn<() => void>(),
		onCommandSearch: vi.fn<(c: string) => void>(),
		onQuickCommand: vi.fn<(id: string) => void>(),
		...over,
	};
}

function withQuickAccess(quickAccess: Partial<ViewerOptions['quickAccess']>): ViewerOptions {
	return {
		...DEFAULT_VIEWER_OPTIONS,
		quickAccess: { ...DEFAULT_VIEWER_OPTIONS.quickAccess, ...quickAccess },
	};
}

function container(): { root: Root; target: HTMLElement } {
	const target = document.createElement('div');
	document.body.append(target);
	const root = createRoot(target);
	mounted.push({ root, target });
	return { root, target };
}

function mount(
	over: Partial<TitleBarProps> = {},
	options: ViewerOptions = DEFAULT_VIEWER_OPTIONS,
	strict = false,
) {
	const { root, target } = container();
	const render = (next: Partial<TitleBarProps> = over) => {
		const tree = (
			<ViewerOptionsContext.Provider value={options}>
				<TitleBar {...props(next)} />
			</ViewerOptionsContext.Provider>
		);
		act(() => root.render(strict ? <StrictMode>{tree}</StrictMode> : tree));
	};
	render();
	const host = target.querySelector('pptx-ui-title-bar')!;
	const shadow = () => host.shadowRoot!;
	const names = () =>
		[...shadow().querySelectorAll<HTMLButtonElement>('.qat button')].map((b) =>
			b.getAttribute('aria-label'),
		);
	return { host, shadow, names, render };
}

const label = (key: string) => translationsEn[key];
const belowOptions = withQuickAccess({ position: 'below' });

describe('react TitleBar adapter', () => {
	it('maps viewer state onto the shared element', () => {
		const { host, shadow } = mount({ fileName: 'deck.pptx', isDirty: true });
		expect(host.hasAttribute('data-pptx-title-bar')).toBeTruthy();
		expect(shadow().querySelector('.name')!.textContent).toBe('deck.pptx');
		expect(shadow().querySelector('.status')!.textContent).toBe(
			label('pptx.statusBar.unsavedChanges'),
		);
		expect(shadow().querySelector('.switch')!.getAttribute('aria-checked')).toBe('true');
	});

	it('renders the AutoSave switch inert when the host forbids autosave', () => {
		const { shadow } = mount({ autosaveEnabled: false, autosaveToggleAvailable: false });
		expect(shadow().querySelector<HTMLButtonElement>('.switch')!.disabled).toBeTruthy();
		expect(mount().shadow().querySelector<HTMLButtonElement>('.switch')!.disabled).toBeFalsy();
	});

	it('follows File > Options: default is four commands, reconfigurable, de-duplicated', () => {
		expect(mount().names()).toStrictEqual([
			label('pptx.titleBar.save'),
			label('pptx.toolbar.undo'),
			label('pptx.toolbar.redo'),
			label('pptx.options.quickAccess.command.presentFromStart'),
		]);
		const names = mount(
			{},
			withQuickAccess({ commandIds: ['save', 'print', 'undo', 'redo', 'save'] }),
		).names();
		expect(names).toContain(label('pptx.options.quickAccess.command.print'));
		expect(names.filter((n) => n === label('pptx.titleBar.save'))).toHaveLength(1);
	});

	it('hides the strip when options hide it and the extras when position is below', () => {
		expect(mount({}, withQuickAccess({ visible: false })).names()).toStrictEqual([]);
		expect(mount({}, withQuickAccess({ position: 'below' })).names()).toHaveLength(3);
	});

	it('gates Save, Undo and Redo independently and hides edit parts when read-only', () => {
		expect(mount({ onSave: undefined, hiddenActions: ['undo'] }).names()).toStrictEqual([
			label('pptx.toolbar.redo'),
			label('pptx.options.quickAccess.command.presentFromStart'),
		]);
		const ro = mount({ canEdit: false });
		expect(ro.shadow().querySelector<HTMLElement>('.autosave')!.hidden).toBeTruthy();
		expect(ro.shadow().querySelector<HTMLElement>('.box')!.hidden).toBeTruthy();
		expect(ro.names()).toStrictEqual([]);
	});

	it('disables undo/redo from history and names the pending action', () => {
		const { shadow } = mount({ undoLabel: 'Delete shape', canRedo: false });
		const undo = shadow().querySelector<HTMLButtonElement>('[data-command="undo"]')!;
		expect(undo.title).toBe('Undo: Delete shape');
		expect(undo.disabled).toBeFalsy();
		expect(
			shadow().querySelector<HTMLButtonElement>('[data-command="redo"]')!.disabled,
		).toBeTruthy();
	});

	it('routes each event to its callback once, including under StrictMode', () => {
		const p = props();
		const { shadow, host } = mount(p, DEFAULT_VIEWER_OPTIONS, true);
		shadow().querySelector<HTMLButtonElement>('.switch')!.click();
		for (const id of ['save', 'undo', 'presentFromStart']) {
			shadow().querySelector<HTMLButtonElement>(`[data-command="${id}"]`)!.click();
		}
		expect(p.onToggleAutosave).toHaveBeenCalledOnce();
		expect(p.onSave).toHaveBeenCalledOnce();
		expect(p.onUndo).toHaveBeenCalledOnce();
		expect(p.onQuickCommand).toHaveBeenCalledExactlyOnceWith('presentFromStart');
		host.dispatchEvent(
			new CustomEvent('command-search', { detail: { query: 'bold', command: 'format.bold' } }),
		);
		host.dispatchEvent(new CustomEvent('command-search', { detail: { query: 'zzz' } }));
		expect(p.onCommandSearch).toHaveBeenCalledExactlyOnceWith('format.bold');
		expect(p.onToggleFindReplace).toHaveBeenCalledOnce();
	});

	it('uses the latest callbacks after a re-render', () => {
		const first = props();
		const second = props();
		const { shadow, render } = mount(first);
		render(second);
		shadow().querySelector<HTMLButtonElement>('[data-command="save"]')!.click();
		expect(first.onSave).not.toHaveBeenCalled();
		expect(second.onSave).toHaveBeenCalledOnce();
	});

	it('projects the collaboration and account slots', () => {
		const { root, target } = container();
		act(() =>
			root.render(
				<TitleBar {...props()} collaborationSlot={<b id='c'>c</b>} accountSlot={<i id='a'>a</i>} />,
			),
		);
		expect(target.querySelector('[slot="collaboration"] #c')).not.toBeNull();
		expect(target.querySelector('[slot="account"] #a')).not.toBeNull();
	});
});

describe('below-ribbon placement', () => {
	it('renders only the extras row and routes quick commands', () => {
		const onQuickCommand = vi.fn<(id: string) => void>();
		const { root, target } = container();
		act(() =>
			root.render(
				<ViewerOptionsContext.Provider value={belowOptions}>
					<TitleBarElement
						placement='belowRibbon'
						input={{
							editing: true,
							isDirty: false,
							autosaveEnabled: false,
							canUndo: false,
							canRedo: false,
						}}
						onQuickCommand={onQuickCommand}
					/>
				</ViewerOptionsContext.Provider>,
			),
		);
		const host = target.querySelector('pptx-ui-title-bar')!;
		expect(host.hasAttribute('data-pptx-title-bar')).toBeFalsy();
		const buttons = host.shadowRoot!.querySelectorAll<HTMLButtonElement>('.qat button');
		expect([...buttons].map((b) => b.dataset.command)).toStrictEqual(['presentFromStart']);
		buttons[0]!.click();
		expect(onQuickCommand).toHaveBeenCalledExactlyOnceWith('presentFromStart');
	});
});
