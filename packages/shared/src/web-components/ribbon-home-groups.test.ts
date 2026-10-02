// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
	arrangeAlignAction,
	arrangeHomeControls,
	drawingHomeControls,
	slidesHomeControls,
} from '../render';
import { registerPptxWebControls } from './index';

beforeAll(registerPptxWebControls);
afterEach(() => document.body.replaceChildren());

type Tag =
	| 'slides'
	| 'drawing'
	| 'arrange-align'
	| 'arrange-flip'
	| 'arrange-order'
	| 'arrange-edit';
function mount(tag: Tag, controls = {}) {
	const host = document.createElement(`pptx-ui-ribbon-home-${tag}`);
	host.state = { controls };
	document.body.append(host);
	return host;
}
const control = (host: HTMLElement, id: string) =>
	host.querySelector<HTMLElement>(`[data-ribbon-control="${id}"]`)!;
const intents = (host: HTMLElement) => {
	const request = vi.fn();
	host.addEventListener('home-request', request);
	return () => request.mock.calls.map((call) => call[0].detail);
};

const slides = {
	editable: true,
	hasLayouts: true,
	hasSlides: true,
	showTemplates: true,
	newSlideNeedsLayout: true,
	resetNeedsSlide: true,
};

describe('shared Slides group', () => {
	it('renders the group, a split New Slide and the public ids once', () => {
		const host = mount('slides', slidesHomeControls(slides));
		expect(host.querySelectorAll('[data-ribbon-group="home.slides"]')).toHaveLength(1);
		for (const id of ['newSlide', 'slideTemplates', 'layout', 'reset', 'section']) {
			expect(host.querySelectorAll(`[data-ribbon-control="home.slides.${id}"]`)).toHaveLength(1);
		}
		const split = control(host, 'home.slides.newSlide');
		expect(split.dataset.pptxChrome).toBe('split-button');
		expect(split.querySelector('[data-pptx-chrome="split-main"]')?.textContent).toBe('New Slide');
		expect(host.anchor('home.slides.layout')).toBe(control(host, 'home.slides.layout'));
	});

	it('emits the caret as a part of the New Slide id and rejects gated intents', () => {
		const host = mount('slides', slidesHomeControls(slides));
		const read = intents(host);
		host.querySelector<HTMLElement>('[data-ribbon-control="home.slides.reset"]')!.click();
		host.querySelector<HTMLElement>('[data-pptx-chrome="split-main"]')!.click();
		expect(read()).toStrictEqual([{ id: 'home.slides.reset' }, { id: 'home.slides.newSlide' }]);
		host.state = {
			controls: slidesHomeControls({ ...slides, editable: false, hasLayouts: false }),
		};
		host.querySelector<HTMLElement>('[data-ribbon-control="home.slides.reset"]')!.click();
		expect(read()).toHaveLength(2);
		expect(
			host.querySelector<HTMLElement>('[data-pptx-chrome="split-caret"]')!.hidden,
		).toBeTruthy();
	});

	it('hides templates, mirrors popover state and keeps the visible text as the name', () => {
		const host = mount('slides', slidesHomeControls({ ...slides, showTemplates: false }));
		expect(control(host, 'home.slides.slideTemplates').hidden).toBeTruthy();
		const layout = control(host, 'home.slides.layout').querySelector('button')!;
		expect(layout.getAttribute('aria-expanded')).toBe('false');
		expect(layout.getAttribute('aria-haspopup')).toBe('dialog');
		const reset = control(host, 'home.slides.reset');
		expect(reset.getAttribute('aria-label')).toBe('Reset');
		expect(reset.title).toBe('Reset slide');
	});

	it('follows the host-specific lock rules for an empty deck', () => {
		const empty = { ...slides, hasSlides: false };
		expect(slidesHomeControls(empty)['home.slides.reset']?.disabled).toBeTruthy();
		expect(
			slidesHomeControls({ ...empty, resetNeedsSlide: false })['home.slides.reset']?.disabled,
		).toBeFalsy();
		expect(
			slidesHomeControls({ ...slides, hasLayouts: false, newSlideNeedsLayout: false })[
				'home.slides.newSlide'
			]?.disabled,
		).toBeFalsy();
	});
});

