/**
 * ribbon-color-popover.component.test.ts: the "Recent colours" row inside the
 * font-colour / highlight / shape-fill / shape-outline popover (wave-4 B6).
 * No Angular TestBed (see `vitest.config.ts`), so this is a source-text guard
 * (same technique as `power-point-viewer-api.test.ts`).
 */
import { describe, expect, it } from 'vitest';

import { componentSource } from './component-source.test-support';

const source = componentSource(import.meta.dirname, 'ribbon-color-popover.component.ts');

describe('ribbonColorPopoverComponent recent colours', () => {
	it('renders a swatch per recent colour, seeded from the shared RecentColorsService', () => {
		expect(source).toContain('data-testid="pptx-color-recent"');
		expect(source).toContain('recentColors.recent()');
		expect(source).toContain("'pptx.colorPicker.recentColors' | translate");
	});

	it('every commit (preset swatch, recent swatch, or custom colour input) records the pick', () => {
		expect(source).toContain('(click)="onPick(c)"');
		expect(source).toContain('(change)="onPick($any($event.target).value)"');
		expect(source).toContain('this.recentColors.push(color)');
	});
});
