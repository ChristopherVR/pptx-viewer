import { describe, expect, it } from 'vitest';
import { createI18n } from 'vue-i18n';

import { translationsZhCN } from '../../locales/src/zh-CN';
import { toVueI18nSyntax, translationsEn } from './i18n';

describe('simplified Chinese messages', () => {
	it('compiles the entire dictionary and interpolates slide counters', () => {
		const { t } = createI18n({
			legacy: false,
			locale: 'zh-CN',
			messages: { 'zh-CN': toVueI18nSyntax(translationsZhCN) },
			missingWarn: false,
			fallbackWarn: false,
		}).global;
		for (const key of Object.keys(translationsZhCN)) {
			expect(() => t(key)).not.toThrow();
		}
		expect(t('pptx.statusBar.slideOf', { current: 2, total: 7 })).toBe('第 2 张，共 7 张');
		expect(t('pptx.comments.mentionPlaceholder')).toBe('输入 @ 提及他人');
	});
});

describe('translationsEn (vue-i18n syntax adapter)', () => {
	it('contains no double-brace interpolation placeholders', () => {
		const offenders = Object.entries(translationsEn).filter(([, value]) => value.includes('{{'));
		expect(offenders).toStrictEqual([]);
	});

	it('converts the shared dictionary double-brace syntax to vue-i18n single-brace syntax', () => {
		expect(translationsEn['pptx.notes.slideN']).toBe('Slide {n}');
		expect(translationsEn['pptx.statusBar.slideOf']).toBe('Slide {current} of {total}');
	});

	it('compiles every message with vue-i18n without throwing (regression: "Not allowed nest placeholder")', () => {
		// vue-i18n compiles a message on first use, not at `createI18n`, so
		// every key has to be rendered for a parse error to surface here.
		const { t } = createI18n({
			legacy: false,
			locale: 'en',
			messages: { en: translationsEn },
			missingWarn: false,
			fallbackWarn: false,
		}).global;
		const failures = Object.keys(translationsEn).filter((key) => {
			try {
				t(key);
				return false;
			} catch {
				return true;
			}
		});
		expect(failures).toStrictEqual([]);
	});

	it('escapes a literal @ so vue-i18n does not read it as a linked message', () => {
		expect(translationsEn['pptx.comments.mentionPlaceholder']).toBe(
			"Type {'@'} to mention someone",
		);
		const { t } = createI18n({
			legacy: false,
			locale: 'en',
			messages: { en: translationsEn },
			missingWarn: false,
			fallbackWarn: false,
		}).global;
		expect(t('pptx.comments.mentionPlaceholder')).toBe('Type @ to mention someone');
	});

	it('resolves a parametrised message to the expected interpolated string', () => {
		const i18n = createI18n({
			legacy: false,
			locale: 'en',
			messages: { en: translationsEn },
			missingWarn: false,
			fallbackWarn: false,
		});
		const { t } = i18n.global;
		expect(t('pptx.notes.slideN', { n: 3 })).toBe('Slide 3');
	});
});
