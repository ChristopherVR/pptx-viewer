// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
	PRESENT_TOOLBAR_ORDER,
	PRESENTER_CONSOLE_ORDER,
	presenterConsoleAction,
	presenterConsoleViewState,
} from '../render';
import type { PresentationSnapshot, PresentToolbarViewState } from '../render';
import { registerPptxWebControls } from './index';

beforeAll(registerPptxWebControls);
afterEach(() => {
	document.body.replaceChildren();
	vi.useRealTimers();
});

const listen = (host: HTMLElement, type: string) => {
	const spy = vi.fn();
	host.addEventListener(type, (event) => spy((event as CustomEvent).detail));
	return spy;
};

describe('pptx-ui-present-toolbar', () => {
	const base: PresentToolbarViewState = {
		current: 1,
		total: 5,
		tool: 'none',
		penColor: '#ff0000',
		highlighterColor: '#ffff00',
		hasAnnotations: false,
		blackout: 'none',
		startTime: null,
		translate: (key: string, params) => (params ? `${key}:${params.color}` : key),
	};
	function mount(state: Partial<PresentToolbarViewState> = {}) {
		const host = document.createElement('pptx-ui-present-toolbar');
		host.state = { ...base, ...state };
		document.body.append(host);
		const root = host.shadowRoot!;
		const control = (id: string) =>
			root.querySelector<HTMLButtonElement>(`[data-pptx-present-control="${id}"]`)!;
		return { host, root, control };
	}

	it('renders the shared inventory in order with names, counter and host hook', () => {
		const { host, root, control } = mount({ presenterViewVisible: true });
		expect(host.hasAttribute('data-pptx-present-toolbar')).toBeTruthy();
		const ids = Array.from(root.querySelectorAll('[data-pptx-present-control]')).map(
			(node) => (node as HTMLElement).dataset.pptxPresentControl,
		);
		expect(ids).toStrictEqual([...PRESENT_TOOLBAR_ORDER]);
		expect(host.getAttribute('role')).toBe('toolbar');
		expect(host.getAttribute('aria-label')).toBe('pptx.toolbar.presentationToolbarAria');
		expect(host.tabIndex).toBe(-1);
		expect(control('counter').textContent).toBe('2 / 5');
		expect(control('pen').getAttribute('aria-label')).toBe('pptx.presentation.pen');
		expect(control('pen').title).toBe('pptx.presentation.pen');
	});

	it('gates previous, next, clear and the presenter-view toggle', () => {
		const first = mount({ current: 0, total: 1 });
		expect(first.control('previous').disabled).toBeTruthy();
		expect(first.control('next').disabled).toBeTruthy();
		expect(first.control('clear').disabled).toBeTruthy();
		expect(first.control('presenter-view')).toBeNull();
		const middle = mount({ hasAnnotations: true, presenterViewVisible: true });
		expect(middle.control('previous').disabled).toBeFalsy();
		expect(middle.control('clear').disabled).toBeFalsy();
		expect(middle.control('presenter-view')).not.toBeNull();
	});

	it('reflects the armed tool, blackboard and presenter view as pressed', () => {
		const { control } = mount({
			tool: 'pen',
			blackout: 'black',
			presenterViewVisible: true,
			presenterViewActive: true,
		});
		expect(control('pen').getAttribute('aria-pressed')).toBe('true');
		expect(control('laser').getAttribute('aria-pressed')).toBe('false');
		expect(control('blackboard').getAttribute('aria-pressed')).toBe('true');
		expect(control('presenter-view').getAttribute('aria-pressed')).toBe('true');
		const other = mount({ tool: 'eraser', blackout: 'black' });
		expect(other.control('blackboard').getAttribute('aria-pressed')).toBe('false');
	});

	it('emits one typed intent per activation', () => {
		const { host, control } = mount({ hasAnnotations: true, presenterViewVisible: true });
		const spy = listen(host, 'present-toolbar-request');
		for (const id of [
			'previous',
			'next',
			'laser',
			'pen',
			'highlighter',
			'eraser',
			'blackboard',
			'clear',
			'presenter-view',
			'end',
		]) {
			control(id).click();
		}
		expect(spy.mock.calls.map(([detail]) => detail)).toStrictEqual([
			{ id: 'move', direction: -1 },
			{ id: 'move', direction: 1 },
			{ id: 'tool', tool: 'laser' },
			{ id: 'tool', tool: 'pen' },
			{ id: 'tool', tool: 'highlighter' },
			{ id: 'tool', tool: 'eraser' },
			{ id: 'blackboard' },
			{ id: 'clear' },
			{ id: 'presenterView' },
			{ id: 'end' },
		]);
	});

	it('opens a palette from the caret or a right click, picks a colour and closes it', () => {
		const { host, root, control } = mount();
		const spy = listen(host, 'present-toolbar-request');
		const palette = () => root.querySelector<HTMLElement>('.palette')!;
		expect(palette().hidden).toBeTruthy();
		control('pen-color').click();
		expect(palette().hidden).toBeFalsy();
		const swatches = palette().querySelectorAll<HTMLButtonElement>('button.swatch');
		expect(swatches).toHaveLength(8);
		expect(swatches[0].getAttribute('aria-pressed')).toBe('true');
		expect(swatches[1].getAttribute('aria-label')).toBe(
			'pptx.presentationToolbar.penColorValue:#0000ff',
		);
		swatches[1].click();
		expect(spy).toHaveBeenLastCalledWith({ id: 'color', tool: 'pen', color: '#0000ff' });
		expect(palette().hidden).toBeTruthy();
		control('highlighter').dispatchEvent(
			new MouseEvent('contextmenu', { bubbles: true, cancelable: true }),
		);
		const highlighter = root.querySelectorAll<HTMLElement>('.palette')[1];
		expect(highlighter.hidden).toBeFalsy();
		// An outside mousedown closes it; a press inside the bar does not.
		control('previous').dispatchEvent(
			new MouseEvent('mousedown', { bubbles: true, composed: true }),
		);
		expect(highlighter.hidden).toBeFalsy();
		document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
		expect(highlighter.hidden).toBeTruthy();
		control('pen-color').click();
		(host as unknown as { closePalettes(): void }).closePalettes();
		expect(palette().hidden).toBeTruthy();
	});

	it('shows the swatch colour under each tool and ticks the elapsed readout', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
		const { root, control } = mount({ startTime: Date.now() - 61_000, penColor: '#00aa00' });
		expect(root.querySelector('[data-pptx-present-control="timer"] span')!.textContent).toBe(
			'01:01',
		);
		expect(control('pen').querySelector<HTMLElement>('.swatch-bar')!.style.backgroundColor).toBe(
			'rgb(0, 170, 0)',
		);
		await vi.advanceTimersByTimeAsync(2000);
		expect(root.querySelector('[data-pptx-present-control="timer"] span')!.textContent).toBe(
			'01:03',
		);
	});

	it('does not dismiss or advance when the bar itself is clicked', () => {
		const { host } = mount();
		const outer = vi.fn();
		document.body.addEventListener('click', outer);
		host.shadowRoot!.querySelector<HTMLElement>('.bar')!.click();
		expect(outer).not.toHaveBeenCalled();
	});
});

