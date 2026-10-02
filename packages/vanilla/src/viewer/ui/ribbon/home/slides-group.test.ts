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

	it('opens the shared layout galleries and applies a pick', () => {
		const actions = handlers();
		const group = createSlidesGroup(document, createTranslator(), actions);
		group.update({ ...ready, currentLayoutPath: 'layouts/one.xml' });
		const wrapper = control(group, 'layout');
		const popup = () => wrapper.querySelector<HTMLElement>('.popup')!;
		expect(popup().hidden).toBeTruthy();
		wrapper.querySelector('button')!.click();
		const menu = wrapper.querySelector<HTMLElement>('[data-testid="layout-gallery-menu"]')!;
		expect(menu.hidden).toBeFalsy();
		expect(wrapper.querySelector('button')!.getAttribute('aria-expanded')).toBe('true');
		const tile = menu.querySelector<HTMLElement>('[data-layout-path]')!;
		expect(tile.getAttribute('aria-current')).toBe('true');
		tile.click();
		expect(actions.applyLayout).toHaveBeenCalledWith('layouts/one.xml');
		expect(menu.hidden).toBeTruthy();

		control(group, 'newSlide')
			.querySelector<HTMLElement>('[data-pptx-chrome="split-caret"]')!
			.click();
		control(group, 'newSlide').querySelector<HTMLElement>('[data-layout-path]')!.click();
		expect(actions.insertSlideFromLayout).toHaveBeenCalledWith('layouts/one.xml', 'Title');
	});

	it('draws the host artwork inside each tile and releases it on close', () => {
		const remove = vi.spyOn(HTMLElement.prototype, 'remove');
		const group = createSlidesGroup(document, createTranslator(), {
			...handlers(),
			renderLayoutPreview: () => document.createElement('i'),
		});
		const preview = new Map([
			['layouts/one.xml', { path: 'layouts/one.xml', name: 'Title', elements: [] }],
		]);
		group.update({ ...ready, layoutPreviews: preview as never });
		const wrapper = control(group, 'layout');
		wrapper.querySelector('button')!.click();
		expect(wrapper.querySelector('.surface i')).not.toBeNull();
		wrapper.querySelector('button')!.click();
		expect(remove.mock.calls.length).toBeGreaterThan(0);
		remove.mockRestore();
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
