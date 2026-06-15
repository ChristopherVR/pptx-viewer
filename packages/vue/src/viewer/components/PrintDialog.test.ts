import { mount } from '@vue/test-utils';
import type { PptxSlide } from 'pptx-viewer-core';
import { afterEach, describe, expect, it } from 'vitest';

import type { PrintSettings } from './print-dialog-types';
import PrintDialog from './PrintDialog.vue';

afterEach(() => {
	document.body.innerHTML = '';
});

function makeSlides(n: number): PptxSlide[] {
	return Array.from(
		{ length: n },
		(_, i) => ({ id: `s${i}`, elements: [] }) as unknown as PptxSlide,
	);
}

function clickButton(label: string): void {
	const btn = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find(
		(b) => b.textContent?.trim() === label,
	);
	if (!btn) {
		throw new Error(`button "${label}" not found`);
	}
	btn.click();
}

function clickRadio(name: string, index: number): void {
	const radios = document.body.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`);
	radios[index]?.dispatchEvent(new Event('change'));
}

describe('printDialog', () => {
	it('renders the settings panel when open', () => {
		mount(PrintDialog, {
			props: { open: true, slides: makeSlides(3), activeSlideIndex: 0 },
			attachTo: document.body,
		});
		expect(document.body.textContent).toContain('Print what');
		expect(document.body.textContent).toContain('All slides (3)');
	});

	it('renders nothing when closed', () => {
		mount(PrintDialog, {
			props: { open: false, slides: makeSlides(3), activeSlideIndex: 0 },
			attachTo: document.body,
		});
		expect(document.body.textContent).not.toContain('Print what');
	});

	it('emits resolved default settings on Print', async () => {
		const wrapper = mount(PrintDialog, {
			props: { open: true, slides: makeSlides(4), activeSlideIndex: 1 },
			attachTo: document.body,
		});
		clickButton('Print');
		await wrapper.vm.$nextTick();
		const settings = wrapper.emitted('print')?.[0]?.[0] as PrintSettings;
		expect(settings.printWhat).toBe('slides');
		expect(settings.orientation).toBe('landscape');
		expect(settings.colorMode).toBe('color');
		expect(settings.slideRange).toBe('all');
		expect(settings.customRangeFrom).toBe(1);
		expect(settings.customRangeTo).toBe(4);
	});

	it('emits close on Cancel', async () => {
		const wrapper = mount(PrintDialog, {
			props: { open: true, slides: makeSlides(2), activeSlideIndex: 0 },
			attachTo: document.body,
		});
		clickButton('Cancel');
		await wrapper.vm.$nextTick();
		expect(wrapper.emitted('close')).toHaveLength(1);
	});

	it('forces portrait orientation for handouts', async () => {
		const wrapper = mount(PrintDialog, {
			props: { open: true, slides: makeSlides(6), activeSlideIndex: 0 },
			attachTo: document.body,
		});
		// print-what radios are in document order: slides, handouts, notes, outline
		clickRadio('printWhat', 1);
		await wrapper.vm.$nextTick();
		clickButton('Print');
		await wrapper.vm.$nextTick();
		const settings = wrapper.emitted('print')?.[0]?.[0] as PrintSettings;
		expect(settings.printWhat).toBe('handouts');
		expect(settings.orientation).toBe('portrait');
	});

	it('seeds slides-per-page from defaultSlidesPerPage', async () => {
		const wrapper = mount(PrintDialog, {
			props: {
				open: true,
				slides: makeSlides(9),
				activeSlideIndex: 0,
				defaultSlidesPerPage: 9,
			},
			attachTo: document.body,
		});
		clickRadio('printWhat', 1); // handouts
		await wrapper.vm.$nextTick();
		clickButton('Print');
		await wrapper.vm.$nextTick();
		const settings = wrapper.emitted('print')?.[0]?.[0] as PrintSettings;
		expect(settings.slidesPerPage).toBe(9);
	});

	it('shows the handout preview only for the handout layout', async () => {
		const wrapper = mount(PrintDialog, {
			props: { open: true, slides: makeSlides(6), activeSlideIndex: 0 },
			attachTo: document.body,
		});
		expect(document.body.textContent).not.toContain('Preview');
		clickRadio('printWhat', 1); // handouts
		await wrapper.vm.$nextTick();
		expect(document.body.textContent).toContain('Preview');
	});

	it('updates the page/slide estimate for the current range', async () => {
		const wrapper = mount(PrintDialog, {
			props: { open: true, slides: makeSlides(5), activeSlideIndex: 0 },
			attachTo: document.body,
		});
		expect(document.body.textContent).toContain('5 pages');
		clickRadio('slideRange', 1); // current
		await wrapper.vm.$nextTick();
		expect(document.body.textContent).toContain('1 page');
		expect(document.body.textContent).toContain('1 slide');
	});
});
