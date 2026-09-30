import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { translationsEn } from '../../../shared/src/i18n/translations-en';
import { registerPptxWebControls } from '../../../shared/src/web-components';
import { LoadContentService } from './load-content.service';
import { RibbonSlideshowSectionComponent } from './ribbon-slideshow-section.component';

beforeAll(() => {
	TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
	registerPptxWebControls();
});
afterEach(() => TestBed.resetTestingModule());

describe('angular shared ribbon lifecycle', () => {
	it('isolates output subscriptions and deck state across mounts and remounts', () => {
		TestBed.configureTestingModule({
			imports: [RibbonSlideshowSectionComponent],
			providers: [provideTranslateService({ fallbackLang: 'en' })],
		});
		// Each fixture models a viewer-owned loader scope. Signal inputs need JIT metadata.
		TestBed.overrideComponent(RibbonSlideshowSectionComponent, {
			add: { inputs: ['slideCount'], providers: [LoadContentService] },
		});
		TestBed.inject(TranslateService).setTranslation('en', translationsEn);
		TestBed.inject(TranslateService).use('en');
		const mount = (callback: () => void) => {
			const fixture = TestBed.createComponent(RibbonSlideshowSectionComponent);
			fixture.componentRef.setInput('slideCount', signal(1));
			fixture.componentInstance.presentFromBeginning.subscribe(callback);
			fixture.detectChanges();
			const button = () =>
				(fixture.nativeElement as HTMLElement)
					.querySelector('[data-ribbon-control="slideShow.startSlideShow.fromBeginning"]')!
					.shadowRoot!.querySelector('button')!;
			return { fixture, button, loader: fixture.debugElement.injector.get(LoadContentService) };
		};
		const old = vi.fn();
		const next = vi.fn();
		const other = vi.fn();
		const first = mount(old);
		const second = mount(other);
		first.loader.presentationProperties.set({ advanceMode: 'manual' });
		expect(second.loader.presentationProperties().advanceMode).toBeUndefined();
		first.fixture.destroy();
		const remounted = mount(next);
		remounted.button().click();
		expect(old).not.toHaveBeenCalled();
		expect(next).toHaveBeenCalledOnce();
		expect(other).not.toHaveBeenCalled();
		second.button().click();
		expect(other).toHaveBeenCalledOnce();
		second.fixture.destroy();
		remounted.fixture.destroy();
	});
});
