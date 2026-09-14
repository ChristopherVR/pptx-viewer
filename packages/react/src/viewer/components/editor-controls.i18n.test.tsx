// @vitest-environment happy-dom
import { createInstance } from 'i18next';
import type { PptxImageElement, PptxSlide } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { describe, expect, it, vi } from 'vitest';

import { translationsDe, translationsEs, translationsFr } from '../../../../locales/src';
import { translationsEn } from '../../i18n';
import { ImageCropSection } from './inspector/ImageCropSection';
import { ImagePropertiesPanel } from './inspector/ImagePropertiesPanel';
import { InspectorPaneHeader } from './inspector/InspectorPaneHeader';
import { SlideBackgroundPanel } from './inspector/SlideBackgroundPanel';
import { ArrangeSection } from './toolbar/ArrangeSection';
import { EditingSection } from './toolbar/EditingSection';

const locales = { de: translationsDe, es: translationsEs, fr: translationsFr };
const picture: PptxImageElement = {
	id: 'picture',
	type: 'image',
	x: 0,
	y: 0,
	width: 100,
	height: 100,
	imageData: 'data:image/png;base64,',
};
const slide: PptxSlide = { id: 'slide', rId: 'rId1', slideNumber: 1, elements: [] };

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

describe('editor controls use the host dictionary', () => {
	for (const [locale, dictionary] of Object.entries(locales)) {
		it(`${locale} translates inspector tabs, background fields, and editing group`, async () => {
			const i18n = await translator(locale, dictionary);
			const html = renderToStaticMarkup(
				<I18nextProvider i18n={i18n}>
					<InspectorPaneHeader activeTab='properties' onSetActiveTab={vi.fn()} onClose={vi.fn()} />
					<SlideBackgroundPanel activeSlide={slide} canEdit onUpdateSlide={vi.fn()} />
					<EditingSection onToggleFindReplace={vi.fn()} />
				</I18nextProvider>,
			);
			const container = document.createElement('div');
			container.innerHTML = html;
			for (const key of [
				'pptx.documentProperties.statistics.elements',
				'pptx.inspector.properties',
				'pptx.toolbar.comments',
			]) {
				const button = [...container.querySelectorAll('button')].find(
					(item) => item.title === dictionary[key],
				);
				expect(button?.textContent).toBe(dictionary[key]);
			}
			for (const key of [
				'pptx.viewer.background',
				'pptx.slideBackground.colour',
				'pptx.slideBackground.image',
				'pptx.ribbon.editing',
			]) {
				expect(container.textContent).toContain(dictionary[key]);
			}
		});

		it(`${locale} translates image crop directions and grayscale`, async () => {
			const i18n = await translator(locale, dictionary);
			const html = renderToStaticMarkup(
				<I18nextProvider i18n={i18n}>
					<ImageCropSection selectedElement={picture} canEdit onUpdateElement={vi.fn()} />
					<ImagePropertiesPanel selectedElement={picture} canEdit onUpdateElement={vi.fn()} />
				</I18nextProvider>,
			);
			const container = document.createElement('div');
			container.innerHTML = html;
			for (const key of [
				'pptx.image.cropLeft',
				'pptx.image.cropTop',
				'pptx.image.cropRight',
				'pptx.image.cropBottom',
				'pptx.image.grayscale',
			]) {
				expect(container.textContent).toContain(dictionary[key]);
			}
		});

		it(`${locale} translates complete alignment actions without changing their values`, async () => {
			const i18n = await translator(locale, dictionary);
			const onAlignElements = vi.fn();
			const container = document.createElement('div');
			const root = createRoot(container);
			try {
				await act(async () =>
					root.render(
						<I18nextProvider i18n={i18n}>
							<ArrangeSection
								canEdit
								selectedElement={picture}
								selectedCount={1}
								selectionGroupable
								onAlignElements={onAlignElements}
								onDistributeElements={vi.fn()}
								canDistribute={false}
								onFlip={vi.fn()}
								onMoveLayer={vi.fn()}
								onMoveLayerToEdge={vi.fn()}
								onGroupElements={vi.fn()}
								onUngroupElement={vi.fn()}
								onUpdateElementStyle={vi.fn()}
								onDuplicate={vi.fn()}
								onDelete={vi.fn()}
							/>
						</I18nextProvider>,
					),
				);
				for (const direction of ['left', 'center', 'right', 'top', 'middle', 'bottom']) {
					const key = `pptx.ribbon.align${direction[0].toUpperCase()}${direction.slice(1)}`;
					const button = [...container.querySelectorAll('button')].find(
						(item) => item.title === dictionary[key],
					);
					expect(button).toBeDefined();
					await act(async () => button!.click());
					expect(onAlignElements).toHaveBeenLastCalledWith(direction);
				}
			} finally {
				act(() => root.unmount());
			}
		});
	}

	it('updates existing inspector labels when the host changes language', async () => {
		const i18n = await translator('de', translationsDe);
		const container = document.createElement('div');
		const root = createRoot(container);
		try {
			await act(async () =>
				root.render(
					<I18nextProvider i18n={i18n}>
						<InspectorPaneHeader
							activeTab='properties'
							onSetActiveTab={vi.fn()}
							onClose={vi.fn()}
						/>
					</I18nextProvider>,
				),
			);
			expect(container.textContent).toContain('Eigenschaften');
			await act(async () => {
				await i18n.changeLanguage('en');
			});
			expect(container.textContent).toContain('Properties');
			expect(container.textContent).not.toContain('Eigenschaften');
		} finally {
			act(() => root.unmount());
		}
	});
});