describe('pptx-ui-presenter-console', () => {
	const snapshot: PresentationSnapshot = {
		slideIndex: 0,
		buildStep: 0,
		sequence: 0,
		blackout: 'none',
		paused: false,
		elapsedMs: 0,
	};

	it('renders the shared inventory with names, toggles and the host hook', () => {
		const host = document.createElement('pptx-ui-presenter-console');
		host.state = { active: ['pen'], disabled: ['swap-displays'], translate: (key: string) => key };
		document.body.append(host);
		expect(host.hasAttribute('data-pptx-presenter-toolbar')).toBeTruthy();
		expect(host.hasAttribute('data-pptx-presenter-strip')).toBeTruthy();
		const root = host.shadowRoot!;
		const ids = Array.from(root.querySelectorAll('[data-pptx-presenter-control]')).map(
			(node) => (node as HTMLElement).dataset.pptxPresenterControl,
		);
		expect(ids).toStrictEqual([...PRESENTER_CONSOLE_ORDER]);
		const control = (id: string) =>
			root.querySelector<HTMLButtonElement>(`[data-pptx-presenter-control="${id}"]`)!;
		expect(control('pen').getAttribute('aria-pressed')).toBe('true');
		expect(control('laser').getAttribute('aria-pressed')).toBe('false');
		expect(control('timer-toggle').hasAttribute('aria-pressed')).toBeFalsy();
		expect(control('swap-displays').disabled).toBeTruthy();
		expect(control('blackout-black').textContent).toBe('B');
		expect(control('blackout-black').getAttribute('aria-label')).toBe('pptx.presenter.blackScreen');
	});

	it('swaps the active icon and label for the timer and the audience window', () => {
		const host = document.createElement('pptx-ui-presenter-console');
		host.state = { active: [], disabled: [], translate: (key: string) => key };
		document.body.append(host);
		const audience = host.shadowRoot!.querySelector<HTMLButtonElement>(
			'[data-pptx-presenter-control="audience"]',
		)!;
		expect(audience.getAttribute('aria-label')).toBe('pptx.presenter.openAudienceWindow');
		const before = audience.innerHTML;
		host.state = { active: ['audience'], disabled: [], translate: (key: string) => key };
		expect(audience.getAttribute('aria-label')).toBe('pptx.presenter.closeAudienceWindow');
		expect(audience.innerHTML).not.toBe(before);
	});

	it('emits the control id for each activation', () => {
		const host = document.createElement('pptx-ui-presenter-console');
		host.state = { active: [], disabled: [] };
		document.body.append(host);
		const spy = listen(host, 'presenter-console-request');
		for (const id of ['timer-reset', 'zoom-in', 'end']) {
			host
				.shadowRoot!.querySelector<HTMLButtonElement>(`[data-pptx-presenter-control="${id}"]`)!
				.click();
		}
		expect(spy.mock.calls.map(([detail]) => detail.id)).toStrictEqual([
			'timer-reset',
			'zoom-in',
			'end',
		]);
	});

	it('derives one active and disabled rule from a snapshot', () => {
		expect(presenterConsoleViewState(snapshot, false)).toStrictEqual({
			active: [],
			disabled: ['swap-displays'],
		});
		expect(
			presenterConsoleViewState(
				{
					...snapshot,
					paused: true,
					blackout: 'white',
					subtitlesVisible: true,
					zoom: { scale: 2, originX: 0, originY: 0 },
					pointer: { tool: 'highlighter', x: 0, y: 0, color: '#ff0' },
				},
				true,
			),
		).toStrictEqual({
			active: ['highlighter', 'timer-toggle', 'zoom-in', 'blackout-white', 'captions', 'audience'],
			disabled: [],
		});
	});

	it('resolves each control to one host action', () => {
		const armed = { ...snapshot, pointer: { tool: 'pen' as const, x: 0, y: 0, color: '#f00' } };
		expect(presenterConsoleAction('pen', armed)).toStrictEqual({ kind: 'pointer', tool: 'none' });
		expect(presenterConsoleAction('laser', armed)).toStrictEqual({
			kind: 'pointer',
			tool: 'laser',
		});
		expect(presenterConsoleAction('blackout-black', snapshot)).toStrictEqual({
			kind: 'blackout',
			value: 'black',
		});
		expect(
			presenterConsoleAction('blackout-black', { ...snapshot, blackout: 'black' }),
		).toStrictEqual({
			kind: 'blackout',
			value: 'none',
		});
		expect(presenterConsoleAction('zoom-out', snapshot)).toStrictEqual({
			kind: 'zoom',
			direction: -1,
		});
		expect(presenterConsoleAction('end', snapshot)).toStrictEqual({ kind: 'end' });
		expect(presenterConsoleAction('nope', snapshot)).toBeNull();
	});
});
