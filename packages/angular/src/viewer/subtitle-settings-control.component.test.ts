import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { registerPptxWebControls } from '../../../shared/src/web-components';
import { PresentationSubtitleBarComponent } from './presentation-subtitle-bar.component';
import { SubtitleSettingsControlComponent } from './subtitle-settings-control.component';
import { ViewerOptionsService } from './viewer-options.service';

beforeAll(() => {
	TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
	registerPptxWebControls();
});
afterEach(() => {
	TestBed.resetTestingModule();
	vi.unstubAllGlobals();
});

describe('subtitle settings adapter', () => {
	it('updates the viewer store and gives speech recognition the selected language', () => {
		TestBed.configureTestingModule({
			imports: [SubtitleSettingsControlComponent, PresentationSubtitleBarComponent],
			providers: [ViewerOptionsService, provideTranslateService({ fallbackLang: 'en' })],
		});
		TestBed.overrideComponent(PresentationSubtitleBarComponent, { add: { inputs: ['visible'] } });
		const store = TestBed.inject(ViewerOptionsService).store;
		const fixture = TestBed.createComponent(SubtitleSettingsControlComponent);
		fixture.detectChanges();
		(fixture.nativeElement as HTMLElement)
			.querySelector('pptx-ui-subtitle-settings')!
			.dispatchEvent(
				new CustomEvent('subtitle-settings-change', { detail: { spokenLanguage: 'fr-FR' } }),
			);
		expect(store.getOptions().accessibility.subtitleLanguage).toBe('fr-FR');
		const starts: string[] = [];
		class Recognition extends EventTarget {
			lang = '';
			start() {
				starts.push(this.lang);
			}
			stop() {}
		}
		vi.stubGlobal('SpeechRecognition', Recognition);
		const bar = TestBed.createComponent(PresentationSubtitleBarComponent);
		bar.componentRef.setInput('visible', signal(true));
		bar.detectChanges();
		expect(starts).toContain('fr-FR');
		fixture.destroy();
		bar.destroy();
	});
});
