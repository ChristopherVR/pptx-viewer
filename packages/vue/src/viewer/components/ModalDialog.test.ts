import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { h } from 'vue';

import ModalDialog from './ModalDialog.vue';

afterEach(() => {
	document.body.innerHTML = '';
});

describe('modalDialog', () => {
	it('renders nothing when closed', () => {
		mount(ModalDialog, {
			props: { open: false, title: 'Hi' },
			attachTo: document.body,
		});
		expect(document.body.querySelector('.pptx-vue-modal-panel')).toBeNull();
	});

	it('renders the title and default slot when open', () => {
		mount(ModalDialog, {
			props: { open: true, title: 'My Title' },
			slots: { default: () => h('p', { class: 'body-marker' }, 'Body content') },
			attachTo: document.body,
		});
		const title = document.body.querySelector('.pptx-vue-modal-title');
		expect(title?.textContent).toBe('My Title');
		const body = document.body.querySelector('.body-marker');
		expect(body?.textContent).toBe('Body content');
	});

	it('renders the footer slot when provided', () => {
		mount(ModalDialog, {
			props: { open: true },
			slots: { footer: () => h('button', { class: 'footer-marker' }, 'OK') },
			attachTo: document.body,
		});
		expect(document.body.querySelector('.footer-marker')).not.toBeNull();
	});

	it('emits close when the × button is clicked', async () => {
		const wrapper = mount(ModalDialog, {
			props: { open: true, title: 'X' },
			attachTo: document.body,
		});
		const closeBtn = document.body.querySelector<HTMLButtonElement>('.pptx-vue-modal-close');
		closeBtn?.click();
		await wrapper.vm.$nextTick();
		expect(wrapper.emitted('close')).toHaveLength(1);
	});

	it('emits close on backdrop click but not on panel click', async () => {
		const wrapper = mount(ModalDialog, {
			props: { open: true, title: 'X' },
			attachTo: document.body,
		});

		const panel = document.body.querySelector<HTMLElement>('.pptx-vue-modal-panel');
		panel?.click();
		await wrapper.vm.$nextTick();
		expect(wrapper.emitted('close')).toBeUndefined();

		const backdrop = document.body.querySelector<HTMLElement>('.pptx-vue-modal-backdrop');
		backdrop?.click();
		await wrapper.vm.$nextTick();
		expect(wrapper.emitted('close')).toHaveLength(1);
	});

	it('emits close when Escape is pressed', async () => {
		const wrapper = mount(ModalDialog, {
			props: { open: true, title: 'X' },
			attachTo: document.body,
		});
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
		await wrapper.vm.$nextTick();
		expect(wrapper.emitted('close')).toHaveLength(1);
	});

	it('carries the mobile bottom-sheet layout classes on the panel', () => {
		mount(ModalDialog, { props: { open: true, title: 'X' }, attachTo: document.body });
		const panel = document.body.querySelector<HTMLElement>('.pptx-vue-modal-panel');
		const cls = panel?.className ?? '';
		// On mobile the panel docks to the bottom as a full-width, dvh-bounded
		// sheet with a rounded top and no rigid min-width (so it cannot overflow
		// a 360px phone).
		expect(cls).toContain('max-md:fixed');
		expect(cls).toContain('max-md:bottom-0');
		expect(cls).toContain('max-md:max-h-[88dvh]');
		expect(cls).toContain('max-md:rounded-t-2xl');
		expect(cls).toContain('max-md:min-w-0');
		expect(cls).toContain('max-md:max-w-none');
	});

	it('gives the close button a 44px touch target on mobile', () => {
		mount(ModalDialog, { props: { open: true, title: 'X' }, attachTo: document.body });
		const closeBtn = document.body.querySelector<HTMLElement>('.pptx-vue-modal-close');
		const cls = closeBtn?.className ?? '';
		expect(cls).toContain('max-md:h-11');
		expect(cls).toContain('max-md:w-11');
	});
});
