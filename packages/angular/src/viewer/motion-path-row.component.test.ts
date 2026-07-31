/**
 * The animation panel's motion-path row, Angular binding.
 *
 * The interesting behaviour is the one that is easy to get subtly wrong: a
 * path dragged on the canvas matches no catalogue entry, so the select must
 * report "Custom Path" rather than silently snapping back to the preset the
 * user started from (which would misreport what will play), and re-picking
 * that marker must change nothing.
 *
 * No Angular TestBed (see `vitest.config.ts`): the select's value model is a
 * pure function, the change handler is called directly with a real
 * `HTMLSelectElement`, and the template contract is read from the source.
 *
 * Reference binding: packages/react/src/viewer/components/inspector/MotionPathRow.tsx
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { Injector, runInInjectionContext, signal } from '@angular/core';
import type { InputSignal, OutputEmitterRef } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';

import { motionPathPresetById } from '../internal/shared';
import { MotionPathRowComponent, motionPathSelectValue } from './motion-path-row.component';

const ROW_SOURCE = readFileSync(path.join(__dirname, 'motion-path-row.component.ts'), 'utf8');

/** A row whose inputs are writable, so a test can drive them without a TestBed. */
function createRow(motionPath: string | undefined): {
	row: MotionPathRowComponent;
	emitted: string[];
} {
	const row = runInInjectionContext(
		Injector.create({ providers: [] }),
		() => new MotionPathRowComponent(),
	);
	Object.assign(row, {
		motionPath: signal(motionPath) as unknown as InputSignal<string | undefined>,
		canEdit: signal(true) as unknown as InputSignal<boolean>,
	});
	const emitted: string[] = [];
	vi.spyOn(row.presetChange as OutputEmitterRef<string>, 'emit').mockImplementation((value) => {
		emitted.push(value);
	});
	return { row, emitted };
}

/** Fire the row's change handler with a select whose value is `value`. */
function change(row: MotionPathRowComponent, value: string): void {
	const select = document.createElement('select');
	const option = document.createElement('option');
	option.value = value;
	select.append(option);
	select.value = value;
	(row as unknown as { onSelect: (event: Event) => void }).onSelect({
		target: select,
	} as unknown as Event);
}

/** Read a protected computed the template binds to. */
function view(row: MotionPathRowComponent): {
	selectedValue: () => string;
	isCustom: () => boolean;
} {
	return row as unknown as { selectedValue: () => string; isCustom: () => boolean };
}

describe('motionPathSelectValue', () => {
	it('reports no path when none is applied', () => {
		expect(motionPathSelectValue(undefined)).toBe('none');
		expect(motionPathSelectValue('')).toBe('none');
	});

	it('reports the catalogue id of a recognised path', () => {
		expect(motionPathSelectValue(motionPathPresetById('arcRight')?.path)).toBe('arcRight');
	});

	it('reports a hand-dragged path as custom rather than the nearest preset', () => {
		expect(motionPathSelectValue('M 0 0 L 0.31 0.07')).toBe('custom');
	});
});

describe('motionPathRowComponent', () => {
	it('offers the custom option only while the applied path is unrecognised', () => {
		expect(view(createRow('M 0 0 L 0.31 0.07').row).isCustom()).toBeTruthy();
		expect(view(createRow(motionPathPresetById('lineRight')?.path).row).isCustom()).toBeFalsy();
		expect(view(createRow(undefined).row).isCustom()).toBeFalsy();
	});

	it('selects the applied preset', () => {
		const { row } = createRow(motionPathPresetById('spiral')?.path);
		expect(view(row).selectedValue()).toBe('spiral');
	});

	it('emits the picked catalogue id', () => {
		const { row, emitted } = createRow(undefined);
		change(row, 'turnLeft');
		expect(emitted).toStrictEqual(['turnLeft']);
	});

	it('emits none to clear the path', () => {
		const { row, emitted } = createRow(motionPathPresetById('circle')?.path);
		change(row, 'none');
		expect(emitted).toStrictEqual(['none']);
	});

	it('does nothing when the read-only custom marker is re-picked', () => {
		const { row, emitted } = createRow('M 0 0 L 0.31 0.07');
		change(row, 'custom');
		expect(emitted).toStrictEqual([]);
	});
});

describe('motion path row template contract', () => {
	it('labels the row and every option from the shared dictionary', () => {
		expect(ROW_SOURCE).toContain(`'pptx.animation.motionPath.label' | translate`);
		expect(ROW_SOURCE).toContain(`'pptx.animation.motionPath.none' | translate`);
		expect(ROW_SOURCE).toContain(`'pptx.animation.motionPath.custom' | translate`);
	});

	it('groups the catalogue into one optgroup per family', () => {
		expect(ROW_SOURCE).toContain('<optgroup [label]="column.labelKey | translate">');
	});

	it('shows the drag hint only while a path is applied', () => {
		expect(ROW_SOURCE).toContain('@if (motionPath()) {');
		expect(ROW_SOURCE).toContain(`'pptx.animation.motionPath.editHint' | translate`);
	});

	it('disables the select on a read-only deck', () => {
		expect(ROW_SOURCE).toContain('[disabled]="!canEdit()"');
	});
});
