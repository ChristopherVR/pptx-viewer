// @vitest-environment happy-dom
import { createInstance } from 'i18next';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { describe, expect, it, vi } from 'vitest';

import {
	translationsDe,
	translationsEs,
	translationsFr,
	translationsZhCN,
} from '../../../../locales/src';
import { translationsEn } from '../../i18n';
import { RecentColorsProvider } from './inspector/RecentColorsContext';
import { TextEffectsPanel } from './inspector/TextEffectsPanel';
import {
	AdvancedTextFormatting,
	createNumericChangeHandler,
} from './inspector/TextPropertiesHelpers';
import { MobileDismissSheet } from './mobile/MobileDismissSheet';
import { SlideNotesPanel } from './SlideNotesPanel';
import { CustomShowsControls } from './toolbar/CustomShowsControls';
import { RecordSection } from './toolbar/RecordSection';
import { TextSection } from './toolbar/TextSection';

async function translator(locale: string, dictionary: Record<string, string>) {
	const instance = createInstance();
	await instance.use(initReactI18next).init({
		lng: locale,
		fallbackLng: 'en',
		resources: { en: { translation: translationsEn }, [locale]: { translation: dictionary } },
		interpolation: { escapeValue: false },
	});
	return instance;
}

const recordKeys = [
	'pptx.record.cameo',
	'pptx.slideShow.fromBeginning',
	'pptx.slideShow.fromCurrent',
	'pptx.record.clear',
	'pptx.record.resetToCameo',
	'pptx.record.learnMore',
];

describe('editor chrome localization', () => {
	for (const [locale, dictionary] of Object.entries({
		de: translationsDe,
		es: translationsEs,
		fr: translationsFr,
		'zh-CN': translationsZhCN,
	})) {
		it(`${locale} translates record commands and updates them when the language changes`, async () => {
			const i18n = await translator(locale, dictionary);
			const onRecordFromBeginning = vi.fn();
			const onRecordFromCurrent = vi.fn();
			const container = document.createElement('div');
			const root = createRoot(container);
			try {
				await act(async () =>
					root.render(
						<I18nextProvider i18n={i18n}>
							<RecordSection
								onRecordFromBeginning={onRecordFromBeginning}
								onRecordFromCurrent={onRecordFromCurrent}
							/>
						</I18nextProvider>,
					),
				);
				const buttons = [...container.querySelectorAll('button')];
				expect(buttons.map((button) => button.textContent?.trim())).toStrictEqual(
					recordKeys.map((key) => dictionary[key]),
				);
				for (const key of [
					'pptx.record.camera',
					'pptx.record.manage',
					'pptx.ribbon.tab.record',
					'pptx.ribbon.tab.help',
				]) {
					expect(container.textContent).toContain(dictionary[key]);
				}
				expect(buttons.map((button) => button.disabled)).toStrictEqual([
					true,
					false,
					false,
					true,
					true,
					true,
				]);
				await act(async () => {
					buttons[1].click();
					buttons[2].click();
				});
				expect(onRecordFromBeginning).toHaveBeenCalledOnce();
				expect(onRecordFromCurrent).toHaveBeenCalledOnce();
				await act(async () => {
					await i18n.changeLanguage('en');
				});
				expect(buttons.map((button) => button.textContent?.trim())).toStrictEqual(
					recordKeys.map((key) => translationsEn[key]),
				);
			} finally {
				act(() => root.unmount());
			}
		});

		it(`${locale} translates home group captions, notes, custom shows, and text effects`, async () => {
			const i18n = await translator(locale, dictionary);
			const update = vi.fn();
			const numChange = createNumericChangeHandler(update);
			const container = document.createElement('div');
			container.innerHTML = renderToStaticMarkup(
				<I18nextProvider i18n={i18n}>
					<RecentColorsProvider value={{ recentColors: [], pushColor: vi.fn() }}>
						<TextSection
							canEdit
							selectedElement={null}
							onUpdateTextStyle={update}
							onToggleBullets={vi.fn()}
							onTransformTextCase={vi.fn()}
						/>
						<SlideNotesPanel
							activeSlide={{
								id: 's1',
								rId: 'rId1',
								slideNumber: 1,
								elements: [],
								notes: 'Speaker notes',
							}}
							isExpanded={false}
							canEdit
							onToggle={vi.fn()}
							onUpdateNotes={vi.fn()}
						/>
						<CustomShowsControls
							customShows={[]}
							activeCustomShowId={null}
							canEdit
							isCurrentSlideInActiveShow={false}
							onSetActiveCustomShowId={vi.fn()}
							onCreateCustomShow={vi.fn()}
							onRenameActiveCustomShow={vi.fn()}
							onDeleteActiveCustomShow={vi.fn()}
							onToggleCurrentSlideInActiveShow={vi.fn()}
						/>
						<AdvancedTextFormatting
							ts={{}}
							canEdit
							onUpdateTextStyle={update}
							numChange={numChange}
						/>
						<TextEffectsPanel
							ts={{ textShadowColor: '#000000', textGlowColor: '#ffffff', textReflection: true }}
							onUpdateTextStyle={update}
							numChange={numChange}
						/>
						<MobileDismissSheet onClose={vi.fn()}>
							<span />
						</MobileDismissSheet>
					</RecentColorsProvider>
				</I18nextProvider>,
			);
			for (const key of [
				'pptx.ribbon.font',
				'pptx.ribbon.paragraph',
				'pptx.notes.title',
				'pptx.notes.hasNotes',
				'pptx.customShows.addShow',
				'pptx.text.highlightColor',
				'pptx.textProperties.autoFitToShape',
				'pptx.textEffects.color',
				'pptx.textEffects.opacity',
				'pptx.textEffects.blur',
				'pptx.textEffects.size',
				'pptx.textEffects.offset',
			]) {
				expect(container.textContent).toContain(dictionary[key]);
			}
			expect(
				[...container.querySelectorAll('button')].some(
					(button) => button.getAttribute('aria-label') === dictionary['pptx.mobileSheet.close'],
				),
			).toBeTruthy();
		});
	}
});
