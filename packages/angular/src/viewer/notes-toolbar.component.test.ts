import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { translationsEn } from '../../../shared/src/i18n';
import { registerPptxWebControls } from '../../../shared/src/web-components';
import { NotesToolbarComponent } from './notes-toolbar.component';

beforeAll(() => {
	TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
	registerPptxWebControls();
});
afterEach(() => TestBed.resetTestingModule());

function open(rich = true) {
	TestBed.resetTestingModule();
	TestBed.configureTestingModule({
		imports: [NotesToolbarComponent],
		providers: [provideTranslateService({ fallbackLang: 'en' })],
	});
	// The Vitest JIT build does not wire signal inputs; hand the field a plain signal.
	TestBed.overrideComponent(NotesToolbarComponent, { add: { inputs: ['isRichEnabled'] } });
	const fixture = TestBed.createComponent(NotesToolbarComponent);
	fixture.componentRef.setInput('isRichEnabled', signal(rich));
	const translate = TestBed.inject(TranslateService);
	translate.setTranslation('en', translationsEn);
	translate.use('en');
	fixture.detectChanges();
	const root = (fixture.nativeElement as HTMLElement).querySelector(
		'pptx-ui-notes-toolbar',
	)!.shadowRoot!;
	const button = (name: string) =>
		root.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`)!;
	return { fixture, root, button };
}

describe('notesToolbarComponent adapter', () => {
	it('renders the shared toolbar with the canonical labels', () => {
		const { root, button } = open();
		expect(root.querySelector('[role="toolbar"]')!.getAttribute('aria-label')).toBe(
			'Notes formatting',
		);
		expect(button('Increase indent')).toBeTruthy();
		expect(button('Decrease indent')).toBeTruthy();
		expect(root.querySelector('.mode')!.textContent).toBe('Plain editor');
	});

	it('disables formatting in the plain editor', () => {
		const { button, root } = open(false);
		expect(button('Bold').disabled).toBeTruthy();
		expect(button('Print notes').disabled).toBeFalsy();
		expect(root.querySelector('.mode')!.textContent).toBe('Rich editor');
	});

	it('maps intents onto the existing outputs', () => {
		const { fixture, button, root } = open();
		const seen: unknown[] = [];
		const c = fixture.componentInstance;
		c.inline.subscribe((v) => seen.push(['inline', v]));
		c.paragraph.subscribe((v) => seen.push(['paragraph', v]));
		c.print.subscribe(() => seen.push(['print']));
		c.toggleRich.subscribe(() => seen.push(['toggleRich']));
		c.insertLink.subscribe((v) => seen.push(['link', v]));
		button('Italic').click();
		button('Bullet list').click();
		button('Print notes').click();
		root.querySelector<HTMLButtonElement>('.mode')!.click();
		button('Insert link').click();
		const form = root.querySelector('form')!;
		form.querySelector<HTMLInputElement>('input[name="url"]')!.value = 'a.test';
		form.dispatchEvent(new Event('submit', { cancelable: true }));
		expect(seen).toStrictEqual([
			['inline', 'italic'],
			['paragraph', 'bullet'],
			['print'],
			['toggleRich'],
			['link', { url: 'https://a.test', displayText: 'https://a.test' }],
		]);
	});
});
