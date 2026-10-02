import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ContextMenu from './ContextMenu.vue';
import type { ContextMenuItem } from './ContextMenu.vue';

function items(): ContextMenuItem[] {
	return [
		{ id: 'copy', label: 'Copy' },
		{ id: 'paste', label: 'Paste', disabled: true },
		{ id: 'sep', label: '', separator: true },
		{ id: 'delete', label: 'Delete', danger: true },
	];
}

function mountMenu(open = true, extra: Record<string, unknown> = {}) {
	return mount(ContextMenu, {
		props: { open, x: 50, y: 60, items: items(), ariaLabel: 'Shape menu', ...extra },
		attachTo: document.body,
	});
}

/** The shared element, and the rows drawn inside its shadow root. */
const host = () => document.querySelector<HTMLElement>('pptx-ui-context-menu');
const row = (id: string) =>
	host()?.shadowRoot?.querySelector<HTMLButtonElement>(`[data-item-id="${id}"]`) ?? null;

afterEach(() => {
	document.body.replaceChildren();
});

describe('contextMenu', () => {
	it('closes before running a host callback without dispatching a built-in', async () => {
		const events: string[] = [];
		const onSelect = vi.fn(() => events.push('host'));
		const wrapper = mount(ContextMenu, {
			props: {
				open: true,
				x: 0,
				y: 0,
				items: [{ id: 'host:chat', label: 'Send to chat', onSelect }],
				onClose: () => events.push('close'),
			},
			attachTo: document.body,
		});
		row('host:chat')!.click();
		await wrapper.vm.$nextTick();
		expect(events).toStrictEqual(['close', 'host']);
		expect(wrapper.emitted('select')).toBeUndefined();
		wrapper.unmount();
	});

	it('renders nothing when closed or when every entry is a separator', () => {
		mountMenu(false);
		expect(host()).toBeNull();
		mountMenu(true, { items: [{ id: 's', label: '', separator: true }] });
		expect(host()).toBeNull();
	});

	it('renders menu semantics, markers and the item set when open', () => {
		mountMenu(true, { isCanvasMenu: true, markers: ['data-pptx-slide-pane-context-menu'] });
		const menu = host()!.shadowRoot!.querySelector('[role="menu"]')!;
		expect(menu.getAttribute('aria-label')).toBe('Shape menu');
		expect(host()!.getAttribute('data-pptx-context-menu')).toBe('true');
		expect(host()!.getAttribute('data-pptx-canvas-context-menu')).toBe('true');
		expect(host()!.getAttribute('data-pptx-slide-pane-context-menu')).toBe('true');
		expect(menu.querySelectorAll('button')).toHaveLength(3);
		expect(menu.querySelectorAll('[role="separator"]')).toHaveLength(1);
		expect(row('copy')?.textContent?.trim()).toBe('Copy');
		expect(row('delete')?.classList.contains('danger')).toBeTruthy();
	});

	it('uses the presentation marker and layer for the slide-show menu', () => {
		mountMenu(true, { presentation: true });
		expect(host()!.hasAttribute('data-pptx-presentation-menu')).toBeTruthy();
		expect(host()!.hasAttribute('data-pptx-context-menu')).toBeFalsy();
		expect(Number(host()!.style.zIndex)).toBeGreaterThan(2147483000);
	});

	it('emits select with the id then close when an enabled item is clicked', async () => {
		const wrapper = mountMenu();
		row('copy')!.click();
		await wrapper.vm.$nextTick();

		expect(wrapper.emitted('select')).toStrictEqual([['copy']]);
		expect(wrapper.emitted('close')).toHaveLength(1);
	});

	it('does not emit select for a disabled item', async () => {
		const wrapper = mountMenu();
		expect(row('paste')?.disabled).toBeTruthy();
		row('paste')!.click();
		await wrapper.vm.$nextTick();

		expect(wrapper.emitted('select')).toBeUndefined();
	});

	it('emits close on Escape', async () => {
		const wrapper = mountMenu();
		row('copy')!.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }),
		);
		await wrapper.vm.$nextTick();

		expect(wrapper.emitted('close')).toHaveLength(1);
		expect(wrapper.emitted('select')).toBeUndefined();
	});

	it('emits close on an outside pointer down', async () => {
		const wrapper = mountMenu();
		const outside = document.createElement('div');
		document.body.appendChild(outside);
		outside.dispatchEvent(new Event('pointerdown', { bubbles: true }));
		await wrapper.vm.$nextTick();

		expect(wrapper.emitted('close')).toHaveLength(1);
	});

	it('does not emit close when pressing inside the menu', async () => {
		const wrapper = mountMenu();
		row('copy')!.dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true }));
		await wrapper.vm.$nextTick();

		expect(wrapper.emitted('close')).toBeUndefined();
	});

	it('folds separators into row rules and passes headings through', () => {
		mountMenu(true, {
			items: [
				{ id: 'a', label: 'A' },
				{ id: 'sep', label: '', separator: true },
				{ id: 'b', label: 'B', heading: 'Group' },
			],
		});
		const root = host()!.shadowRoot!;
		expect(root.querySelector('[role="group"]')?.getAttribute('aria-label')).toBe('Group');
		expect(root.querySelectorAll('[role="separator"]')).toHaveLength(1);
	});
});
