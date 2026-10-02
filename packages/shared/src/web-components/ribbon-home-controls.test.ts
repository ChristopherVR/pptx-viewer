// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
	arrangeShapeHomeControls,
	canRequestHome,
	editingHomeControls,
	fontHomeControls,
	fontPickerHomeControls,
	homeFamilyKeys,
	homeGalleryControls,
	homeSnapshotTranslator,
	paragraphHomeControls,
	slidesHomeControls,
	drawingHomeControls,
	withHomeGalleries,
} from '../render';
import type { RibbonHomeFamily } from '../render';
import { registerPptxWebControls } from './index';

beforeAll(registerPptxWebControls);
afterEach(() => document.body.replaceChildren());

function mount(tag: RibbonHomeFamily, controls = {}, translate?: (key: string) => string) {
	const host = document.createElement(`pptx-ui-ribbon-home-${tag}`);
	host.state = { controls, translate };
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
const font = {
	enabled: true,
	bold: false,
	italic: false,
	underline: false,
	strikethrough: false,
	shadow: false,
};

describe('home select controls', () => {
	it('renders the family and size fields on pptx-ui-select and emits the picked value', () => {
		const host = mount(
			'font-picker',
			fontPickerHomeControls(
				{ enabled: true, fontFamily: 'Calibri', fontSize: 24, themeFonts: { body: 'Calibri' } },
				(key) => key,
			),
		);
		const family = control(host, 'home.font.fontFamily');
		expect(family.tagName).toBe('PPTX-UI-SELECT');
		expect(family.dataset.fontPicker).toBe('family');
		expect(family.getAttribute('variant')).toBe('ribbon-font');
		expect(family.getAttribute('aria-label')).toBe('Font family');
		// The fields are the first row of the Font group the host draws, so no group of their own.
		expect(host.querySelector('[data-ribbon-group]')).toBeNull();
		const read = intents(host);
		const size = control(host, 'home.font.fontSize') as HTMLElement & { value: string };
		expect(size.value).toBe('24');
		size.value = '36';
		size.dispatchEvent(new Event('change', { bubbles: true }));
		expect(read()).toStrictEqual([{ id: 'home.font.fontSize', value: '36' }]);
	});

	it('keeps icon menus (spacing, line spacing, direction, columns) value-bound', () => {
		const host = mount('paragraph', paragraphHomeControls({ enabled: true, lineSpacing: 1.5 }));
		const spacing = control(host, 'home.paragraph.lineSpacing') as HTMLElement & { value: string };
		expect(spacing.getAttribute('variant')).toBe('ribbon-icon');
		expect(spacing.querySelector('svg[slot="icon"]')).toBeTruthy();
		expect(spacing.value).toBe('1.5');
		const read = intents(host);
		spacing.value = '2';
		spacing.dispatchEvent(new Event('change', { bubbles: true }));
		expect(read()).toStrictEqual([{ id: 'home.paragraph.lineSpacing', value: '2' }]);
	});

	it('does not rewrite the observed attributes of an open select on identical state', () => {
		const controls = paragraphHomeControls({ enabled: true, lineSpacing: 1.5 });
		const host = mount('paragraph', controls);
		const select = control(host, 'home.paragraph.lineSpacing');
		const write = vi.spyOn(select, 'setAttribute');
		host.state = { controls: paragraphHomeControls({ enabled: true, lineSpacing: 1.5 }) };
		expect(write).not.toHaveBeenCalled();
		host.state = { controls: paragraphHomeControls({ enabled: true, lineSpacing: 2 }) };
		expect(write).toHaveBeenCalledWith('value', '2');
	});

	it('rejects values outside the options and disabled selects', () => {
		const state = { controls: paragraphHomeControls({ enabled: true }) };
		const pick = (value: string) =>
			canRequestHome('paragraph', state, { id: 'home.paragraph.columns', value });
		expect(pick('2')).toBeTruthy();
		expect(pick('9')).toBeFalsy();
		expect(
			canRequestHome(
				'paragraph',
				{ controls: paragraphHomeControls({ enabled: false }) },
				{ id: 'home.paragraph.columns', value: '2' },
			),
		).toBeFalsy();
	});
});

describe('home menus, colours and numbers', () => {
	it('opens the Select menu, marks keyboard focus and emits Select All', () => {
		const host = mount('editing', editingHomeControls());
		const read = intents(host);
		const slot = control(host, 'home.editing.select');
		const trigger = slot.querySelector('button')!;
		trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
		expect(trigger.getAttribute('aria-expanded')).toBe('true');
		const row = slot.querySelector<HTMLElement>('[role="menuitem"]')!;
		expect(row.textContent).toBe('Select All');
		row.click();
		expect(read()).toStrictEqual([{ id: 'home.editing.select', value: 'selectAll' }]);
		expect(trigger.getAttribute('aria-expanded')).toBe('false');
	});

	it('closes on Escape and on a press outside', () => {
		const host = mount('editing', editingHomeControls());
		const slot = control(host, 'home.editing.select');
		const trigger = slot.querySelector('button')!;
		trigger.click();
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		expect(trigger.getAttribute('aria-expanded')).toBe('false');
		trigger.click();
		document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
		expect(trigger.getAttribute('aria-expanded')).toBe('false');
	});

	it('shows the font colour bar and emits a theme colour with its reference', () => {
		const host = mount(
			'font',
			fontHomeControls({
				...font,
				fontColor: {
					value: '#336699',
					themeColors: {
						dk1: '#000000',
						lt1: '#ffffff',
						dk2: '#222222',
						lt2: '#eeeeee',
						accent1: '#4472c4',
					},
				},
				highlight: { value: '#ffff00' },
			}),
		);
		const slot = control(host, 'home.font.fontColor');
		expect(slot.querySelector<HTMLElement>('.bar')!.style.backgroundColor).not.toBe('');
		const read = intents(host);
		slot.querySelector('button')!.click();
		slot.querySelector<HTMLElement>('[data-theme-swatch="accent1"]')!.click();
		const [intent] = read();
		expect(intent).toMatchObject({ id: 'home.font.fontColor', value: '#4472c4' });
		expect(intent.ref).toMatchObject({ scheme: 'accent1' });
		const highlight = control(host, 'home.font.highlightColor');
		highlight.querySelector('button')!.click();
		expect(highlight.querySelector('[data-theme-swatch]')).toBeNull();
		expect(highlight.querySelector('.custom')).toBeTruthy();
	});

	it('emits the outline width and the crop menu intents with their hooks', () => {
		const host = mount(
			'arrange-shape',
			arrangeShapeHomeControls({
				editable: true,
				canGroup: true,
				canUngroup: false,
				canMerge: true,
				canCrop: true,
				cropActive: false,
				canStrokeWidth: true,
				strokeWidth: 2,
			}),
		);
		const read = intents(host);
		const width = control(host, 'home.arrange.outlineWidth') as HTMLInputElement;
		expect(width.value).toBe('2');
		width.value = '4.5';
		width.dispatchEvent(new Event('change', { bubbles: true }));
		const crop = control(host, 'home.arrange.crop');
		expect(crop.querySelector('[data-pptx-chrome="crop-main"]')).toBeTruthy();
		crop.querySelector<HTMLElement>('[data-pptx-ribbon-control="crop"]')!.click();
		crop.querySelector<HTMLElement>('[data-pptx-ribbon-control="crop-menu"]')!.click();
		crop.querySelector<HTMLElement>('[data-pptx-crop-aspect="16:9"]')!.click();
		const merge = control(host, 'home.arrange.mergeShapes');
		merge.querySelector('button')!.click();
		merge.querySelector<HTMLElement>('[data-pptx-merge-op="union"]')!.click();
		expect(read()).toStrictEqual([
			{ id: 'home.arrange.outlineWidth', value: 4.5 },
			{ id: 'home.arrange.crop' },
			{ id: 'home.arrange.crop', value: 'aspect:16:9' },
			{ id: 'home.arrange.mergeShapes', value: 'union' },
		]);
		expect(control(host, 'home.arrange.ungroup').hasAttribute('disabled')).toBeTruthy();
	});
});

describe('home galleries', () => {
	it('embeds the library gallery after the Bullets toggle and forwards tile picks', () => {
		const host = mount(
			'paragraph',
			withHomeGalleries(
				paragraphHomeControls({ enabled: true, list: 'bullet' }),
				homeGalleryControls('paragraph', { element: null }, true),
				true,
			),
		);
		const slot = control(host, 'home.paragraph.bullets');
		expect(slot.querySelector('button')!.getAttribute('aria-pressed')).toBe('true');
		const gallery = slot.querySelector('pptx-ui-ribbon-gallery')!;
		expect(gallery.hasAttribute('chevron-only')).toBeTruthy();
		const read = intents(host);
		gallery.dispatchEvent(
			new CustomEvent('gallery-pick', {
				detail: { gallery: 'bullets', itemId: 'none' },
				bubbles: true,
				composed: true,
			}),
		);
		expect(read()).toStrictEqual([{ id: 'home.paragraph.bullets', value: 'none' }]);
	});

	it('makes Quick Styles the whole control with its own customization id', () => {
		const host = mount(
			'drawing',
			withHomeGalleries(
				drawingHomeControls({ editable: true, hasSelection: true }),
				homeGalleryControls('drawing', { element: null }, true),
				true,
			),
		);
		const gallery = control(host, 'home.drawing.quickStyles');
		expect(gallery.tagName).toBe('PPTX-UI-RIBBON-GALLERY');
		expect(control(host, 'home.drawing.shapeEffects')).toBeTruthy();
	});
});

describe('home layout gallery', () => {
	const layouts = {
		layouts: [
			{ path: 'a.xml', name: 'Title' },
			{ path: 'b.xml', name: 'Two Content' },
		],
		current: 'b.xml',
		previews: new Map([
			['a.xml', { path: 'a.xml', name: 'Title', width: 960, height: 540, elements: [] }],
		]),
	};
	const slides = {
		editable: true,
		hasLayouts: true,
		hasSlides: true,
		showTemplates: true,
		newSlideNeedsLayout: true,
		resetNeedsSlide: false,
		layouts: layouts as never,
	};

	it('marks the current tile, draws host artwork and emits the layout path', () => {
		const host = mount('slides', slidesHomeControls(slides));
		const artwork = vi.fn(() => vi.fn());
		host.layoutArtwork = artwork;
		const slot = control(host, 'home.slides.layout');
		slot.querySelector('button')!.click();
		const tiles = slot.querySelectorAll<HTMLElement>('[data-layout-path]');
		expect(tiles).toHaveLength(2);
		expect(tiles[1].getAttribute('aria-current')).toBe('true');
		expect(slot.querySelector('[data-testid="layout-gallery-menu"]')).toBeTruthy();
		expect(artwork).toHaveBeenCalledOnce();
		const read = intents(host);
		tiles[0].click();
		expect(read()).toStrictEqual([{ id: 'home.slides.layout', value: 'a.xml' }]);
	});

	it('keeps the tiles under the pointer when a host re-assigns identical state', () => {
		const host = mount('slides', slidesHomeControls(slides));
		const slot = control(host, 'home.slides.layout');
		slot.querySelector('button')!.click();
		const tile = slot.querySelector('[data-layout-path]');
		host.state = { controls: slidesHomeControls(slides) };
		expect(slot.querySelector('[data-layout-path]')).toBe(tile);
		host.state = {
			controls: slidesHomeControls({
				...slides,
				layouts: { ...layouts, layouts: [{ path: 'c.xml', name: 'Other' }] } as never,
			}),
		};
		expect(slot.querySelector('[data-layout-path]')).not.toBe(tile);
	});

	it('disposes artwork when the gallery closes and lets New Slide choose without a current tile', () => {
		const host = mount('slides', slidesHomeControls(slides));
		const dispose = vi.fn();
		host.layoutArtwork = () => dispose;
		const slot = control(host, 'home.slides.newSlide');
		slot.querySelector<HTMLElement>('[data-pptx-chrome="split-caret"]')!.click();
		expect(slot.querySelector('[aria-current]')).toBeNull();
		const read = intents(host);
		slot.querySelector<HTMLElement>('[data-layout-path="b.xml"]')!.click();
		expect(dispose).toHaveBeenCalledOnce();
		expect(read()).toStrictEqual([{ id: 'home.slides.newSlide', value: 'b.xml' }]);
	});

	it('names the empty gallery from the translator', () => {
		const host = mount(
			'slides',
			slidesHomeControls({ ...slides, layouts: { layouts: [] } }),
			(key) => (key === 'pptx.layoutGallery.empty' ? 'Geen' : key),
		);
		control(host, 'home.slides.layout').querySelector('button')!.click();
		expect(control(host, 'home.slides.layout').querySelector('.empty')?.textContent).toBe('Geen');
	});
});

describe('home runtime locale', () => {
	it('lists every new family key so a reactive host re-translates the extras', () => {
		const keys = [
			...homeFamilyKeys('font'),
			...homeFamilyKeys('paragraph'),
			...homeFamilyKeys('drawing'),
			...homeFamilyKeys('arrange-shape'),
		];
		for (const key of [
			'pptx.text.changeCase',
			'pptx.text.changeCaseUpper',
			'pptx.paragraph.lineSpacing',
			'pptx.ribbon.textDirectionRotate90',
			'pptx.contextMenu.bringForward',
			'pptx.shape.mergeUnion',
			'pptx.colorPicker.themeColors',
			'pptx.image.cropHint',
		]) {
			expect(keys).toContain(key);
		}
	});

	it('re-translates menus, tooltips and popup rows after the host swaps the snapshot', () => {
		let locale = 'en';
		const t = (key: string) => `${locale}:${key}`;
		const host = mount('editing', editingHomeControls(), homeSnapshotTranslator(['editing'], t));
		const slot = control(host, 'home.editing.select');
		slot.querySelector('button')!.click();
		expect(slot.querySelector('[role="menuitem"]')!.textContent).toBe('en:pptx.editing.selectAll');
		locale = 'fr';
		host.state = {
			controls: editingHomeControls(),
			translate: homeSnapshotTranslator(['editing'], t),
		};
		expect(slot.querySelector('[role="menuitem"]')!.textContent).toBe('fr:pptx.editing.selectAll');
		expect(slot.querySelector('button')!.title).toBe('fr:pptx.ribbon.tool.select');
	});
});
