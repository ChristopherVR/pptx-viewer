import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { translationsZhCN } from '../../../locales/src';
import { translationsEn } from '../../../shared/src/i18n/translations-en';
import { AnimationTimelineComponent } from './animation-timeline.component';

beforeAll(() => {
	TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
});
afterEach(() => {
	TestBed.resetTestingModule();
});

describe('animation timeline localization', () => {
	it('updates the heading and accessible name when the host changes language', () => {
		TestBed.configureTestingModule({
			imports: [AnimationTimelineComponent],
			providers: [provideTranslateService({ fallbackLang: 'en' })],
		});
		// This runner uses JIT without the signal-input transform. Pass a signal
		// through a regular test input so the production template reads it normally.
		TestBed.overrideComponent(AnimationTimelineComponent, {
			add: { inputs: ['animations'] },
		});
		const translate = TestBed.inject(TranslateService);
		translate.setTranslation('en', translationsEn);
		translate.setTranslation('zh-CN', translationsZhCN);
		translate.use('zh-CN');
		const fixture = TestBed.createComponent(AnimationTimelineComponent);
		fixture.componentRef.setInput(
			'animations',
			signal([{ elementId: 'e1', preset: 'fadeIn', order: 0 }]),
		);
		fixture.detectChanges();
		const element = fixture.nativeElement as HTMLElement;
		expect(element.querySelector('h4')?.textContent).toBe(
			translationsZhCN['pptx.animation.timeline'],
		);
		expect(element.querySelector('section')?.getAttribute('aria-label')).toBe(
			translationsZhCN['pptx.animation.timeline'],
		);
		translate.use('en');
		fixture.detectChanges();
		expect(element.querySelector('h4')?.textContent).toBe('Timeline');
		expect(element.querySelector('section')?.getAttribute('aria-label')).toBe('Timeline');
		fixture.destroy();
	});
});
