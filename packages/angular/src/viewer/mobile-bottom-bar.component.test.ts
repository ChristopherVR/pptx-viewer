/**
 * The Angular adapters around the shared `pptx-ui-mobile-bar` and
 * `pptx-ui-mobile-toolbar`.
 *
 * The bottom bar used to hand-roll its own disabled gating; the shared element now
 * sources it from shared's `buildBarActions` (disabled at 0 slides) so Angular,
 * React and Vue cannot drift. These tests drive the real adapters.
 */
import { signal } from '@angular/core';
import type { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { translationsEn } from '../../../shared/src/i18n';
import { registerPptxWebControls } from '../../../shared/src/web-components';
import { MobileBottomBarComponent } from './mobile-bottom-bar.component';
import { MobileToolbarComponent } from './mobile-toolbar.component';

beforeAll(() => {
	TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
	registerPptxWebControls();
});
afterEach(() => TestBed.resetTestingModule());

function open<T>(component: Type<T>, values: Record<string, unknown>) {
	TestBed.resetTestingModule();
	TestBed.configureTestingModule({
		imports: [component],
		providers: [provideTranslateService({ fallbackLang: 'en' })],
	});
	// The Vitest JIT build does not wire signal inputs, so declare them and hand each
	// field a plain signal.
	TestBed.overrideComponent(component, { add: { inputs: Object.keys(values) } });
	const fixture = TestBed.createComponent(component);
	for (const [name, value] of Object.entries(values)) {
		fixture.componentRef.setInput(name, signal(value));
	}
	const translate = TestBed.inject(TranslateService);
	translate.setTranslation('en', translationsEn);
	translate.use('en');
	fixture.detectChanges();
	return fixture;
}

describe('mobileBottomBarComponent adapter', () => {
	const bar = (fixture: { nativeElement: HTMLElement }) =>
		Array.from(
			fixture.nativeElement
				.querySelector('pptx-ui-mobile-bar')!
				.shadowRoot!.querySelectorAll('button'),
		);

	it('disables every slot at zero slides and enables them once slides load', () => {
		expect(
			bar(open(MobileBottomBarComponent, { slideCount: 0 })).every((b) => b.disabled),
		).toBeTruthy();
		expect(
			bar(open(MobileBottomBarComponent, { slideCount: 3 })).every((b) => !b.disabled),
		).toBeTruthy();
	});

	it('names the navigation, reflects the open sheet and caps the comment badge', () => {
		const fixture = open(MobileBottomBarComponent, {
			slideCount: 3,
			activeSheet: 'inspector',
			commentCount: 120,
		});
		const root = fixture.nativeElement.querySelector('pptx-ui-mobile-bar')!.shadowRoot!;
		expect(root.querySelector('nav')!.getAttribute('aria-label')).toBe('Editor actions');
		const buttons = bar(fixture);
		expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toStrictEqual([
			'false',
			'false',
			'true',
			'false',
			'false',
		]);
		expect(buttons[3].querySelector('.badge')!.textContent).toBe('99+');
	});

	it('maps each slot to its output', () => {
		const fixture = open(MobileBottomBarComponent, { slideCount: 3 });
		const seen: string[] = [];
		const c = fixture.componentInstance;
		c.openSlides.subscribe(() => seen.push('slides'));
		c.insert.subscribe(() => seen.push('insert'));
		c.openFormat.subscribe(() => seen.push('format'));
		c.openComments.subscribe(() => seen.push('comments'));
		c.notes.subscribe(() => seen.push('notes'));
		for (const button of bar(fixture)) {
			button.click();
		}
		expect(seen).toStrictEqual(['slides', 'insert', 'format', 'comments', 'notes']);
	});
});

describe('mobileToolbarComponent adapter', () => {
	const control = (fixture: { nativeElement: HTMLElement }, name: string) =>
		fixture.nativeElement
			.querySelector('pptx-ui-mobile-toolbar')!
			.shadowRoot!.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`)!;

	it('gates by edit mode, history, hiddenActions and canPresent', () => {
		const fixture = open(MobileToolbarComponent, {
			canEdit: true,
			canUndo: true,
			canRedo: false,
			canPresent: false,
			hiddenActions: ['share'],
			menuOpen: true,
		});
		expect(control(fixture, 'Undo').disabled).toBeFalsy();
		expect(control(fixture, 'Redo').disabled).toBeTruthy();
		expect(control(fixture, 'Share').hidden).toBeTruthy();
		expect(control(fixture, 'Present').disabled).toBeTruthy();
		expect(control(fixture, 'Menu').getAttribute('aria-expanded')).toBe('true');
		const view = open(MobileToolbarComponent, { canEdit: false });
		expect(control(view, 'Undo').hidden).toBeTruthy();
		expect(control(view, 'Save').hidden).toBeFalsy();
	});

	it('maps each control to its output', () => {
		const fixture = open(MobileToolbarComponent, {
			canEdit: true,
			canUndo: true,
			canRedo: true,
			aiEnabled: true,
		});
		const seen: string[] = [];
		const c = fixture.componentInstance;
		c.toggleMenu.subscribe(() => seen.push('menu'));
		c.undo.subscribe(() => seen.push('undo'));
		c.redo.subscribe(() => seen.push('redo'));
		c.toggleAiPanel.subscribe(() => seen.push('ai'));
		c.save.subscribe(() => seen.push('save'));
		c.present.subscribe(() => seen.push('present'));
		c.share.subscribe(() => seen.push('share'));
		for (const name of [
			'Menu',
			'Undo',
			'Redo',
			'Toggle AI assistant',
			'Save',
			'Present',
			'Share',
		]) {
			control(fixture, name).click();
		}
		expect(seen).toStrictEqual(['menu', 'undo', 'redo', 'ai', 'save', 'present', 'share']);
	});
});
