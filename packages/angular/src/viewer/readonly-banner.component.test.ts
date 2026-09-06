/**
 * readonly-banner.component.test.ts: the modify-password unlock prompt inside
 * the read-only recommendation banner. No Angular TestBed (see
 * `vitest.config.ts`), so this is a source-text guard (same technique as
 * `ribbon-color-popover.component.test.ts`).
 */
import { describe, expect, it } from 'vitest';

import { componentSource } from './component-source.test-support';

const source = componentSource(import.meta.dirname, 'readonly-banner.component.ts');

describe('readOnlyBannerComponent password prompt', () => {
	it('replaces the two buttons with the password form when passwordPromptOpen is set', () => {
		expect(source).toContain('@if (passwordPromptOpen()) {');
		expect(source).toContain('data-testid="pptx-readonly-password-form"');
		expect(source).toContain('data-testid="pptx-readonly-password-input"');
		expect(source).toContain('data-testid="pptx-readonly-unlock"');
		expect(source).toContain('data-testid="pptx-readonly-password-cancel"');
		expect(source).toContain('} @else {');
	});

	it('submits the entered password and never immediately unlocks from editAnyway', () => {
		expect(source).toContain('(submit)="onSubmit($event)"');
		expect(source).toContain('this.submitPassword.emit(this.password());');
		expect(source).toContain('readonly submitPassword = output<string>();');
	});

	it('marks the input aria-invalid and renders the alert only when passwordError is set', () => {
		expect(source).toContain('[attr.aria-invalid]="passwordError() !== null"');
		expect(source).toContain('@if (passwordError() !== null) {');
		expect(source).toContain('role="alert"');
		expect(source).toContain('data-testid="pptx-readonly-password-error"');
	});

	it('disables the input and unlock button while checkingPassword is true', () => {
		expect(source).toContain('[disabled]="checkingPassword()"');
	});

	it('forwards Cancel as a distinct output from Dismiss', () => {
		expect(source).toContain('(click)="cancelPassword.emit()"');
		expect(source).toContain('readonly cancelPassword = output<void>();');
		expect(source).toContain('(click)="dismiss.emit()"');
	});
});
