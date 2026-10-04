import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { translationsEn } from '../../../shared/src/i18n';
import { registerPptxWebControls } from '../../../shared/src/web-components';
import { StatusBarComponent } from './status-bar.component';

beforeAll(() => {
	TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
	registerPptxWebControls();
});
afterEach(() => TestBed.resetTestingModule());

function open(inputs: Record<string, unknown> = {}) {
	TestBed.resetTestingModule();
	TestBed.configureTestingModule({
		imports: [StatusBarComponent],
		providers: [provideTranslateService({ fallbackLang: 'en' })],
	});
	// The Vitest JIT build does not wire signal inputs, so declare them and hand each
	// field a plain signal (the same approach as the subtitle settings adapter test).
	const values = { slideCount: 7, ...inputs };
	TestBed.overrideComponent(StatusBarComponent, { add: { inputs: Object.keys(values) } });
	const fixture: ComponentFixture<StatusBarComponent> = TestBed.createComponent(StatusBarComponent);
	for (const [name, value] of Object.entries(values)) {
		fixture.componentRef.setInput(name, signal(value));
	}
	const translate = TestBed.inject(TranslateService);
	translate.setTranslation('en', translationsEn);
	translate.use('en');
	fixture.detectChanges();
	const host = (fixture.nativeElement as HTMLElement).querySelector('pptx-ui-status-bar')!;
	const root = host.shadowRoot!;
	const button = (key: string) =>
		root.querySelector<HTMLButtonElement>(`button[aria-label="${key}"]`)!;
	return { fixture, root, button };
}

describe('statusBarComponent adapter', () => {
	it('maps viewer state onto the shared status bar', () => {
		const { root, button } = open({ slideIndex: 2, zoomPercent: 125, notesOpen: true });
		expect(root.querySelector('[data-item="counter"]')!.textContent).toBe('Slide 3 of 7');
		expect(button('Zoom to fit').textContent).toBe('125%');
		expect(button('Toggle notes').getAttribute('aria-pressed')).toBe('true');
		expect(button('Normal view').getAttribute('aria-pressed')).toBe('true');
	});

	it('reflects the presenting and sorter modes', () => {
		expect(open({ presenting: true }).button('Slide show').getAttribute('aria-pressed')).toBe(
			'true',
		);
		const sorter = open({ sorterActive: true });
		expect(sorter.button('Slide sorter').getAttribute('aria-pressed')).toBe('true');
		expect(sorter.button('Normal view').getAttribute('aria-pressed')).toBe('false');
	});

	it('emits each output once per activation', () => {
		const { fixture, button } = open();
		const seen: string[] = [];
		const c = fixture.componentInstance;
		const outputs = {
			toggleNotes: 'Toggle notes',
			normalView: 'Normal view',
			openSorter: 'Slide sorter',
			slideShow: 'Slide show',
			zoomOut: 'Zoom out',
			zoomReset: 'Zoom to fit',
			zoomIn: 'Zoom in',
		} as const;
		for (const name of Object.keys(outputs) as (keyof typeof outputs)[]) {
			c[name].subscribe(() => seen.push(name));
		}
		for (const key of Object.values(outputs)) {
			button(key).click();
		}
		expect(seen).toStrictEqual(Object.keys(outputs));
	});

	it('hides notes, slide show and zoom through hiddenActions', () => {
		const { button } = open({ hiddenActions: ['notes', 'fullscreen', 'zoom'] });
		expect(button('Toggle notes').hidden).toBeTruthy();
		expect(button('Slide show').hidden).toBeTruthy();
		expect(button('Zoom in').closest('.group')).toHaveProperty('hidden', true);
		expect(button('Normal view').hidden).toBeFalsy();
	});
});
