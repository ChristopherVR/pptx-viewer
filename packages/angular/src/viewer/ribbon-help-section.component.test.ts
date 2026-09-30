import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { translationsEn } from '../../../shared/src/i18n/translations-en';
import { registerPptxWebControls } from '../../../shared/src/web-components';
import { RibbonHelpSectionComponent } from './ribbon-help-section.component';
import { ViewerCustomizationService } from './viewer-customization.service';

beforeAll(() => {
	TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
	registerPptxWebControls();
});
afterEach(() => TestBed.resetTestingModule());

describe('help shared command adapter', () => {
	it('renders the shared catalog and forwards every command once', () => {
		TestBed.configureTestingModule({
			imports: [RibbonHelpSectionComponent],
			providers: [provideTranslateService({ fallbackLang: 'en' })],
		});
		TestBed.inject(TranslateService).setTranslation('en', translationsEn);
		TestBed.inject(TranslateService).use('en');
		const fixture = TestBed.createComponent(RibbonHelpSectionComponent);
		const settings = vi.fn();
		const shortcuts = vi.fn();
		const accessibility = vi.fn();
		fixture.componentInstance.openSettings.subscribe(settings);
		fixture.componentInstance.openShortcuts.subscribe(shortcuts);
		fixture.componentInstance.a11y.subscribe(accessibility);
		fixture.detectChanges();
		const commands = [
			...(fixture.nativeElement as HTMLElement).querySelectorAll('pptx-ui-ribbon-command'),
		];
		expect(commands.map((command) => command.getAttribute('label'))).toStrictEqual([
			'Settings',
			'Keyboard Shortcuts',
			'Accessibility Check',
		]);
		for (const command of commands) {
			command.shadowRoot!.querySelector('button')!.click();
		}
		expect(settings).toHaveBeenCalledOnce();
		expect(shortcuts).toHaveBeenCalledOnce();
		expect(accessibility).toHaveBeenCalledOnce();
		fixture.destroy();
	});

	it('reacts to the host removing and restoring Options', () => {
		TestBed.configureTestingModule({
			imports: [RibbonHelpSectionComponent],
			providers: [provideTranslateService({ fallbackLang: 'en' }), ViewerCustomizationService],
		});
		const customization = TestBed.inject(ViewerCustomizationService);
		customization.api.setCustomization({ hiddenDialogs: ['options'] });
		const fixture = TestBed.createComponent(RibbonHelpSectionComponent);
		fixture.detectChanges();
		expect(
			(fixture.nativeElement as HTMLElement).querySelectorAll('pptx-ui-ribbon-command'),
		).toHaveLength(2);
		customization.api.setCustomization({});
		fixture.detectChanges();
		expect(
			(fixture.nativeElement as HTMLElement).querySelectorAll('pptx-ui-ribbon-command'),
		).toHaveLength(3);
		fixture.destroy();
	});
});
