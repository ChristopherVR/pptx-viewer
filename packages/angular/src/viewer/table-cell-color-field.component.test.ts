/**
 * table-cell-color-field.component.test.ts: source-text guard for the
 * table-cell colour field's theme-colour wiring. No Angular TestBed (see
 * `vitest.config.ts`) and `label`/`fallback` are `input.required<string>()`,
 * which cannot be set on a directly-constructed instance outside a
 * component factory, so this pins the template/handler wiring as text (same
 * technique as `ribbon-color-popover.component.test.ts`); the shared
 * `normalizeHexColor` fallback logic it reuses is covered by
 * `pptx-viewer-shared`'s own tests.
 */
import { describe, expect, it } from 'vitest';

import { componentSource } from './component-source.test-support';

const source = componentSource(import.meta.dirname, 'table-cell-color-field.component.ts');

describe('tableCellColorFieldComponent theme colours', () => {
	it('mounts the theme-swatch grid below the native colour input', () => {
		expect(source).toContain('<pptx-theme-color-swatch-grid');
		expect(source).toContain('[selectedRef]="selectedRef()"');
		expect(source).toContain('[selectedHex]="hex()"');
		expect(source).toContain('ThemeColorSwatchGridComponent');
	});

	it('a theme-swatch pick emits BOTH the resolved hex and the ref', () => {
		expect(source).toContain('protected onThemePick(pick: ThemeColorPickerCommit): void {');
		expect(source).toContain('this.commit.emit(pick);');
	});

	it('the native colour input always emits ref: undefined, clearing any stored ref', () => {
		expect(source).toContain('this.commit.emit({ hex: value, ref: undefined });');
	});
});
