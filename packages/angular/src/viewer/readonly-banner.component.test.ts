/**
 * readonly-banner.component.test.ts: the Angular adapter around the shared
 * `pptx-ui-read-only-banner`, including the modify-password unlock prompt.
 */
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { translationsEn } from '../../../shared/src/i18n';
import { registerPptxWebControls } from '../../../shared/src/web-components';
import { ReadOnlyBannerComponent } from './readonly-banner.component';

beforeAll(() => {
	TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
	registerPptxWebControls();
});
afterEach(() => TestBed.resetTestingModule());

function open(inputs: Record<string, unknown> = {}) {
	TestBed.resetTestingModule();
	TestBed.configureTestingModule({
		imports: [ReadOnlyBannerComponent],
		providers: [provideTranslateService({ fallbackLang: 'en' })],
	});
	// The Vitest JIT build does not wire signal inputs, so declare them and hand each
	// field a plain signal.
	const values = {
		kind: 'modifyVerifier',
		messageKey: 'pptx.readOnly.modifyVerifierRecommended',
		...inputs,
	};
	TestBed.overrideComponent(ReadOnlyBannerComponent, { add: { inputs: Object.keys(values) } });
	const fixture = TestBed.createComponent(ReadOnlyBannerComponent);
	for (const [name, value] of Object.entries(values)) {
		fixture.componentRef.setInput(name, signal(value));
	}
	const translate = TestBed.inject(TranslateService);
	translate.setTranslation('en', translationsEn);
	translate.use('en');
	fixture.detectChanges();
	const host = (fixture.nativeElement as HTMLElement).querySelector('pptx-ui-read-only-banner')!;
	const root = host.shadowRoot!;
	const part = (testId: string) => root.querySelector<HTMLElement>(`[data-testid="${testId}"]`)!;
	return { fixture, host, part };
}

describe('readOnlyBannerComponent adapter', () => {
	it('maps the recommendation onto the shared banner and keeps its test hooks', () => {
		const { host, part } = open();
		expect(host.getAttribute('data-testid')).toBe('pptx-readonly-banner');
		expect(host.getAttribute('data-kind')).toBe('modifyVerifier');
		expect(part('pptx-readonly-edit-anyway').hidden).toBeFalsy();
		expect(part('pptx-readonly-password-form').hidden).toBeTruthy();
	});

	it('forwards Edit anyway and Dismiss as separate outputs', () => {
		const { fixture, part } = open();
		const seen: string[] = [];
		fixture.componentInstance.editAnyway.subscribe(() => seen.push('editAnyway'));
		fixture.componentInstance.dismiss.subscribe(() => seen.push('dismiss'));
		part('pptx-readonly-edit-anyway').click();
		part('pptx-readonly-dismiss').click();
		expect(seen).toStrictEqual(['editAnyway', 'dismiss']);
	});

	it('swaps the two buttons for the password form and submits the typed password', () => {
		const { fixture, part } = open({ passwordPromptOpen: true });
		expect(part('pptx-readonly-password-form').hidden).toBeFalsy();
		expect(part('pptx-readonly-edit-anyway').hidden).toBeTruthy();
		const passwords: string[] = [];
		const cancelled: string[] = [];
		fixture.componentInstance.submitPassword.subscribe((value) => passwords.push(value));
		fixture.componentInstance.cancelPassword.subscribe(() => cancelled.push('cancel'));
		(part('pptx-readonly-password-input') as HTMLInputElement).value = 'secret';
		part('pptx-readonly-password-form').dispatchEvent(new Event('submit', { cancelable: true }));
		part('pptx-readonly-password-cancel').click();
		expect(passwords).toStrictEqual(['secret']);
		expect(cancelled).toStrictEqual(['cancel']);
	});

	it('marks the input invalid and alerts on a wrong password, disabling while checking', () => {
		const { part } = open({
			passwordPromptOpen: true,
			passwordError: 'wrong-password',
			checkingPassword: true,
		});
		const input = part('pptx-readonly-password-input') as HTMLInputElement;
		expect(input.getAttribute('aria-invalid')).toBe('true');
		expect(input.disabled).toBeTruthy();
		expect(part('pptx-readonly-unlock')).toHaveProperty('disabled', true);
		expect(part('pptx-readonly-password-error').getAttribute('role')).toBe('alert');
		expect(part('pptx-readonly-password-error').hidden).toBeFalsy();
	});
});
