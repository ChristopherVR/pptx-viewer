/**
 * The shared Home controls translate inside the reactive derivation, so a runtime
 * language change re-labels every migrated control (strips, selects, menus,
 * colour popovers and layout galleries) without remounting.
 */
import { config, mount } from '@vue/test-utils';
import type { VueWrapper } from '@vue/test-utils';
import { registerPptxWebControls } from 'pptx-viewer-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { createI18n } from 'vue-i18n';

import { translationsDe, translationsFr } from '../../../../../locales/src';
import { toVueI18nSyntax, translationsEn } from '../../../i18n';
import DrawingGroup from './DrawingGroup.vue';
import EditingSection from './EditingSection.vue';
import FontPickers from './FontPickers.vue';
import SlidesGroup from './SlidesGroup.vue';
import TextSection from './TextSection.vue';

registerPptxWebControls();
const originalPlugins = config.global.plugins;
afterEach(() => {
	config.global.plugins = originalPlugins;
	document.body.replaceChildren();
});

const shape = { id: 's', type: 'shape', x: 0, y: 0, width: 10, height: 10, text: 'a' } as never;
const noop = () => {};

function setup() {
	const i18n = createI18n({
		legacy: false,
		locale: 'fr',
		fallbackLocale: 'en',
		messages: {
			en: translationsEn,
			fr: toVueI18nSyntax(translationsFr),
			de: toVueI18nSyntax(translationsDe),
		},
	});
	config.global.plugins = [i18n];
	return i18n;
}

const control = (wrapper: VueWrapper, id: string) =>
	wrapper.element.querySelector<HTMLElement>(`[data-ribbon-control="${id}"]`)!;
const title = (wrapper: VueWrapper, id: string) =>
	(control(wrapper, id).querySelector('button') ?? control(wrapper, id)).getAttribute('title');

describe('home controls follow the runtime locale', () => {
	it('re-translates the Font extras, Paragraph selects and popup rows', async () => {
		const i18n = setup();
		const wrapper = mount(TextSection, {
			props: {
				canEdit: true,
				selectedElement: shape,
				onUpdateTextStyle: vi.fn(),
				onTransformTextCase: vi.fn(),
			},
			attachTo: document.body,
		});
		expect(title(wrapper, 'home.font.changeCase')).toBe(translationsFr['pptx.text.changeCase']);
		expect(control(wrapper, 'home.paragraph.lineSpacing').title).toBe(
			translationsFr['pptx.paragraph.lineSpacing'],
		);
		control(wrapper, 'home.font.changeCase').querySelector('button')!.click();
		expect(control(wrapper, 'home.font.changeCase').querySelector('.item')!.textContent).toBe(
			translationsFr['pptx.text.changeCaseSentence'],
		);
		i18n.global.locale.value = 'de';
		await nextTick();
		expect(title(wrapper, 'home.font.changeCase')).toBe(translationsDe['pptx.text.changeCase']);
		expect(control(wrapper, 'home.paragraph.columns').title).toBe(
			translationsDe['pptx.paragraph.columns'],
		);
		expect(control(wrapper, 'home.font.changeCase').querySelector('.item')!.textContent).toBe(
			translationsDe['pptx.text.changeCaseSentence'],
		);
		wrapper.unmount();
	});

	it('re-translates Select, Drawing menus, the font picker and the Slides gallery', async () => {
		const i18n = setup();
		const editing = mount(EditingSection, {
			props: { onToggleFindReplace: noop },
			attachTo: document.body,
		});
		const drawing = mount(DrawingGroup, {
			props: {
				canEdit: true,
				selectedElement: shape,
				newShapeType: 'rect',
				onSetNewShapeType: noop,
				onAddShape: noop,
				onMoveLayer: noop,
				onMoveLayerToEdge: noop,
			},
			attachTo: document.body,
		});
		const slides = mount(SlidesGroup, {
			props: {
				canEdit: true,
				layoutOptions: [],
				onInsertSlideFromLayout: noop,
			},
			attachTo: document.body,
		});
		const home = mount(FontPickers, {
			props: { canEdit: true, selectedElement: shape, onUpdateTextStyle: noop },
			attachTo: document.body,
		});
		const expectLocale = (dictionary: Record<string, string>) => {
			expect(title(editing, 'home.editing.select')).toBe(dictionary['pptx.ribbon.tool.select']);
			expect(title(drawing, 'home.drawing.arrange')).toBe(dictionary['pptx.ribbon.arrange']);
			expect(control(home, 'home.font.fontFamily').getAttribute('aria-label')).toBe(
				dictionary['pptx.ribbon.fontFamily'],
			);
			expect(
				slides.element
					.querySelector('[data-ribbon-group="home.slides"]')!
					.getAttribute('aria-label'),
			).toBe(dictionary['pptx.ribbon.slides']);
		};
		expectLocale(translationsFr);
		control(drawing, 'home.drawing.arrange').querySelector('button')!.click();
		expect(control(drawing, 'home.drawing.arrange').querySelector('.item')!.textContent).toBe(
			translationsFr['pptx.contextMenu.bringForward'],
		);
		i18n.global.locale.value = 'de';
		await nextTick();
		expectLocale(translationsDe);
		expect(control(drawing, 'home.drawing.arrange').querySelector('.item')!.textContent).toBe(
			translationsDe['pptx.contextMenu.bringForward'],
		);
		for (const wrapper of [editing, drawing, slides, home]) {
			wrapper.unmount();
		}
	});
});