describe('shared Drawing triggers', () => {
	it('gates by selection and opens its own shapes menu', () => {
		const host = mount('drawing', drawingHomeControls({ editable: true, hasSelection: false }));
		const shapes = control(host, 'home.drawing.shapes').querySelector('button')!;
		expect(shapes.disabled).toBeFalsy();
		expect(shapes.getAttribute('aria-expanded')).toBe('false');
		for (const id of ['arrange', 'shapeFill', 'shapeOutline']) {
			expect(control(host, `home.drawing.${id}`).querySelector('button')!.disabled).toBeTruthy();
		}
		const read = intents(host);
		const popup = vi.fn();
		host.addEventListener('home-popup', popup);
		shapes.click();
		expect(shapes.getAttribute('aria-expanded')).toBe('true');
		expect(popup.mock.calls[0][0].detail).toStrictEqual({ id: 'home.drawing.shapes', open: true });
		const rows = control(host, 'home.drawing.shapes').querySelectorAll<HTMLElement>(
			'[role="menuitem"]',
		);
		expect(rows).toHaveLength(12);
		rows[2].click();
		expect(shapes.getAttribute('aria-expanded')).toBe('false');
		expect(read()).toStrictEqual([{ id: 'home.drawing.shapes', value: 'ellipse' }]);
	});

	it('offers the colour popover with theme, standard and recent colours', () => {
		const host = mount(
			'drawing',
			drawingHomeControls({
				editable: true,
				hasSelection: true,
				fill: {
					value: '#ff0000',
					themeColors: { dk1: '#000000', lt1: '#ffffff', accent1: '#4472c4' },
					recent: ['#123456'],
				},
			}),
		);
		const read = intents(host);
		const slot = control(host, 'home.drawing.shapeFill');
		slot.querySelector('button')!.click();
		expect(slot.querySelector('[data-theme-swatch]')).toBeTruthy();
		expect(slot.querySelector('[data-testid="pptx-color-recent"]')).toBeTruthy();
		slot.querySelector<HTMLElement>('.std-grid button')!.click();
		expect(read()[0]).toMatchObject({ id: 'home.drawing.shapeFill', value: '#ffffff' });
		expect(read()[0].ref).toBeUndefined();
	});
});

describe('shared Arrange strips', () => {
	const controls = arrangeHomeControls({
		editable: true,
		hasSelection: true,
		canDistribute: false,
	});

	it('shares one Align id across edges and distribute axes', () => {
		const host = mount('arrange-align', controls);
		expect(host.querySelectorAll('[data-ribbon-control="home.arrange.align"]')).toHaveLength(1);
		const buttons = [...host.querySelectorAll<HTMLButtonElement>('button')];
		expect(buttons).toHaveLength(8);
		const read = intents(host);
		buttons[1].click();
		buttons[6].click();
		buttons[7].click();
		expect(read()).toStrictEqual([{ id: 'home.arrange.align', part: 'centerH' }]);
		expect(buttons.slice(6).every((button) => button.disabled)).toBeTruthy();
		expect(arrangeAlignAction('centerH')).toStrictEqual({ kind: 'align', edge: 'centerH' });
		expect(arrangeAlignAction('distribute-vertical')).toStrictEqual({
			kind: 'distribute',
			axis: 'vertical',
		});
		expect(arrangeAlignAction('nope')).toBeUndefined();
	});

	it('renders flip, order and edit strips with public ids and text names', () => {
		const flip = mount('arrange-flip', controls);
		const order = mount('arrange-order', controls);
		const edit = mount('arrange-edit', controls);
		expect(control(flip, 'home.arrange.flipHorizontal').textContent).toBe('Flip H');
		expect(control(order, 'home.arrange.sendToBack').getAttribute('aria-label')).toBe('Back');
		expect(control(order, 'home.arrange.sendBackward').querySelector('svg')).toBeTruthy();
		const read = intents(edit);
		control(edit, 'home.arrange.delete').click();
		expect(read()).toStrictEqual([{ id: 'home.arrange.delete' }]);
		expect(control(edit, 'home.arrange.delete').dataset.tone).toBe('danger');
	});

	it('disables every strip without an editable selection', () => {
		const host = mount(
			'arrange-order',
			arrangeHomeControls({ editable: true, hasSelection: false, canDistribute: true }),
		);
		expect([...host.querySelectorAll('button')].every((button) => button.disabled)).toBeTruthy();
		const read = intents(host);
		control(host, 'home.arrange.bringForward').click();
		expect(read()).toHaveLength(0);
	});
});
