/**
 * CompatToastsComponent: stack positioning + "Dismiss all" gating.
 *
 * No Angular TestBed (see `chart-display-options.component.test.ts`): the
 * component is instantiated directly for the style-object assertion, and the
 * template is read off the source file (same technique as
 * `custom-shows-deck.test.ts`'s slide-size-preset regression test) for the
 * wiring the DOM can't be rendered here to prove. Two real bugs, caught live
 * in the demo:
 * - the stack used a Tailwind `fixed bottom-4 right-4` class scoped to the
 *   whole viewport, so it could sit on top of the status bar's "Slide show"
 *   button instead of stopping above it.
 * - "Dismiss all" only rendered once a SECOND toast appeared, so a deck with
 *   exactly one compatibility warning had no way to clear it without
 *   dismissing the single toast itself.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { Injector, runInInjectionContext, signal } from '@angular/core';
import type { InputSignal } from '@angular/core';
import { describe, expect, it } from 'vitest';

import type { CompatibilityWarningToast } from '../internal/shared';
import { compatToastStackStyleAttr } from '../internal/shared';
import { CompatToastsComponent } from './compat-toasts.component';

function toast(overrides: Partial<CompatibilityWarningToast> = {}): CompatibilityWarningToast {
	return {
		id: 't1',
		code: 'unmodelledMarkup',
		severity: 'warning',
		messageKey: 'pptx.compatibility.unmodelledMarkup',
		...overrides,
	} as CompatibilityWarningToast;
}

function createComponent(toasts: readonly CompatibilityWarningToast[]): CompatToastsComponent {
	const component = runInInjectionContext(
		Injector.create({ providers: [] }),
		() => new CompatToastsComponent(),
	);
	Object.assign(component, {
		toasts: signal(toasts) as unknown as InputSignal<readonly CompatibilityWarningToast[]>,
	});
	return component;
}

describe('compatToastsComponent stack style', () => {
	it('positions the stack via the shared metrics, not a viewport-fixed class', () => {
		const component = createComponent([toast()]);
		expect(component.stackStyle).toBe(compatToastStackStyleAttr());
		expect(component.stackStyle).toContain('position:absolute');
		expect(component.stackStyle).toContain('pointer-events:none');
	});
});

describe('compatToastsComponent template wiring (source-level)', () => {
	const source = readFileSync(path.join(__dirname, 'compat-toasts.component.ts'), 'utf8');

	it('never gates "Dismiss all" on more than one toast', () => {
		expect(source).not.toContain('toasts().length > 1');
	});

	it('binds the stack container to the shared style, not a fixed/bottom/right class', () => {
		expect(source).toContain('[style]="stackStyle"');
		expect(source).not.toMatch(/class="[^"]*\bfixed\b[^"]*\bbottom-/u);
	});

	it('marks each toast pointer-events:auto so the pointer-events:none stack still lets clicks through', () => {
		const start = source.indexOf('pptx-ng-compat-toast ');
		const toastTag = source.slice(start, source.indexOf('>', start));
		expect(toastTag).toContain('pointer-events:auto');
	});
});
