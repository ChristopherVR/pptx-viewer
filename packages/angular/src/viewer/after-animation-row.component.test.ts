/**
 * The animation panel's "after animation" row, Angular binding.
 *
 * No Angular TestBed (see `vitest.config.ts`): the component is instantiated
 * directly, inputs are stubbed as signals, and handlers are called with real
 * DOM elements.
 *
 * Reference binding: packages/react/src/viewer/components/inspector/AfterAnimationRow.tsx
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { Injector, runInInjectionContext, signal } from '@angular/core';
import type { InputSignal, OutputEmitterRef } from '@angular/core';
import type { PptxAfterAnimationAction } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { AfterAnimationRowComponent } from './after-animation-row.component';

const ROW_SOURCE = readFileSync(path.join(__dirname, 'after-animation-row.component.ts'), 'utf8');

function createRow(
	action: PptxAfterAnimationAction,
	color?: string,
): {
	row: AfterAnimationRowComponent;
	actionsEmitted: PptxAfterAnimationAction[];
	colorsEmitted: string[];
} {
	const row = runInInjectionContext(
		Injector.create({ providers: [] }),
		() => new AfterAnimationRowComponent(),
	);
	Object.assign(row, {
		action: signal(action) as unknown as InputSignal<PptxAfterAnimationAction>,
		color: signal(color) as unknown as InputSignal<string | undefined>,
		canEdit: signal(true) as unknown as InputSignal<boolean>,
	});
	const actionsEmitted: PptxAfterAnimationAction[] = [];
	const colorsEmitted: string[] = [];
	vi.spyOn(
		row.actionChange as OutputEmitterRef<PptxAfterAnimationAction>,
		'emit',
	).mockImplementation((value) => {
		actionsEmitted.push(value);
	});
	vi.spyOn(row.colorChange as OutputEmitterRef<string>, 'emit').mockImplementation((value) => {
		colorsEmitted.push(value);
	});
	return { row, actionsEmitted, colorsEmitted };
}

function selectChange(row: AfterAnimationRowComponent, value: string): void {
	const select = document.createElement('select');
	const option = document.createElement('option');
	option.value = value;
	select.append(option);
	select.value = value;
	(row as unknown as { onActionChange: (event: Event) => void }).onActionChange({
		target: select,
	} as Event);
}

function colorChange(row: AfterAnimationRowComponent, value: string): void {
	const input = document.createElement('input');
	input.type = 'color';
	input.value = value;
	(row as unknown as { onColorChange: (event: Event) => void }).onColorChange({
		target: input,
	} as unknown as Event);
}

describe('afterAnimationRowComponent', () => {
	it('emits the selected action', () => {
		const { row, actionsEmitted } = createRow('none');
		selectChange(row, 'hideOnNextClick');
		expect(actionsEmitted).toStrictEqual(['hideOnNextClick']);
	});

	it('emits the picked colour', () => {
		const { row, colorsEmitted } = createRow('dimToColor', '#000000');
		colorChange(row, '#ff00ff');
		expect(colorsEmitted).toStrictEqual(['#ff00ff']);
	});
});

describe('after animation row template contract', () => {
	it('labels the row from the shared dictionary', () => {
		expect(ROW_SOURCE).toContain(`'pptx.animation.afterAnimation' | translate`);
	});

	it('shows the colour swatch only for dimToColor', () => {
		expect(ROW_SOURCE).toContain(`@if (action() === 'dimToColor') {`);
		expect(ROW_SOURCE).toContain(`'pptx.animation.afterAnimation.color' | translate`);
	});

	it('disables both controls on a read-only deck', () => {
		const disabledCount = (ROW_SOURCE.match(/\[disabled\]="!canEdit\(\)"/gu) ?? []).length;
		expect(disabledCount).toBe(2);
	});
});
