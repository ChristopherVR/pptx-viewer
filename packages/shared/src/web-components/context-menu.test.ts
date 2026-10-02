// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { typeAheadIndex } from './context-menu-model';
import {
	registerPptxWebControls,
	contextMenuViewItems,
	presentationViewItems,
	slidePaneViewItems,
} from './index';
import type { ContextMenuViewState, PptxUiContextMenuElement } from './index';

beforeAll(registerPptxWebControls);
afterEach(() => document.body.replaceChildren());

const base: ContextMenuViewState = {
	x: 40,
	y: 60,
	label: 'Shape menu',
	markers: ['data-pptx-context-menu'],
	items: [
		{ id: 'copy', label: 'Copy' },
		{ id: 'paste', label: 'Paste', disabled: true },
		{ id: 'cut', label: 'Cut' },
		{ id: 'grid', label: 'Grid', checked: true, separatorBefore: true },
		{ id: 'delete', label: 'Delete', danger: true },
	],
};

function mount(state: Partial<ContextMenuViewState> = {}): PptxUiContextMenuElement {
	const host = document.createElement('pptx-ui-context-menu');
	host.state = { ...base, ...state };
	document.body.append(host);
	return host;
}
const rows = (host: HTMLElement) =>
	Array.from(host.shadowRoot!.querySelectorAll<HTMLButtonElement>('button'));
const key = (target: Element, name: string, init: KeyboardEventInit = {}) =>
	target.dispatchEvent(
		new KeyboardEvent('keydown', {
			key: name,
			bubbles: true,
			composed: true,
			cancelable: true,
			...init,
		}),
	);

