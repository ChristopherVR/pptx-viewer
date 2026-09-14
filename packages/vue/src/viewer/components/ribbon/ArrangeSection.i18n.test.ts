import { config, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { createI18n } from 'vue-i18n';

import { translationsDe, translationsEs, translationsFr } from '../../../../../locales/src';
import { toVueI18nSyntax, translationsEn } from '../../../i18n';
import ArrangeSection from './ArrangeSection.vue';

const originalPlugins = config.global.plugins;
afterEach(() => {
	config.global.plugins = originalPlugins;
});

describe('arrange action translations', () => {
	for (const [locale, dictionary] of Object.entries({
		de: translationsDe,
		es: translationsEs,
		fr: translationsFr,
	})) {
		it(`${locale} translates directions while preserving alignment operations`, async () => {
			const i18n = createI18n({
				legacy: false,
				locale,
				fallbackLocale: 'en',
				messages: {
					en: translationsEn,
					[locale]: toVueI18nSyntax(dictionary),
				},
			});
			config.global.plugins = [i18n];
			const onAlignElements = vi.fn();
			const wrapper = mount(ArrangeSection, {
				props: {
					canEdit: true,
					selectedElement: {
						id: 'shape',
						type: 'shape',
						shapeType: 'rect',
						x: 0,
						y: 0,
						width: 100,
						height: 100,
					},
					selectedCount: 1,
					selectionGroupable: true,
					onAlignElements,
					onDistributeElements: vi.fn(),
					canDistribute: false,
					onFlip: vi.fn(),
					onMoveLayer: vi.fn(),
					onMoveLayerToEdge: vi.fn(),
					onGroupElements: vi.fn(),
					onUngroupElement: vi.fn(),
					onUpdateElementStyle: vi.fn(),
					onDuplicate: vi.fn(),
					onDelete: vi.fn(),
				},
			});
			try {
				for (const direction of ['left', 'center', 'right', 'top', 'middle', 'bottom']) {
					const key = `pptx.ribbon.align${direction[0].toUpperCase()}${direction.slice(1)}`;
					const button = wrapper
						.findAll('button')
						.find((item) => item.attributes('title') === dictionary[key]);
					expect(button).toBeDefined();
					await button!.trigger('click');
					expect(onAlignElements).toHaveBeenLastCalledWith(direction);
				}
				i18n.global.locale.value = 'en';
				await nextTick();
				expect(
					wrapper.findAll('button').some((item) => item.attributes('title') === 'Align left'),
				).toBeTruthy();
			} finally {
				wrapper.unmount();
			}
		});
	}
});
