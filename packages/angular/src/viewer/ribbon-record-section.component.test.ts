import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { afterEach, beforeAll, expect, test, vi } from 'vitest';

import { registerPptxWebControls } from '../../../shared/src/web-components';
import { RibbonRecordSectionComponent } from './ribbon-record-section.component';

beforeAll(() => {
	TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
	registerPptxWebControls();
});
afterEach(() => TestBed.resetTestingModule());

test('routes both native Record commands and keeps unsupported controls disabled', () => {
	TestBed.configureTestingModule({
		imports: [RibbonRecordSectionComponent],
		providers: [provideTranslateService({ fallbackLang: 'en' })],
	});
	const fixture = TestBed.createComponent(RibbonRecordSectionComponent);
	const beginning = vi.fn();
	const current = vi.fn();
	fixture.componentInstance.recordFromBeginning.subscribe(beginning);
	fixture.componentInstance.recordFromCurrent.subscribe(current);
	fixture.detectChanges();
	const target = fixture.nativeElement as HTMLElement;
	expect(target.querySelectorAll('pptx-ui-ribbon-group')).toHaveLength(4);
	expect(target.querySelectorAll('pptx-ui-ribbon-command[disabled]')).toHaveLength(4);
	for (const id of ['record.record.fromBeginning', 'record.record.fromCurrent']) {
		target
			.querySelector(`[data-ribbon-control="${id}"]`)!
			.shadowRoot!.querySelector<HTMLButtonElement>('button')!
			.click();
	}
	expect(beginning).toHaveBeenCalledOnce();
	expect(current).toHaveBeenCalledOnce();
	fixture.destroy();
});
