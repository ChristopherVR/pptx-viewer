import { mount } from '@vue/test-utils';
import type { PptxElement, TextSegment } from 'pptx-viewer-core';
import { afterEach, describe, expect, it } from 'vitest';

import EquationEditorDialog from './EquationEditorDialog.vue';
import { convertLatexToOmml } from './latex-to-omml';

afterEach(() => {
	document.body.innerHTML = '';
});

function textarea(): HTMLTextAreaElement {
	const ta = document.body.querySelector<HTMLTextAreaElement>('.pptx-vue-equation-textarea');
	if (!ta) {
		throw new Error('latex textarea not found');
	}
	return ta;
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

async function typeLatex(wrapper: ReturnType<typeof mount>, value: string): Promise<void> {
	const ta = textarea();
	ta.value = value;
	ta.dispatchEvent(new Event('input'));
	await wrapper.vm.$nextTick();
}

describe('equationEditorDialog', () => {
	it('renders a LaTeX textarea and template grid when open', () => {
		mount(EquationEditorDialog, {
			props: { open: true },
			attachTo: document.body,
		});
		expect(document.body.querySelector('.pptx-vue-equation-textarea')).toBeTruthy();
		expect(document.body.querySelectorAll('.pptx-vue-equation-template').length).toBeGreaterThan(0);
	});

	it('keeps the confirm button disabled while empty', () => {
		mount(EquationEditorDialog, {
			props: { open: true },
			attachTo: document.body,
		});
		expect(footerButton('Insert').disabled).toBeTruthy();
	});

	it('emits insert + apply with an equation payload on confirm', async () => {
		const wrapper = mount(EquationEditorDialog, {
			props: { open: true },
			attachTo: document.body,
		});

		await typeLatex(wrapper, '\\frac{a}{b}');
		footerButton('Insert').click();
		await wrapper.vm.$nextTick();

		const inserted = wrapper.emitted('insert');
		const applied = wrapper.emitted('apply');
		expect(inserted).toHaveLength(1);
		expect(applied).toHaveLength(1);

		const element = inserted?.[0]?.[0] as PptxElement;
		expect(element.type).toBe('shape');
		expect(element.id).toBeTruthy();
		expect(element.textSegments?.[0]?.equationXml).toHaveProperty('m:oMathPara');

		const segment = applied?.[0]?.[0] as TextSegment;
		expect(segment.equationXml).toHaveProperty('m:oMathPara');
		expect(wrapper.emitted('close')).toHaveLength(1);
	});

	it('seeds the textarea from existing OMML in edit mode', () => {
		const omml = convertLatexToOmml('\\frac{a}{b}');
		mount(EquationEditorDialog, {
			props: { open: true, existingOmml: omml },
			attachTo: document.body,
		});
		expect(textarea().value).toBe('\\frac{a}{b}');
		expect(footerButton('Update')).toBeTruthy();
	});

	it('inserting a template populates the textarea', async () => {
		const wrapper = mount(EquationEditorDialog, {
			props: { open: true },
			attachTo: document.body,
		});

		const template = document.body.querySelector<HTMLButtonElement>('.pptx-vue-equation-template');
		if (!template) {
			throw new Error('no template tile');
		}
		template.click();
		await wrapper.vm.$nextTick();

		expect(textarea().value.length).toBeGreaterThan(0);
	});

	it('emits close on Cancel without inserting', async () => {
		const wrapper = mount(EquationEditorDialog, {
			props: { open: true },
			attachTo: document.body,
		});

		footerButton('Cancel').click();
		await wrapper.vm.$nextTick();

		expect(wrapper.emitted('insert')).toBeUndefined();
		expect(wrapper.emitted('close')).toHaveLength(1);
	});
});
