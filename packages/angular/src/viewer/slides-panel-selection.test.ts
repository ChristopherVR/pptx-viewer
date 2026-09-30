import { readFileSync } from 'node:fs';

import { NgStyle } from '@angular/common';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideTranslateService, TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { PptxSlide } from 'pptx-viewer-core';
import { afterEach, beforeAll, expect, test, vi } from 'vitest';

import { translationsEn } from '../../../shared/src/i18n/translations-en';
import { resolveViewerComponentResources } from './component-resources.test-support';
import { EditorStateService } from './editor-state.service';
import { SlidesPanelComponent } from './slides-panel.component';

beforeAll(async () => {
	TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
	await resolveViewerComponentResources();
});
afterEach(() => TestBed.resetTestingModule());

test('moves the active thumbnail hooks and emits navigation once', () => {
	TestBed.configureTestingModule({
		imports: [SlidesPanelComponent],
		providers: [provideTranslateService({ fallbackLang: 'en' }), EditorStateService],
	});
	TestBed.overrideComponent(SlidesPanelComponent, {
		set: {
			templateUrl: '',
			template: readFileSync(`${import.meta.dirname}/slides-panel.component.html`, 'utf8'),
			styleUrl: '',
			styles: [readFileSync(`${import.meta.dirname}/slides-panel.component.css`, 'utf8')],
			imports: [NgStyle, TranslatePipe],
			schemas: [NO_ERRORS_SCHEMA],
		},
	});
	TestBed.inject(TranslateService).setTranslation('en', translationsEn);
	TestBed.inject(TranslateService).use('en');
	TestBed.inject(EditorStateService).setSlides(
		Array.from(
			{ length: 3 },
			(_, i) =>
				({
					id: `s${i}`,
					slideNumber: i + 1,
					elements: [],
				}) as PptxSlide,
		),
	);
	const fixture = TestBed.createComponent(SlidesPanelComponent);
	const current = signal(0);
	// Plain JIT does not discover signal-input metadata. Supply the reactive
	// inputs directly; the real template and component event handlers still run.
	Object.assign(fixture.componentInstance, {
		canvasSize: signal({ width: 960, height: 540 }),
		activeIndex: current,
	});
	fixture.detectChanges();
	const root = fixture.nativeElement as HTMLElement;
	const rows = root.querySelectorAll<HTMLButtonElement>('[data-pptx-chrome="slide-row"]');
	const onselect = vi.fn();
	fixture.componentInstance.select.subscribe(onselect);
	rows[1].click();
	expect(onselect).toHaveBeenCalledExactlyOnceWith(1);
	current.set(1);
	fixture.detectChanges();
	expect(rows[0].hasAttribute('aria-current')).toBeFalsy();
	expect(rows[1].getAttribute('aria-current')).toBe('true');
	expect(rows[1].querySelector('[data-pptx-chrome="slide-number"]')?.textContent?.trim()).toBe('2');
	expect(rows[1].querySelector('[data-pptx-chrome="slide-frame"]')).not.toBeNull();
});
