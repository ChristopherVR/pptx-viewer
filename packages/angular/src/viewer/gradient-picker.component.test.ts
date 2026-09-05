/**
 * gradient-picker.component.test.ts: source-text guard for the gradient
 * stop theme-colour wiring. No Angular TestBed (see `vitest.config.ts`) and
 * `element` is `input.required<PptxElement>()`, which cannot be set on a
 * directly-constructed instance outside a component factory, so this pins
 * the template/handler wiring as text (same technique as
 * `ribbon-color-popover.component.test.ts`); the underlying patch-builder
 * behaviour (`gradientStopColorCommitPatch` + `updateGradientStopPatch`) is
 * covered directly in `gradient-picker-helpers.test.ts`.
 */
import { describe, expect, it } from 'vitest';

import { componentSource } from './component-source.test-support';

const source = componentSource(import.meta.dirname, 'gradient-picker.component.ts');

describe('gradientPickerComponent theme colours', () => {
	it('mounts the theme-swatch grid below every stop, selected off that stop', () => {
		expect(source).toContain('<pptx-theme-color-swatch-grid');
		expect(source).toContain('[selectedRef]="stop.colorRef"');
		expect(source).toContain('[selectedHex]="stop.color"');
		expect(source).toContain('ThemeColorSwatchGridComponent');
	});

	it('a theme-swatch pick commits through the shared colorRef patch-builder', () => {
		expect(source).toContain('(pick)="onStopThemePick($event, $index)"');
		expect(source).toContain(
			'protected onStopThemePick(commit: ThemeColorPickerCommit, index: number): void {',
		);
		expect(source).toContain(
			'this.emit(updateGradientStopPatch(this.element(), index, gradientStopColorCommitPatch(commit)));',
		);
	});

	it('the native colour input explicitly clears any previously-stored ref', () => {
		expect(source).toContain(
			'this.emit(updateGradientStopPatch(this.element(), index, { color: val, colorRef: undefined }));',
		);
	});
});
