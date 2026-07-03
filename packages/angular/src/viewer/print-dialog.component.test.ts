/**
 * print-dialog.component.test.ts: Unit tests for the pure layout helper that
 * drives the print dialog's responsive (full-width bottom-sheet) branch.
 *
 * No Angular TestBed: the component-rendering path needs
 * `@analogjs/vite-plugin-angular` (a follow-up), so the mobile
 * layout decision is factored into the pure `printDialogClass` helper and tested
 * directly here, matching the rest of the Angular package's convention.
 */
import { describe, expect, it } from 'vitest';

import { printDialogClass } from './print-dialog.component';

describe('printDialogClass', () => {
	it('returns the plain dialog class on desktop (centered 780px card)', () => {
		expect(printDialogClass(false)).toBe('pptx-ng-print-dialog');
	});

	it('adds the is-mobile bottom-sheet modifier on mobile', () => {
		expect(printDialogClass(true)).toBe('pptx-ng-print-dialog is-mobile');
	});

	it('always keeps the base class so shared dialog styles apply', () => {
		expect(printDialogClass(false)).toContain('pptx-ng-print-dialog');
		expect(printDialogClass(true)).toContain('pptx-ng-print-dialog');
	});
});
