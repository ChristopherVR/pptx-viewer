/* oxlint-disable eslint/one-var -- each fixture/lookup below is an independent
   local; merging unrelated declarations across this file would hurt
   readability, not help it (see chart-view-model.ts for the same rationale). */
import type { ViewerOptionsNumberControl } from 'pptx-viewer-shared';
import { createViewerOptionsStore } from 'pptx-viewer-shared';
import { afterEach, describe, expect, it } from 'vitest';

import { createTranslator } from '../../i18n';
import { appendControlRow } from './options-controls';

/**
 * The File > Options numeric-control commit path, VanillaJS binding.
 *
 * The field used to clamp with an inline `Math.min(max, Math.max(min, ...))`
 * guarded by `Number.isFinite`. It now defers to the shared
 * `clampOptionNumber`, which is the source of truth for both the clamping
 * and the "skip the commit on unparsable input" behaviour.
 */
const CONTROL: ViewerOptionsNumberControl = {
	kind: 'number',
	group: 'advanced',
	key: 'maximumUndoSteps',
	labelKey: 'pptx.options.advanced.maximumUndoSteps',
	min: 3,
	max: 150,
};

let parent: HTMLElement | undefined;
afterEach(() => {
	parent?.remove();
	parent = undefined;
});

function renderRow(): {
	input: HTMLInputElement;
	store: ReturnType<typeof createViewerOptionsStore>;
} {
	const store = createViewerOptionsStore({ persist: false });
	const t = createTranslator();
	parent = document.createElement('div');
	document.body.appendChild(parent);
	appendControlRow(document, t, parent, CONTROL, store);
	const input = parent.querySelector('input[type="number"]') as HTMLInputElement;
	return { input, store };
}

describe('appendControlRow (number)', () => {
	it('clamps an out-of-range value into the schema range', () => {
		const { input, store } = renderRow();
		input.value = '9999';
		input.dispatchEvent(new Event('change', { bubbles: true }));
		expect(input.value).toBe('150');
		expect(store.getValue('advanced', 'maximumUndoSteps')).toBe(150);
	});

	it('skips the commit on a non-finite parse instead of committing min', () => {
		const { input, store } = renderRow();
		const before = store.getValue('advanced', 'maximumUndoSteps');
		// A huge exponent is valid number-input syntax (survives DOM value
		// sanitization) but parses to Infinity, which is the realistic way a
		// non-finite value reaches the handler.
		input.value = '1e400';
		input.dispatchEvent(new Event('change', { bubbles: true }));
		expect(store.getValue('advanced', 'maximumUndoSteps')).toBe(before);
	});
});