describe('pptx-ui-context-menu', () => {
	it('exposes menu semantics, markers and roles for every kind of row', () => {
		const host = mount();
		const menu = host.shadowRoot!.querySelector('[role="menu"]')!;
		expect(menu.getAttribute('aria-label')).toBe('Shape menu');
		expect(host.getAttribute('data-pptx-context-menu')).toBe('true');
		expect(menu.querySelectorAll('[role="separator"]')).toHaveLength(1);
		const [copy, paste, , grid, del] = rows(host);
		expect(copy.getAttribute('role')).toBe('menuitem');
		expect(grid.getAttribute('role')).toBe('menuitemcheckbox');
		expect(grid.getAttribute('aria-checked')).toBe('true');
		expect(paste.disabled).toBeTruthy();
		expect(paste.getAttribute('aria-disabled')).toBe('true');
		expect(del.classList.contains('danger')).toBeTruthy();
	});

	it('ignores marker names outside the data-pptx namespace and removes stale ones', () => {
		const host = mount({ markers: ['onclick', 'data-pptx-a'] });
		expect(host.hasAttribute('onclick')).toBeFalsy();
		expect(host.hasAttribute('data-pptx-a')).toBeTruthy();
		host.state = { ...base, markers: ['data-pptx-b'] };
		expect(host.hasAttribute('data-pptx-a')).toBeFalsy();
		expect(host.hasAttribute('data-pptx-b')).toBeTruthy();
	});

	it('emits menu-request with the id and never closes itself', () => {
		const host = mount();
		const requests: string[] = [];
		document.body.addEventListener('menu-request', (event) =>
			requests.push((event as CustomEvent<{ id: string }>).detail.id),
		);
		rows(host)[2].click();
		expect(requests).toStrictEqual(['cut']);
		expect(host.isConnected).toBeTruthy();
	});

	it('focuses the first enabled row and rotates focus with the arrow keys, skipping disabled rows', () => {
		const host = mount();
		const buttons = rows(host);
		const focused = () => host.shadowRoot!.activeElement;
		expect(focused()).toBe(buttons[0]);
		expect(buttons.map((b) => b.tabIndex)).toStrictEqual([0, -1, -1, -1, -1]);
		key(focused()!, 'ArrowDown');
		expect(focused()).toBe(rows(host)[2]);
		key(focused()!, 'End');
		expect(focused()).toBe(rows(host)[4]);
		key(focused()!, 'ArrowDown');
		expect(focused()).toBe(rows(host)[0]);
		key(focused()!, 'ArrowUp');
		expect(focused()).toBe(rows(host)[4]);
		key(focused()!, 'Home');
		expect(focused()).toBe(rows(host)[0]);
		expect(rows(host).filter((b) => b.tabIndex === 0)).toHaveLength(1);
	});

	it('type-ahead jumps to a matching enabled row and cycles repeated letters', () => {
		vi.useFakeTimers();
		const host = mount({
			items: [
				{ id: 'a', label: 'Cut' },
				{ id: 'b', label: 'Copy' },
				{ id: 'c', label: 'Delete' },
			],
		});
		const focused = () => (host.shadowRoot!.activeElement as HTMLElement).dataset.itemId;
		key(host.shadowRoot!.activeElement!, 'c');
		expect(focused()).toBe('b');
		key(host.shadowRoot!.activeElement!, 'c');
		expect(focused()).toBe('a');
		vi.advanceTimersByTime(1000);
		key(host.shadowRoot!.activeElement!, 'd');
		expect(focused()).toBe('c');
		vi.useRealTimers();
		expect(typeAheadIndex(base.items, 0, 'p')).toBe(-1);
		expect(typeAheadIndex(base.items, 0, 'cc')).toBe(2);
	});

	it('keeps focus on the same row across a state update', () => {
		const host = mount();
		key(host.shadowRoot!.activeElement!, 'ArrowDown');
		host.state = { ...base, items: base.items.map((item) => ({ ...item })) };
		expect((host.shadowRoot!.activeElement as HTMLElement).dataset.itemId).toBe('cut');
	});

	it('dismisses on Escape, outside press and Tab, and swallows Escape', () => {
		const host = mount();
		const closes: string[] = [];
		host.addEventListener('menu-close', (event) =>
			closes.push((event as CustomEvent<{ reason: string }>).detail.reason),
		);
		const outside = vi.fn();
		window.addEventListener('keydown', outside);
		key(host.shadowRoot!.activeElement!, 'Escape');
		expect(outside).not.toHaveBeenCalled();
		document.body.dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true }));
		rows(host)[0].dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true }));
		key(host.shadowRoot!.activeElement!, 'Tab');
		window.removeEventListener('keydown', outside);
		expect(closes).toStrictEqual(['escape', 'outside', 'tab']);
	});

	it('closes only the innermost of two open menus on Escape', () => {
		const first = mount();
		const second = mount();
		const closed: string[] = [];
		first.addEventListener('menu-close', () => closed.push('first'));
		second.addEventListener('menu-close', () => closed.push('second'));
		key(second.shadowRoot!.activeElement!, 'Escape');
		expect(closed).toStrictEqual(['second']);
	});

	it('clamps into the window and re-places on state change', () => {
		vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
			width: 200,
			height: 300,
			x: 0,
			y: 0,
			top: 0,
			left: 0,
			right: 200,
			bottom: 300,
			toJSON: () => ({}),
		});
		const host = mount({ x: window.innerWidth - 10, y: window.innerHeight - 10 });
		expect(host.style.left).toBe(`${window.innerWidth - 208}px`);
		expect(host.style.top).toBe(`${window.innerHeight - 308}px`);
		host.state = { ...base, x: 0, y: 0, zIndex: 77 };
		expect(host.style.left).toBe('8px');
		expect(host.style.zIndex).toBe('77');
		vi.restoreAllMocks();
	});

	it('restores focus to the opener unless something else took it', () => {
		const opener = document.createElement('button');
		const other = document.createElement('button');
		document.body.append(opener, other);
		opener.focus();
		const host = mount();
		expect(document.activeElement).toBe(host);
		host.remove();
		expect(document.activeElement).toBe(opener);

		const second = mount();
		other.focus();
		second.remove();
		expect(document.activeElement).toBe(other);
	});

	it('hides when emptied, stops listening and reopens on a remount', () => {
		const host = mount();
		const closes = vi.fn();
		host.addEventListener('menu-close', closes);
		host.state = { ...base, items: [] };
		expect(host.hidden).toBeTruthy();
		key(document.body, 'Escape');
		expect(closes).not.toHaveBeenCalled();
		host.state = base;
		expect(host.hidden).toBeFalsy();
		host.remove();
		document.body.append(host);
		key(host.shadowRoot!.activeElement!, 'Escape');
		expect(closes).toHaveBeenCalledOnce();
	});

	it('keeps instances isolated from one another', () => {
		const a = mount({ label: 'A', items: [{ id: 'x', label: 'X' }] });
		const b = mount({ label: 'B', items: [{ id: 'y', label: 'Y' }] });
		expect(a.shadowRoot!.querySelector('[role="menu"]')!.getAttribute('aria-label')).toBe('A');
		expect(b.shadowRoot!.querySelectorAll('button')).toHaveLength(1);
		expect(rows(a)[0].dataset.itemId).toBe('x');
	});

	it('groups headed sections for assistive technology', () => {
		const host = mount({
			items: [
				{ id: 'n', label: 'Next' },
				{ id: 'p', label: 'Pen', separatorBefore: true, heading: 'Pointer' },
				{ id: 'h', label: 'Highlighter' },
				{ id: 'e', label: 'End', separatorBefore: true },
			],
		});
		const group = host.shadowRoot!.querySelector('[role="group"]')!;
		expect(group.getAttribute('aria-label')).toBe('Pointer');
		expect(group.querySelectorAll('button')).toHaveLength(2);
		expect(host.shadowRoot!.querySelectorAll('[role="separator"]')).toHaveLength(2);
	});
});

