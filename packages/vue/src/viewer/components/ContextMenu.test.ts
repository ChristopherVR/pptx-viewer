import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ContextMenu from './ContextMenu.vue';
import type { ContextMenuItem } from './ContextMenu.vue';

function items(): ContextMenuItem[] {
	return [
		{ id: 'copy', label: 'Copy' },
		{ id: 'paste', label: 'Paste', disabled: true },
		{ id: 'sep', label: '', separator: true },
		{ id: 'delete', label: 'Delete' },
	];
}

function mountMenu(open = true) {
	return mount(ContextMenu, {
		props: { open, x: 50, y: 60, items: items() },
		attachTo: document.body,
	});
}

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
		document.querySelector<HTMLButtonElement>('[data-item-id="host:chat"]')!.click();
		await wrapper.vm.$nextTick();
		expect(events).toStrictEqual(['close', 'host']);
		expect(wrapper.emitted('select')).toBeUndefined();
		wrapper.unmount();
	});

	it('renders nothing when closed', () => {
		mountMenu(false);
		expect(document.querySelector('.pptx-vue-context-menu')).toBeNull();
	});

	it('renders the item set (buttons + separator) when open', () => {
		mountMenu();
		const buttons = document.querySelectorAll('.pptx-vue-context-menu__item');
		expect(buttons).toHaveLength(3); // copy, paste, delete (separator is not a button)
		expect(document.querySelector('.pptx-vue-context-menu__separator')).not.toBeNull();
		expect(document.querySelector('[data-item-id="copy"]')?.textContent?.trim()).toBe('Copy');
	});

	it('emits select with the id then close when an enabled item is clicked', async () => {
		const wrapper = mountMenu();
		const copy = document.querySelector<HTMLButtonElement>('[data-item-id="copy"]');
		expect(copy).not.toBeNull();
		copy?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await wrapper.vm.$nextTick();

		expect(wrapper.emitted('select')).toStrictEqual([['copy']]);
		expect(wrapper.emitted('close')).toHaveLength(1);
	});

	it('does not emit select for a disabled item', async () => {
		const wrapper = mountMenu();
		const paste = document.querySelector<HTMLButtonElement>('[data-item-id="paste"]');
		expect(paste?.disabled).toBeTruthy();
		paste?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await wrapper.vm.$nextTick();

		expect(wrapper.emitted('select')).toBeUndefined();
	});

	it('emits close on Escape', async () => {
		const wrapper = mountMenu();
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
		await wrapper.vm.$nextTick();

		expect(wrapper.emitted('close')).toHaveLength(1);
		expect(wrapper.emitted('select')).toBeUndefined();
	});

	it('emits close on an outside pointer down', async () => {
		const wrapper = mountMenu();
		const outside = document.createElement('div');
		document.body.appendChild(outside);
		outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
		await wrapper.vm.$nextTick();

		expect(wrapper.emitted('close')).toHaveLength(1);
	});

	it('does not emit close when clicking inside the menu', async () => {
		const wrapper = mountMenu();
		const menu = document.querySelector('.pptx-vue-context-menu');
		menu?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
		await wrapper.vm.$nextTick();

		expect(wrapper.emitted('close')).toBeUndefined();
	});
});
