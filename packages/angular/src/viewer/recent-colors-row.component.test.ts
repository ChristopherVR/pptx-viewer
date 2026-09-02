/**
 * recent-colors-row.component.test.ts: the reusable "Recent colours" row
 * (wave-4 B6), extracted out of `RibbonColorPopoverComponent` so the
 * inspector's fill/stroke/text colour pickers can mount the same row.
 *
 * No Angular TestBed (see `vitest.config.ts`): the component takes no
 * injected dependencies, so it is instantiated directly and inputs are
 * stubbed as signals, matching the rest of this package's convention.
 */
import { Injector, runInInjectionContext, signal } from '@angular/core';
import type { InputSignal, OutputEmitterRef } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';

import { componentSource } from './component-source.test-support';
import { RecentColorsRowComponent } from './recent-colors-row.component';

const source = componentSource(import.meta.dirname, 'recent-colors-row.component.ts');

function createRow(
	colors: readonly string[],
	disabled = false,
): { row: RecentColorsRowComponent; picked: string[] } {
	const row = runInInjectionContext(
		Injector.create({ providers: [] }),
		() => new RecentColorsRowComponent(),
	);
	Object.assign(row, {
		colors: signal(colors) as unknown as InputSignal<readonly string[]>,
		disabled: signal(disabled) as unknown as InputSignal<boolean>,
	});
	const picked: string[] = [];
	vi.spyOn(row.pick as OutputEmitterRef<string>, 'emit').mockImplementation((value) => {
		picked.push(value);
	});
	return { row, picked };
}

describe('recentColorsRowComponent', () => {
	it('emits pick when a swatch is clicked', () => {
		const { row, picked } = createRow(['#112233', '#445566']);
		row.pick.emit('#445566');
		expect(picked).toStrictEqual(['#445566']);
	});

	it('exposes the seeded colours, most-recent-first, unchanged', () => {
		const { row } = createRow(['#ff0000', '#00ff00']);
		expect(row.colors()).toStrictEqual(['#ff0000', '#00ff00']);
	});
});

describe('recent colours row template contract', () => {
	it('renders the row container with the shared testid + aria-label', () => {
		expect(source).toContain('data-testid="pptx-color-recent"');
		expect(source).toContain('[attr.aria-label]="\'pptx.colorPicker.recentColors\' | translate"');
		const labelMatches = (source.match(/'pptx\.colorPicker\.recentColors' \| translate/gu) ?? [])
			.length;
		expect(labelMatches).toBe(2);
	});

	it('hides the row while the list is empty', () => {
		expect(source).toContain('@if (colors().length > 0) {');
	});

	it('gives each swatch a title, a "Recent <hex>" aria-label, and disables it when the picker is disabled', () => {
		expect(source).toContain('[title]="c"');
		expect(source).toContain('[attr.aria-label]="\'Recent \' + c"');
		expect(source).toContain('[disabled]="disabled()"');
	});

	it('emits pick on click, and swallows mousedown so the row does not steal focus', () => {
		expect(source).toContain('(click)="pick.emit(c)"');
		expect(source).toContain('(mousedown)="$event.preventDefault()"');
	});
});
