/**
 * The selection-handle accessible-name contract (template-source assertion
 * pattern, matching `slide-canvas-show-contract.test.ts`; no TestBed here).
 *
 * All five bindings label their manipulation handles from the shared i18n keys
 * `pptx.selectionOverlay.rotate` / `.resize` / the adjust key; Angular used to
 * hardcode "Resize element from se", which is the drift this pins against.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const template = readFileSync(join(__dirname, 'slide-canvas.component.html'), 'utf8');

describe('slide-canvas handle accessible names', () => {
	it('labels resize handles from the shared key with the handle param', () => {
		expect(template).toContain(
			`[attr.aria-label]="'pptx.selectionOverlay.resize' | translate: { handle: h.handle }"`,
		);
		expect(template).not.toContain('Resize element from');
	});

	it('labels the rotate handle from the shared key', () => {
		expect(template).toContain(`[attr.aria-label]="'pptx.selectionOverlay.rotate' | translate"`);
	});
});
