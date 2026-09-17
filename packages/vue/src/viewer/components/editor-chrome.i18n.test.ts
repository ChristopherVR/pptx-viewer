import { config, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { createI18n } from 'vue-i18n';

import {
	translationsDe,
	translationsEs,
	translationsFr,
	translationsZhCN,
} from '../../../../locales/src';
import { toVueI18nSyntax, translationsEn } from '../../i18n';
import AnimationEditorControls from './inspector/AnimationEditorControls.vue';
import AnimationTimeline from './inspector/AnimationTimeline.vue';
import RecordSection from './ribbon/RecordSection.vue';

const originalPlugins = config.global.plugins;
afterEach(() => {
	config.global.plugins = originalPlugins;
});

describe('editor chrome localization', () => {
	for (const [locale, dictionary] of Object.entries({
		de: translationsDe,
		es: translationsEs,
		fr: translationsFr,
		'zh-CN': translationsZhCN,
	})) {
		const translator = () => {
			const i18n = createI18n({
				legacy: false,
				locale,
				fallbackLocale: 'en',
				messages: { en: translationsEn, [locale]: toVueI18nSyntax(dictionary) },
			});
			config.global.plugins = [i18n];
			return i18n;
		};
		it(`${locale} translates all recording commands and reacts to language changes`, async () => {
			const i18n = translator();
			const wrapper = mount(RecordSection, {
				props: { onRecordFromBeginning: vi.fn(), onRecordFromCurrent: vi.fn() },
			});
			const keys = [
				'pptx.record.cameo',
				'pptx.slideShow.fromBeginning',
				'pptx.slideShow.fromCurrent',
				'pptx.record.clear',
				'pptx.record.resetToCameo',
				'pptx.record.learnMore',
			];
			try {
				expect(wrapper.findAll('button').map((button) => button.text())).toStrictEqual(
					keys.map((key) => dictionary[key]),
				);
				i18n.global.locale.value = 'en';
				await nextTick();
				expect(wrapper.findAll('button').map((button) => button.text())).toStrictEqual(
					keys.map((key) => translationsEn[key]),
				);
			} finally {
				wrapper.unmount();
			}
		});
		it(`${locale} translates animation field names without changing edited values`, async () => {
			translator();
			const wrapper = mount(AnimationEditorControls, {
				props: {
					animation: { elementId: 'e1', order: 0, trigger: 'onShapeClick', preset: 'fadeIn' },
					elements: [],
				},
			});
			try {
				for (const suffix of [
					'duration',
					'delay',
					'direction',
					'sequence',
					'trigger',
					'trigger.shapeLabel',
					'timingCurve',
					'repeatCount',
					'repeatUntil',
				]) {
					expect(wrapper.text()).toContain(dictionary[`pptx.animation.${suffix}`]);
				}
				const direction = wrapper.get(
					`select[aria-label="${dictionary['pptx.animation.direction']}"]`,
				);
				await direction.setValue('fromBottomRight');
				expect(wrapper.emitted('patch')?.at(-1)).toStrictEqual([{ direction: 'fromBottomRight' }]);
				const repeat = wrapper.get(
					`select[aria-label="${dictionary['pptx.animation.repeatUntil']}"]`,
				);
				expect(repeat.findAll('option').map((option) => option.text())).toStrictEqual(
					['none', 'untilNextClick', 'untilEndOfSlide'].map(
						(value) => dictionary[`pptx.animation.repeatUntil.${value}`],
					),
				);
				await repeat.setValue('untilNextClick');
				expect(wrapper.emitted('patch')?.at(-1)).toStrictEqual([{ repeatMode: 'untilNextClick' }]);
			} finally {
				wrapper.unmount();
			}
		});
		it(`${locale} translates the timeline heading and accessible name`, () => {
			translator();
			const wrapper = mount(AnimationTimeline, {
				props: { animations: [{ elementId: 'e1', order: 0, preset: 'fadeIn' }], elements: [] },
			});
			try {
				expect(wrapper.get('h4').text()).toBe(dictionary['pptx.animation.timeline']);
				expect(wrapper.get('section').attributes('aria-label')).toBe(
					dictionary['pptx.animation.timeline'],
				);
			} finally {
				wrapper.unmount();
			}
		});
	}
});
