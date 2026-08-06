/**
 * The selection-handle accessible-name contract.
 *
 * All five bindings label their manipulation handles from these shared keys
 * (React ResizeHandles.tsx, Vue/Svelte SelectionOverlay, Vanilla
 * selection-overlay.ts, Angular slide-canvas.component.html), so the names can
 * never drift apart again. The retired per-binding variants ("Rotate",
 * "Resize element from se") must not resurface.
 */
import { describe, expect, it } from 'vitest';

import { translationsEn } from './translations-en';

describe('selection-handle accessible names (shared contract)', () => {
	it('defines the unified rotate/resize/adjust labels', () => {
		expect(translationsEn['pptx.selectionOverlay.rotate']).toBe('Rotate element');
		expect(translationsEn['pptx.selectionOverlay.resize']).toBe('Resize {{handle}}');
		expect(translationsEn['pptx.selectionOverlay.adjust']).toBe('Adjust shape');
	});

	it('has retired the divergent per-binding rotate label', () => {
		expect('pptx.resizeHandles.rotateAria' in translationsEn).toBeFalsy();
	});
});