describe('context menu item mapping', () => {
	const t = (name: string, params?: Record<string, string | number>) =>
		params ? `${name}:${params.count}` : name;

	it('maps built-in and host entries and greys unwired commands', () => {
		const items = contextMenuViewItems(
			[
				{ id: 'copy', labelKey: 'k.copy' },
				{ id: 'host:x', labelKey: '', label: 'Custom', separatorBefore: true, disabled: false },
				{ id: 'delete', labelKey: 'k.delete', danger: true },
			],
			t,
			(id) => id !== 'delete',
		);
		expect(items.map((i) => [i.label, i.disabled, i.separatorBefore, i.danger])).toStrictEqual([
			['k.copy', false, undefined, undefined],
			['Custom', false, true, undefined],
			['k.delete', true, undefined, true],
		]);
	});

	it('maps slide-pane entries with counts and a danger delete', () => {
		const items = slidePaneViewItems(
			[
				{ id: 'duplicate', labelKey: 'k.dup', countLabelKey: 'k.dup' },
				{ id: 'delete', labelKey: 'k.del', disabled: true, separatorBefore: true },
			],
			t,
			3,
		);
		expect(items[0].label).toBe('k.dup:3');
		expect(items[1]).toMatchObject({ danger: true, disabled: true, separatorBefore: true });
	});

	it('maps presentation sections to rules and headings', () => {
		const items = presentationViewItems(
			[
				{ id: 'nav', items: [{ id: 'next', labelKey: 'k.next' }] },
				{
					id: 'pointer',
					headingKey: 'k.pointer',
					items: [
						{ id: 'pointerPen', labelKey: 'k.pen' },
						{ id: 'pointerLaser', labelKey: 'k.laser' },
					],
				},
			],
			t,
		);
		expect(items.map((i) => [i.separatorBefore ?? false, i.heading])).toStrictEqual([
			[false, undefined],
			[true, 'k.pointer'],
			[false, undefined],
		]);
	});
});
