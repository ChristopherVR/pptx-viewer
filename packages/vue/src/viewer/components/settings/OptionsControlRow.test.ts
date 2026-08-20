/* oxlint-disable eslint/one-var -- each fixture/lookup below is an independent
   local; merging unrelated declarations across this file would hurt
   readability, not help it (see chart-view-model.ts for the same rationale). */
import { mount } from '@vue/test-utils';
import { DEFAULT_VIEWER_OPTIONS } from 'pptx-viewer-shared';
import type { ViewerOptionsNumberControl } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';

import OptionsControlRow from './OptionsControlRow.vue';

/**
 * The File > Options numeric-control commit path, Vue binding.
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

describe('optionsControlRow numeric commit', () => {
	it('clamps an out-of-range value into the schema range', async () => {
		const onOptionChange = vi.fn();
		const wrapper = mount(OptionsControlRow, {
			props: { control: CONTROL, options: DEFAULT_VIEWER_OPTIONS, onOptionChange },
		});
		await wrapper.find('input[type="number"]').setValue('9999');
		expect(onOptionChange).toHaveBeenCalledWith('advanced', 'maximumUndoSteps', 150);
	});

	it('skips the commit on a non-finite parse instead of committing min', async () => {
		const onOptionChange = vi.fn();
		const wrapper = mount(OptionsControlRow, {
			props: { control: CONTROL, options: DEFAULT_VIEWER_OPTIONS, onOptionChange },
		});
		// A huge exponent is valid number-input syntax (survives DOM value
		// sanitization) but parses to Infinity, which is the realistic way a
		// non-finite value reaches the handler.
		await wrapper.find('input[type="number"]').setValue('1e400');
		expect(onOptionChange).not.toHaveBeenCalled();
	});
});
