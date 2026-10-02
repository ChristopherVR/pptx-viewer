/**
 * The Home controls that used to be native (font family/size, spacing, case,
 * colours, Bullets/Numbering, line spacing, direction, columns, Select) are now
 * the shared `pptx-ui-ribbon-home-*` elements. These tests mount the Angular
 * adapters and check that state reaches the shared elements, that their typed
 * intents run the binding's own undoable edits, and that a runtime language
 * change re-translates the shared labels.
 */
import { signal } from '@angular/core';
import type { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { translationsEn } from '../../../shared/src/i18n/translations-en';
import { registerPptxWebControls } from '../internal/shared';
import {
	readViewerTestResource,
	resolveViewerComponentResources,
} from './component-resources.test-support';
import { EditorStateService } from './editor-state.service';
import { RibbonEditingSectionComponent } from './ribbon-editing-section.component';
import { RibbonFontControlsComponent } from './ribbon-font-controls.component';
import { RibbonParagraphControlsComponent } from './ribbon-paragraph-controls.component';

beforeAll(async () => {
	registerPptxWebControls();
	TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
	await resolveViewerComponentResources();
});
afterEach(() => {
	TestBed.resetTestingModule();
});

const text = (): PptxElement =>
	({
		type: 'text',
		id: 't1',
		x: 0,
		y: 0,
		width: 200,
		height: 50,
		text: 'Hello',
		textStyle: { lineSpacing: 1.5, fontFamily: 'Arial' },
	}) as unknown as PptxElement;

function mount<T>(component: Type<T>, inputs: Record<string, unknown>, templateFile?: string) {
	TestBed.configureTestingModule({
		imports: [component],
		providers: [provideTranslateService({ fallbackLang: 'en' }), EditorStateService],
	});
	TestBed.overrideComponent(
		component,
		templateFile
			? {
					set: {
						inputs: Object.keys(inputs),
						templateUrl: '',
						template: readViewerTestResource(templateFile),
					},
				}
			: { add: { inputs: Object.keys(inputs) } },
	);
	const translate = TestBed.inject(TranslateService);
	translate.setTranslation('en', translationsEn);
	translate.setTranslation('xx', {
		'pptx.ribbon.tool.select': 'Kies',
		'pptx.text.fontColor': 'Kleur',
	});
	translate.use('en');
	const editor = TestBed.inject(EditorStateService);
	editor.setSlides([{ id: 's1', slideNumber: 1, elements: [text()] } as PptxSlide]);
	const fixture = TestBed.createComponent(component);
	for (const [name, value] of Object.entries(inputs)) {
		fixture.componentRef.setInput(name, signal(value));
	}
	fixture.detectChanges();
	return {
		root: fixture.nativeElement as HTMLElement,
		editor,
		translate,
		detect: () => fixture.detectChanges(),
	};
}

const event = (host: Element, detail: Record<string, unknown>) =>
	host.dispatchEvent(new CustomEvent('home-request', { detail, bubbles: true }));

describe('shared Home adapters', () => {
	it('renders the Select menu and re-translates it on a runtime language change', async () => {
		const { root, translate, detect } = mount(RibbonEditingSectionComponent, {});
		const trigger = root.querySelector<HTMLElement>(
			'[data-ribbon-control="home.editing.select"] button',
		);
		expect(trigger?.title).toBe('Select');
		translate.use('xx');
		await Promise.resolve();
		detect();
		expect(trigger?.title).toBe('Kies');
	});

	it('re-translates the font colour trigger after the language changes', async () => {
		const { root, translate, detect } = mount(
			RibbonFontControlsComponent,
			{ canEdit: true, slideIndex: 0, selectedElement: text() },
			'ribbon-font-controls.component.html',
		);
		const colour = () =>
			root.querySelector<HTMLElement>('[data-ribbon-control="home.font.fontColor"] button');
		expect(colour()?.title).toBe('Font Color');
		translate.use('xx');
		await Promise.resolve();
		detect();
		expect(colour()?.title).toBe('Kleur');
	});

	it('shows the picker fields and runs a colour and a case intent through the editor', () => {
		const { root, editor, detect } = mount(
			RibbonFontControlsComponent,
			{ canEdit: true, slideIndex: 0, selectedElement: text() },
			'ribbon-font-controls.component.html',
		);
		expect(root.querySelector('[data-font-picker="family"]')?.getAttribute('aria-label')).toBe(
			'Font family',
		);
		const strip = root.querySelector('pptx-ui-ribbon-home-font')!;
		event(strip, { id: 'home.font.fontColor', value: '#336699', ref: { scheme: 'accent1' } });
		detect();
		const style = (
			editor.slides()[0].elements[0] as unknown as { textStyle: Record<string, unknown> }
		).textStyle;
		expect(style).toMatchObject({ color: '#336699', colorRef: { scheme: 'accent1' } });
		event(strip, { id: 'home.font.characterSpacing', value: '75' });
		expect(
			(editor.slides()[0].elements[0] as unknown as { textStyle: Record<string, unknown> })
				.textStyle.characterSpacing,
		).toBe(75);
	});

	it('marks the current line spacing', () => {
		const { root } = mount(RibbonParagraphControlsComponent, {
			canEdit: true,
			slideIndex: 0,
			selectedElement: text(),
		});
		const spacing = root.querySelector<HTMLElement & { value: string }>(
			'[data-ribbon-control="home.paragraph.lineSpacing"]',
		);
		expect(spacing?.value).toBe('1.5');
	});

	it.each([
		['home.paragraph.lineSpacing', '2', { lineSpacing: 2 }],
		['home.paragraph.textDirection', 'vertical', { textDirection: 'vertical' }],
		['home.paragraph.columns', '2', { columnCount: 2 }],
	])('applies the %s intent through the editor', (id, value, expected) => {
		const { root, editor } = mount(RibbonParagraphControlsComponent, {
			canEdit: true,
			slideIndex: 0,
			selectedElement: text(),
		});
		event(root.querySelector('pptx-ui-ribbon-home-paragraph')!, { id, value });
		const style = (
			editor.slides()[0].elements[0] as unknown as { textStyle: Record<string, unknown> }
		).textStyle;
		expect(style).toMatchObject(expected);
	});
});
