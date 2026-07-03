/**
 * inspector-panel.component.test.ts: Unit tests for the pure layout helper that
 * drives the inspector's responsive (full-width bottom-sheet) branch.
 *
 * No Angular TestBed: the component-rendering path needs
 * `@analogjs/vite-plugin-angular` (a follow-up), so the mobile
 * layout decision is factored into the pure `inspectorRootClass` helper and
 * tested directly here, matching the rest of the Angular package's convention.
 *
 * React reference: packages/react/src/viewer/components/InspectorPane.tsx
 */
import { describe, expect, it } from 'vitest';

import { inspectorRootClass } from './inspector-panel.component';

describe('inspectorRootClass', () => {
	it('returns the plain inspector class on desktop (side panel)', () => {
		expect(inspectorRootClass(false)).toBe('pptx-ng-inspector');
	});

	it('adds the is-mobile bottom-sheet modifier on mobile', () => {
		expect(inspectorRootClass(true)).toBe('pptx-ng-inspector is-mobile');
	});

	it('always keeps the base class so shared inspector styles apply', () => {
		expect(inspectorRootClass(false)).toContain('pptx-ng-inspector');
		expect(inspectorRootClass(true)).toContain('pptx-ng-inspector');
	});
});
