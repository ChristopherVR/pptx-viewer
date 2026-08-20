/**
 * The File > Options numeric-control commit path, Angular binding.
 *
 * `emitNumber` used to clamp through a local `clampOptionNumber` that fell
 * back to `min` on unparsable input (silently committing a value the user
 * never typed). It now defers to the shared `clampOptionNumber`, which
 * reports `undefined` on invalid input so the edit is skipped entirely,
 * matching every other binding.
 *
 * No Angular TestBed (see `vitest.config.ts`): the component is constructed
 * directly and its protected `emitNumber` handler is invoked with a real
 * `HTMLInputElement`, mirroring `motion-path-row.component.test.ts`.
 */
/* oxlint-disable eslint/one-var -- each fixture/lookup below is an independent
   local; merging unrelated declarations across this file would hurt
   readability, not help it (see chart-view-model.ts for the same rationale). */
import { Injector, runInInjectionContext } from '@angular/core';
import type { OutputEmitterRef } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';

import type { ViewerOptionsNumberControl } from '../internal/shared';
import type { OptionValueChange } from './options-pane.component';
import { OptionsPaneComponent } from './options-pane.component';

const CONTROL: ViewerOptionsNumberControl = {
	kind: 'number',
	group: 'advanced',
	key: 'maximumUndoSteps',
	labelKey: 'pptx.options.advanced.maximumUndoSteps',
	min: 3,
	max: 150,
};

function createPane(): { pane: OptionsPaneComponent; emitted: OptionValueChange[] } {
	const pane = runInInjectionContext(
		Injector.create({ providers: [] }),
		() => new OptionsPaneComponent(),
	);
	const emitted: OptionValueChange[] = [];
	vi.spyOn(pane.valueChange as OutputEmitterRef<OptionValueChange>, 'emit').mockImplementation(
		(value) => {
			emitted.push(value);
		},
	);
	return { pane, emitted };
}

function emitNumber(pane: OptionsPaneComponent, value: string): void {
	const input = document.createElement('input');
	input.type = 'number';
	input.value = value;
	(
		pane as unknown as { emitNumber: (control: ViewerOptionsNumberControl, event: Event) => void }
	).emitNumber(CONTROL, { target: input } as unknown as Event);
}

describe('optionsPaneComponent numeric commit', () => {
	it('clamps an out-of-range value into the schema range', () => {
		const { pane, emitted } = createPane();
		emitNumber(pane, '9999');
		expect(emitted).toStrictEqual([{ group: 'advanced', key: 'maximumUndoSteps', value: 150 }]);
	});

	it('skips the commit on a non-finite parse instead of falling back to min', () => {
		const { pane, emitted } = createPane();
		// A huge exponent is valid number-input syntax (survives DOM value
		// sanitization) but parses to Infinity, which is the realistic way a
		// non-finite value reaches the handler.
		emitNumber(pane, '1e400');
		expect(emitted).toStrictEqual([]);
	});
});
