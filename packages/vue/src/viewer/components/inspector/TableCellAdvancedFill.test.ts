import { mount } from '@vue/test-utils';
import type { PptxTableCellStyle } from 'pptx-viewer-core';
import { PATTERN_OPTIONS } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import TableCellAdvancedFill from './TableCellAdvancedFill.vue';

/**
 * The pattern-preset select renders shared `PATTERN_OPTIONS`, which is the bare
 * `a:pattFill/@prst` token list, so it used to make the user choose between
 * `ltHorz` and `narVert`. Text and value are asserted separately: the value is
 * what lands in `patternFillPreset` and what the other bindings are diffed
 * against, so only the spelling may change.
 */
function patternOptions() {
	const wrapper = mount(TableCellAdvancedFill, {
		props: {
			cellStyle: { fillMode: 'pattern' } as PptxTableCellStyle,
			canEdit: true,
		},
	});
	// The pattern select is the second one on the panel (fill mode comes first).
	return wrapper.findAll('select')[1].findAll('option');
}

describe('tableCellAdvancedFill - pattern presets', () => {
	it('offers exactly the shared preset list, by value', () => {
		expect(patternOptions().map((o) => (o.element as HTMLOptionElement).value)).toStrictEqual([
			...PATTERN_OPTIONS,
		]);
	});

	it('spells each preset instead of printing its wire token', () => {
		const byValue = new Map(
			patternOptions().map((o) => [(o.element as HTMLOptionElement).value, o.text()]),
		);
		expect(byValue.get('pct5')).toBe('5%');
		expect(byValue.get('ltHorz')).toBe('Light Horizontal');
		expect(byValue.get('narVert')).toBe('Narrow Vertical');
	});

	it('leaves no preset showing its raw token', () => {
		for (const option of patternOptions()) {
			expect(option.text()).not.toBe((option.element as HTMLOptionElement).value);
		}
	});
});
