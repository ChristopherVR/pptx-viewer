// @vitest-environment happy-dom
/**
 * The File > Options numeric-control commit path, React binding.
 *
 * The field used to clamp with an inline `Math.min(max, Math.max(min, ...))`
 * guarded by `Number.isFinite`. It now defers to the shared
 * `clampOptionNumber`, which is the source of truth for both the clamping
 * and the "skip the commit on unparsable input" behaviour.
 */
/* oxlint-disable eslint/one-var -- each fixture/lookup below is an independent
   local; merging unrelated declarations across this file would hurt
   readability, not help it (see chart-view-model.ts for the same rationale). */
import { DEFAULT_VIEWER_OPTIONS } from 'pptx-viewer-shared';
import type { ViewerOptionsTabDefinition } from 'pptx-viewer-shared';
import { translationsEn } from 'pptx-viewer-shared/i18n';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// oxlint-disable-next-line prefer-ending-with-an-expect
vi.mock<typeof import('react-i18next')>(import('react-i18next'), () => ({
	useTranslation: () => ({
		t: (key: string) => translationsEn[key] ?? key,
	}),
}));

const { OptionsPane } = await import('./OptionsPane');

const TAB: ViewerOptionsTabDefinition = {
	id: 'advanced',
	labelKey: 'pptx.options.tabs.advanced',
	descriptionKey: 'pptx.options.tabs.advanced',
	sections: [
		{
			id: 'edit',
			titleKey: 'pptx.options.advanced.editSection',
			controls: [
				{
					kind: 'number',
					group: 'advanced',
					key: 'maximumUndoSteps',
					labelKey: 'pptx.options.advanced.maximumUndoSteps',
					min: 3,
					max: 150,
				},
			],
		},
	],
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
	globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

describe('optionsPane numeric commit', () => {
	it('clamps an out-of-range value into the schema range', () => {
		const onOptionChange = vi.fn();
		act(() => {
			root.render(
				<OptionsPane tab={TAB} options={DEFAULT_VIEWER_OPTIONS} onOptionChange={onOptionChange} />,
			);
		});
		const input = container.querySelector('input[type="number"]') as HTMLInputElement;
		const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
		act(() => {
			setter?.call(input, '9999');
			input.dispatchEvent(new Event('change', { bubbles: true }));
		});
		expect(onOptionChange).toHaveBeenCalledWith('advanced', 'maximumUndoSteps', 150);
	});

	it('skips the commit on a non-finite parse instead of committing min', () => {
		const onOptionChange = vi.fn();
		act(() => {
			root.render(
				<OptionsPane tab={TAB} options={DEFAULT_VIEWER_OPTIONS} onOptionChange={onOptionChange} />,
			);
		});
		const input = container.querySelector('input[type="number"]') as HTMLInputElement;
		const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
		act(() => {
			// A huge exponent is valid number-input syntax (survives DOM value
			// sanitization) but parses to Infinity, which is the realistic way a
			// non-finite value reaches the handler.
			setter?.call(input, '1e400');
			input.dispatchEvent(new Event('change', { bubbles: true }));
		});
		expect(onOptionChange).not.toHaveBeenCalled();
	});
});
