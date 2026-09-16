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
	it.each([
		'pptx-ng-selection',
		'pptx-ng-handle',
		'pptx-ng-marquee',
		'pptx-ng-snap-guide',
		'pptx-ng-rotate-handle',
		'pptx-ng-adjust-handle',
		'pptx-ng-connection-site',
		'pptx-ng-connector-endpoint',
		'pptx-ng-overlay-grid',
		'pptx-ng-overlay-guides',
		'pptx-ng-ruler-guide-line',
		'pptx-ng-ruler-guide-handle',
		'pptx-ng-ink-preview',
	])('marks %s as editor-only for live-stage export', (className) => {
		const node = template.match(new RegExp(`<[^>]*class="${className}"[^>]*>`))?.[0];
		expect(node).toContain('data-export-ignore="true"');
	});

	it('never excludes the authored element renderer', () => {
		const renderer = template.match(/<pptx-element-renderer[^>]*>/)?.[0];
		expect(renderer).toBeDefined();
		expect(renderer).not.toContain('data-export-ignore');
	});

	it.each(['pptx-ng-handle', 'pptx-ng-rotate-handle', 'pptx-ng-adjust-handle'])(
		'keeps the theme button-size floor off the explicitly sized %s control',
		(className) => {
			const button = template.match(new RegExp(`<button[^>]*class="${className}"[^>]*>`))?.[0];
			expect(button).toBeDefined();
			expect(button).toContain('data-pptx-compact');
		},
	);

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
