import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../../i18n';
import { createSlidesGroup } from './slides-group';

function handlers() {
	return {
		addSlide: vi.fn(),
		insertSlideFromLayout: vi.fn(),
		insertSlideFromTemplate: vi.fn(),
		applyLayout: vi.fn(),
		resetSlide: vi.fn(),
		addSection: vi.fn(),
	};
}

const layouts = [{ path: 'layouts/one.xml', name: 'Title' }];
const ready = { editable: true, slideCount: 2, layouts };

function control(group: ReturnType<typeof createSlidesGroup>, id: string) {
	return group.el.querySelector<HTMLElement>(`[data-ribbon-control="home.slides.${id}"]`)!;
}

describe('createSlidesGroup', () => {
	it('renders the shared group with the public ids', () => {
		const group = createSlidesGroup(document, createTranslator(), handlers());
		group.update(ready);
		expect(group.el.localName).toBe('pptx-ui-ribbon-home-slides');
		expect(group.el.querySelector('[data-ribbon-group="home.slides"]')).toBeTruthy();
		for (const id of ['newSlide', 'slideTemplates', 'layout', 'reset', 'section']) {
			expect(control(group, id)).toBeTruthy();
		}
	});

	it('routes the buttons to the handlers', () => {
		const actions = handlers();
		const group = createSlidesGroup(document, createTranslator(), actions);
		group.update(ready);
		control(group, 'newSlide')
			.querySelector<HTMLElement>('[data-pptx-chrome="split-main"]')!
			.click();
		control(group, 'reset').click();
		control(group, 'section').click();
		expect(actions.addSlide).toHaveBeenCalledOnce();
		expect(actions.resetSlide).toHaveBeenCalledOnce();
		expect(actions.addSection).toHaveBeenCalledOnce();
	});

	it('opens the native layout menus inside the shared wrappers and applies a pick', () => {
		const actions = handlers();
		const group = createSlidesGroup(document, createTranslator(), actions);
		group.update(ready);
		const wrapper = control(group, 'layout');
		const menu = wrapper.querySelector<HTMLElement>('[data-testid="layout-gallery-menu"]')!;
		expect(menu.hidden).toBeTruthy();
		wrapper.querySelector('button')!.click();
		expect(menu.hidden).toBeFalsy();
		expect(wrapper.querySelector('button')!.getAttribute('aria-expanded')).toBe('true');
		menu.querySelector<HTMLElement>('.pptxv-layout-tile')!.click();
		expect(actions.applyLayout).toHaveBeenCalledWith('layouts/one.xml');
		expect(menu.hidden).toBeTruthy();

		control(group, 'newSlide')
			.querySelector<HTMLElement>('[data-pptx-chrome="split-caret"]')!
			.click();
		control(group, 'newSlide').querySelector<HTMLElement>('.pptxv-layout-tile')!.click();
		expect(actions.insertSlideFromLayout).toHaveBeenCalledWith('layouts/one.xml', 'Title');
	});

	it('gates on edit rights, layouts and an existing slide', () => {
		const group = createSlidesGroup(document, createTranslator(), handlers());
		group.update({ editable: true, slideCount: 0, layouts: [] });
		const caret = control(group, 'newSlide').querySelector<HTMLButtonElement>(
			'[data-pptx-chrome="split-caret"]',
		)!;
		expect(caret.hidden).toBeTruthy();
		expect(control(group, 'newSlide').querySelector('button')!.disabled).toBeFalsy();
		expect(
			(control(group, 'layout').querySelector('button') as HTMLButtonElement).disabled,
		).toBeTruthy();
		expect((control(group, 'reset') as HTMLButtonElement).disabled).toBeTruthy();
		group.update({ ...ready, editable: false });
		expect(control(group, 'newSlide').querySelector('button')!.disabled).toBeTruthy();
		expect(caret.disabled).toBeTruthy();
		expect((control(group, 'slideTemplates') as HTMLButtonElement).disabled).toBeTruthy();
	});
});
