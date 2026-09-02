// These are Vue composables (Composition API), not React hooks; the react-hooks
// rule misfires on the `useX` naming when invoked inside a test `setup` fn.
// oxlint-disable react-hooks/rules-of-hooks
/* oxlint-disable eslint/one-var -- independent, unrelated locals across this
   short assertion; merging them into one statement would hurt readability. */
import { mount } from '@vue/test-utils';
import type { PptxTableData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import TableStyleOptions from './TableStyleOptions.vue';

function tableData(overrides: Partial<PptxTableData> = {}): PptxTableData {
	return {
		columnWidths: [0.5, 0.5],
		firstRowHeader: true,
		rows: [{ cells: [{ text: 'h1' }, { text: 'h2' }] }, { cells: [{ text: 'a' }, { text: 'b' }] }],
		...overrides,
	};
}

describe('tableStyleOptions', () => {
	it('applies the shared preset assignment when a quick-style swatch is clicked', async () => {
		const wrapper = mount(TableStyleOptions, {
			props: { tableData: tableData(), canEdit: true },
		});

		const preset = wrapper.get('button[title="Light 1"]');
		await preset.trigger('click');

		const events = wrapper.emitted('update');
		expect(events).toBeTruthy();
		const patch = (events as unknown[][])[0][0] as Partial<PptxTableData>;
		expect(patch.rows?.[0].cells[0].style?.backgroundColor).toBe('#4472C4');
		expect(patch.rows?.[0].cells[0].style?.bold).toBeTruthy();
		expect(patch.rows?.[1].cells[0].style?.borderColor).toBe('#B4C6E7');
	});

	it('emits firstCol/lastCol/lastRow toggle patches keyed to the shared TableInspectorChanges flags', async () => {
		const wrapper = mount(TableStyleOptions, {
			props: { tableData: tableData(), canEdit: true },
		});

		const checkboxes = wrapper.findAll('input[type="checkbox"]');
		// TOGGLES order: bandedRows, firstRowHeader, bandedColumns, firstCol, lastCol, lastRow.
		await checkboxes[3].setValue(true);
		expect((wrapper.emitted('update') as unknown[][]).at(-1)?.[0]).toStrictEqual({
			firstCol: true,
		});

		await checkboxes[4].setValue(true);
		expect((wrapper.emitted('update') as unknown[][]).at(-1)?.[0]).toStrictEqual({ lastCol: true });

		await checkboxes[5].setValue(true);
		expect((wrapper.emitted('update') as unknown[][]).at(-1)?.[0]).toStrictEqual({ lastRow: true });
	});
});
