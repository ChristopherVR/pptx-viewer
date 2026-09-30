/**
 * Picture Format > Adjust: `<pptx-ribbon-gallery>` for the Corrections, Color
 * and Artistic Effects dropdowns over a real picture, through the REAL shared
 * galleries and the editor's undoable update path. Also checks the contextual
 * Picture Format tab mounts the Adjust group.
 */
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import type { PptxElement, PptxImageEffects, PptxSlide } from 'pptx-viewer-core';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { translationsEn } from '../../../shared/src/i18n/translations-en';
import { resolveViewerComponentResources } from './component-resources.test-support';
import { EditorStateService } from './editor-state.service';
import { RibbonContextualSectionComponent } from './ribbon-contextual-section.component';
import { RibbonGalleryComponent } from './ribbon-gallery.component';

beforeAll(async () => {
	TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
	await resolveViewerComponentResources();
});
afterEach(() => {
	TestBed.resetTestingModule();
});

function picture(): PptxElement {
	return {
		id: 'p1',
		type: 'picture',
		x: 0,
		y: 0,
		width: 100,
		height: 60,
		shapeStyle: {},
	} as unknown as PptxElement;
}

const CONTROLS = {
	pictureCorrections: 'pictureFormat.adjust.corrections',
	pictureColor: 'pictureFormat.adjust.color',
	pictureArtisticEffects: 'pictureFormat.adjust.artisticEffects',
} as const;

function setup() {
	TestBed.configureTestingModule({
		imports: [RibbonGalleryComponent, RibbonContextualSectionComponent],
		providers: [provideTranslateService({ fallbackLang: 'en' }), EditorStateService],
	});
	TestBed.inject(TranslateService).setTranslation('en', translationsEn);
	TestBed.inject(TranslateService).use('en');
	const editor = TestBed.inject(EditorStateService);
	editor.setSlides([{ id: 's1', slideNumber: 1, elements: [picture()] } as PptxSlide]);
	return editor;
}

function effectsOf(editor: EditorStateService): PptxImageEffects | undefined {
	return (editor.slides()[0].elements[0] as { imageEffects?: PptxImageEffects }).imageEffects;
}

describe('picture adjust galleries', () => {
	it.each([
		['pictureCorrections', 'soften50', 'sharpenSoften', { amount: -50000 }],
		['pictureColor', 'saturation200', 'colorSaturation', { sat: 200000 }],
		['pictureColor', 'recolorGrayscale', 'grayscale', true],
		['pictureArtisticEffects', 'paintStrokes', 'artisticEffect', 'paintStrokes'],
	] as const)(
		'%s pick %s updates imageEffects.%s and marks the tile',
		(gallery, item, key, value) => {
			const editor = setup();
			const fixture = TestBed.createComponent(RibbonGalleryComponent);
			const set = (name: string, v: unknown): void => fixture.componentRef.setInput(name, v);
			set('gallery', gallery);
			set('mode', 'dropdown');
			set('control', CONTROLS[gallery]);
			set('element', editor.slides()[0].elements[0]);
			set('slideIndex', 0);
			set('canEdit', true);
			fixture.detectChanges();
			const root = fixture.nativeElement as HTMLElement;
			const trigger = root.querySelector<HTMLButtonElement>(`[data-ribbon-gallery="${gallery}"]`);
			expect(trigger?.disabled).toBeFalsy();
			trigger?.click();
			fixture.detectChanges();
			const popup = root.querySelector(`[data-ribbon-gallery-popup="${gallery}"]`);
			expect(popup?.querySelector('svg')).not.toBeNull();
			popup?.querySelector<HTMLButtonElement>(`[data-gallery-item="${item}"]`)?.click();
			fixture.detectChanges();
			expect(effectsOf(editor)?.[key as keyof PptxImageEffects]).toStrictEqual(value);
			expect(editor.canUndo()).toBeTruthy();
			set('element', editor.slides()[0].elements[0]);
			fixture.detectChanges();
			root.querySelector<HTMLButtonElement>(`[data-ribbon-gallery="${gallery}"]`)?.click();
			fixture.detectChanges();
			const applied = root.querySelector(`[data-gallery-item="${item}"]`);
			expect(applied?.getAttribute('aria-pressed')).toBe('true');
		},
	);

	it('mounts the Adjust group on the Picture Format tab', () => {
		TestBed.configureTestingModule({
			imports: [RibbonContextualSectionComponent],
			providers: [provideTranslateService({ fallbackLang: 'en' }), EditorStateService],
		});
		const inputs = {
			tab: 'pictureFormat',
			selectedElement: picture(),
			slideIndex: 0,
			canEdit: true,
		};
		TestBed.overrideComponent(RibbonContextualSectionComponent, {
			add: { inputs: Object.keys(inputs) },
		});
		TestBed.inject(TranslateService).setTranslation('en', translationsEn);
		TestBed.inject(TranslateService).use('en');
		const fixture = TestBed.createComponent(RibbonContextualSectionComponent);
		for (const [name, value] of Object.entries(inputs)) {
			fixture.componentRef.setInput(name, signal(value));
		}
		fixture.detectChanges();
		const root = fixture.nativeElement as HTMLElement;
		expect(root.querySelector('[data-ribbon-group="pictureFormat.adjust"]')).not.toBeNull();
		for (const control of Object.values(CONTROLS)) {
			expect(root.querySelector(`[data-ribbon-control="${control}"]`)).not.toBeNull();
		}
	});
});
