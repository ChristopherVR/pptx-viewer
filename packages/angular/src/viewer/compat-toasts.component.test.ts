/**
 * CompatToastsComponent: the Angular adapter around the shared
 * `pptx-ui-compat-toasts`. Two real bugs were caught live in the demo and stay
 * pinned here:
 * - the stack used a Tailwind `fixed bottom-4 right-4` class scoped to the
 *   whole viewport, so it could sit on top of the status bar's "Slide show"
 *   button instead of stopping above it;
 * - "Dismiss all" only rendered once a SECOND toast appeared, so a deck with
 *   exactly one compatibility warning had no way to clear it without
 *   dismissing the single toast itself.
 */
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { translationsEn } from '../../../shared/src/i18n';
import { registerPptxWebControls } from '../../../shared/src/web-components';
import type { CompatibilityWarningToast } from '../internal/shared';
import { compatToastStackStyle } from '../internal/shared';
import { CompatToastsComponent } from './compat-toasts.component';

beforeAll(() => {
	TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
	registerPptxWebControls();
});
afterEach(() => TestBed.resetTestingModule());

function toast(overrides: Partial<CompatibilityWarningToast> = {}): CompatibilityWarningToast {
	return {
		id: 't1',
		code: 'unmodelledMarkup',
		severity: 'warning',
		messageKey: 'pptx.compatibility.unmodelledSlideMarkup',
		...overrides,
	} as CompatibilityWarningToast;
}

function open(toasts: readonly CompatibilityWarningToast[], inputs: Record<string, unknown> = {}) {
	TestBed.resetTestingModule();
	TestBed.configureTestingModule({
		imports: [CompatToastsComponent],
		providers: [provideTranslateService({ fallbackLang: 'en' })],
	});
	const values = { toasts, ...inputs };
	TestBed.overrideComponent(CompatToastsComponent, { add: { inputs: Object.keys(values) } });
	const fixture = TestBed.createComponent(CompatToastsComponent);
	for (const [name, value] of Object.entries(values)) {
		fixture.componentRef.setInput(name, signal(value));
	}
	const translate = TestBed.inject(TranslateService);
	translate.setTranslation('en', translationsEn);
	translate.use('en');
	fixture.detectChanges();
	const host = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
		'pptx-ui-compat-toasts',
	);
	return { fixture, host, root: host?.shadowRoot };
}

describe('compatToastsComponent adapter', () => {
	it('renders nothing when there are no toasts', () => {
		expect(open([]).host).toBeNull();
	});

	it('renders each toast with its code and severity hooks', () => {
		const { host, root } = open([toast(), toast({ id: 't2', code: 'other', severity: 'info' })]);
		expect(host!.getAttribute('data-testid')).toBe('pptx-compat-toasts');
		const items = root!.querySelectorAll('[data-testid="pptx-compat-toast"]');
		expect(items).toHaveLength(2);
		expect(items[0].getAttribute('data-code')).toBe('unmodelledMarkup');
		expect(items[1].getAttribute('data-severity')).toBe('info');
	});

	it('positions the stack via the shared metrics, with both insets applied', () => {
		const { host } = open([toast()], { rightInset: 288, bottomInset: 52 });
		const expected = compatToastStackStyle(288, 52);
		expect(host!.style.position).toBe('absolute');
		expect(host!.style.right).toBe(expected.right);
		expect(host!.style.bottom).toBe(expected.bottom);
		expect(host!.style.pointerEvents).toBe('none');
	});

	it('always offers Dismiss all, even for a single toast, and forwards both dismissals', () => {
		const { fixture, root } = open([toast()]);
		const seen: string[] = [];
		fixture.componentInstance.dismissOne.subscribe((id) => seen.push(`one:${id}`));
		fixture.componentInstance.dismissAll.subscribe(() => seen.push('all'));
		root!.querySelector<HTMLElement>('[data-testid="pptx-compat-toast-dismiss"]')!.click();
		root!.querySelector<HTMLElement>('[data-testid="pptx-compat-toasts-dismiss-all"]')!.click();
		expect(seen).toStrictEqual(['one:t1', 'all']);
	});
});
