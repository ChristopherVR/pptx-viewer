import { mount } from '@vue/test-utils';
import type { PptxElement, SmartArtPptxElement } from 'pptx-viewer-core';
import { afterEach, describe, expect, it } from 'vitest';

import InsertSmartArtDialog from './InsertSmartArtDialog.vue';

afterEach(() => {
	document.body.innerHTML = '';
});

function tileByLabel(label: string): HTMLButtonElement {
	const btn = Array.from(
		document.body.querySelectorAll<HTMLButtonElement>('.pptx-vue-smartart-tile'),
	).find((b) => b.textContent?.includes(label));
	if (!btn) {
		throw new Error(`tile "${label}" not found`);
	}
	return btn;
}

function categoryTab(label: string): HTMLButtonElement {
	const btn = Array.from(
		document.body.querySelectorAll<HTMLButtonElement>('.pptx-vue-smartart-cat'),
	).find((b) => b.textContent?.trim() === label);
	if (!btn) {
		throw new Error(`category "${label}" not found`);
	}
	return btn;
}

function footerButton(label: string): HTMLButtonElement {
	const btn = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find(
		(b) => b.textContent?.trim() === label,
	);
	if (!btn) {
		throw new Error(`button "${label}" not found`);
	}
	return btn;
}

describe('insertSmartArtDialog', () => {
	it('renders the category sidebar and a gallery when open', () => {
		mount(InsertSmartArtDialog, {
			props: { open: true },
			attachTo: document.body,
		});
		expect(document.body.querySelector('.pptx-vue-smartart-sidebar')).toBeTruthy();
		expect(document.body.querySelectorAll('.pptx-vue-smartart-tile').length).toBeGreaterThan(0);
	});

	it('keeps Insert disabled until a layout is selected', async () => {
		mount(InsertSmartArtDialog, {
			props: { open: true },
			attachTo: document.body,
		});
		expect(footerButton('Insert').disabled).toBeTruthy();
	});

	it('emits a renderable SmartArt element on Insert', async () => {
		const wrapper = mount(InsertSmartArtDialog, {
			props: { open: true },
			attachTo: document.body,
		});

		tileByLabel('Basic Block List').click();
		await wrapper.vm.$nextTick();

		footerButton('Insert').click();
		await wrapper.vm.$nextTick();

		const inserted = wrapper.emitted('insert');
		expect(inserted).toHaveLength(1);
		const element = inserted?.[0]?.[0] as SmartArtPptxElement;
		expect(element.type).toBe('smartArt');
		expect(element.smartArtData.layout).toBe('basicBlockList');
		expect(element.smartArtData.nodes.length).toBeGreaterThan(0);
		expect(element.id).toBeTruthy();
		expect(wrapper.emitted('close')).toHaveLength(1);
	});

	it('parents hierarchy nodes under the root', async () => {
		const wrapper = mount(InsertSmartArtDialog, {
			props: { open: true },
			attachTo: document.body,
		});

		categoryTab('Hierarchy').click();
		await wrapper.vm.$nextTick();
		tileByLabel('Hierarchy').click();
		await wrapper.vm.$nextTick();
		footerButton('Insert').click();
		await wrapper.vm.$nextTick();

		const element = wrapper.emitted('insert')?.[0]?.[0] as SmartArtPptxElement;
		const nodes = element.smartArtData.nodes;
		expect(nodes[0]?.parentId).toBeUndefined();
		expect(nodes[1]?.parentId).toBe(nodes[0]?.id);
	});

	it('emits close on Cancel without inserting', async () => {
		const wrapper = mount(InsertSmartArtDialog, {
			props: { open: true },
			attachTo: document.body,
		});

		footerButton('Cancel').click();
		await wrapper.vm.$nextTick();

		expect(wrapper.emitted('insert')).toBeUndefined();
		expect(wrapper.emitted('close')).toHaveLength(1);
	});

	it('inserted nodes respect edited textarea lines', async () => {
		const wrapper = mount(InsertSmartArtDialog, {
			props: { open: true },
			attachTo: document.body,
		});

		tileByLabel('Basic Block List').click();
		await wrapper.vm.$nextTick();

		const textarea = document.body.querySelector<HTMLTextAreaElement>(
			'.pptx-vue-smartart-textarea',
		);
		if (!textarea) {
			throw new Error('textarea not found');
		}
		textarea.value = 'One\nTwo';
		textarea.dispatchEvent(new Event('input'));
		await wrapper.vm.$nextTick();

		footerButton('Insert').click();
		await wrapper.vm.$nextTick();

		const element = wrapper.emitted('insert')?.[0]?.[0] as SmartArtPptxElement;
		expect(element.smartArtData.nodes.map((n) => n.text)).toStrictEqual(['One', 'Two']);
	});
});

describe('insertSmartArtDialog payload shape', () => {
	it('produces a PptxElement assignable shape', async () => {
		const wrapper = mount(InsertSmartArtDialog, {
			props: { open: true },
			attachTo: document.body,
		});
		categoryTab('Cycle').click();
		await wrapper.vm.$nextTick();
		tileByLabel('Basic Cycle').click();
		await wrapper.vm.$nextTick();
		footerButton('Insert').click();
		await wrapper.vm.$nextTick();

		const element = wrapper.emitted('insert')?.[0]?.[0] as PptxElement;
		expect(element).toHaveProperty('x');
		expect(element).toHaveProperty('y');
		expect(element).toHaveProperty('width');
		expect(element).toHaveProperty('height');
	});
});
