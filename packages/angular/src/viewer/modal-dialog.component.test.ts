/**
 * modal-dialog.component.test.ts: Unit tests for the pure layout helper that
 * drives the modal shell's responsive (bottom-sheet) branch.
 *
 * No Angular TestBed: the component-rendering path needs
 * `@analogjs/vite-plugin-angular` (a follow-up), so the mobile
 * layout decision is factored into the pure `modalPanelClass` helper and tested
 * directly here, matching the rest of the Angular package's test convention.
 *
 * React / Vue references:
 *   packages/react/src/viewer/components/InspectorPane.tsx
 */
import { describe, expect, it } from 'vitest';

import { modalPanelClass } from './modal-dialog.component';

describe('modalPanelClass', () => {
	it('returns the plain panel class on desktop (centered modal)', () => {
		expect(modalPanelClass(false)).toBe('pptx-ng-modal-panel');
	});

	it('adds the is-mobile bottom-sheet modifier on mobile', () => {
		expect(modalPanelClass(true)).toBe('pptx-ng-modal-panel is-mobile');
	});

	it('always keeps the base class so shared panel styles apply', () => {
		expect(modalPanelClass(false)).toContain('pptx-ng-modal-panel');
		expect(modalPanelClass(true)).toContain('pptx-ng-modal-panel');
	});
});
