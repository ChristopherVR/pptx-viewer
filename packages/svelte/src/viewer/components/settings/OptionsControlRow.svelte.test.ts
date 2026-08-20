/* oxlint-disable eslint/one-var -- each fixture/lookup below is an independent
   local; merging unrelated declarations across this file would hurt
   readability, not help it (see chart-view-model.ts for the same rationale). */
import { DEFAULT_VIEWER_OPTIONS } from 'pptx-viewer-shared';
import type { ViewerOptionsGroupId, ViewerOptionsNumberControl } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import OptionsControlRow from './OptionsControlRow.svelte';

/**
 * The File > Options numeric-control commit path, Svelte binding.
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

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function mountRow(
	onchange: (group: ViewerOptionsGroupId, key: string, value: boolean | number | string) => void,
): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(OptionsControlRow, {
		target,
		props: { control: CONTROL, options: DEFAULT_VIEWER_OPTIONS, onchange },
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

function setNumberValue(target: HTMLElement, value: string): void {
	const input = target.querySelector('input[type="number"]') as HTMLInputElement;
	input.value = value;
	input.dispatchEvent(new Event('change', { bubbles: true }));
	flushSync();
}

describe('optionsControlRow numeric commit', () => {
	it('clamps an out-of-range value into the schema range', () => {
		const onchange = vi.fn();
		const target = mountRow(onchange);
		setNumberValue(target, '9999');
		expect(onchange).toHaveBeenCalledWith('advanced', 'maximumUndoSteps', 150);
	});

	it('skips the commit on a non-finite parse instead of committing min', () => {
		const onchange = vi.fn();
		const target = mountRow(onchange);
		// A huge exponent is valid number-input syntax (survives DOM value
		// sanitization) but parses to Infinity, which is the realistic way a
		// non-finite value reaches the handler.
		setNumberValue(target, '1e400');
		expect(onchange).not.toHaveBeenCalled();
	});
});
