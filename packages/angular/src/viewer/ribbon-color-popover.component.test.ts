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
	it('mounts the reusable recent-colours row, seeded from the shared RecentColorsService', () => {
		expect(source).toContain('<pptx-recent-colors-row');
		expect(source).toContain('[colors]="recentColors.recent()"');
		expect(source).toContain('RecentColorsRowComponent');
	});

	it('every commit (preset swatch, recent-row pick, or custom colour input) records the pick', () => {
		expect(source).toContain('(click)="onPick(c)"');
		expect(source).toContain('(pick)="onPick($event)"');
		expect(source).toContain('(change)="onPick($any($event.target).value)"');
		expect(source).toContain('this.recentColors.push(color)');
	});
});

describe('ribbonColorPopoverComponent theme colours (W3-G2)', () => {
	it('mounts the theme-swatch grid only when showThemeColors is set, above the presets', () => {
		expect(source).toContain('@if (showThemeColors()) {');
		expect(source).toContain('<pptx-theme-color-swatch-grid');
		expect(source).toContain('[selectedRef]="currentRef()"');
		expect(source).toContain('ThemeColorSwatchGridComponent');
	});

	it('fires a SEPARATE pickThemeColor output (never also pick) for a theme-swatch click', () => {
		expect(source).toContain('readonly pickThemeColor = output<ThemeColorPickerCommit>();');
		expect(source).toContain('protected onThemePick(commit: ThemeColorPickerCommit): void {');
		expect(source).toContain('this.pickThemeColor.emit(commit);');
		// The theme-pick handler must not ALSO emit `pick` for the same click
		// (that would commit the hex-only and ref-bearing patches as two
		// separate edits/undo-steps for one click).
		const themePickBody = source.slice(
			source.indexOf('protected onThemePick'),
			source.indexOf('}', source.indexOf('protected onThemePick')),
		);
		expect(themePickBody).not.toContain('this.pick.emit');
	});
});
