// oxlint-disable react-hooks/rules-of-hooks
/* oxlint-disable eslint/one-var -- many independent it() blocks, each with
   its own short arrange/act/assert consts. */
import { mount } from '@vue/test-utils';
import type { PptxTableData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import TableSizePanel from './TableSizePanel.vue';

function tableData(): PptxTableData {
	return {
		columnWidths: [0.2, 0.3, 0.5],
		rows: [
			{ height: 20, cells: [{ text: 'a' }, { text: 'b' }, { text: 'c' }] },
			{ height: 60, cells: [{ text: 'd' }, { text: 'e' }, { text: 'f' }] },
		],
	};
}

function lastPatch(wrapper: ReturnType<typeof mount>): Partial<PptxTableData> {
	const events = wrapper.emitted('update');
	expect(events).toBeTruthy();
	const ev = events as unknown[][];
	return ev[ev.length - 1][0] as Partial<PptxTableData>;
}

describe('tableSizePanel', () => {
	it('sets a column to the exact requested width via the shared redistribution formula', async () => {
		const wrapper = mount(TableSizePanel, { props: { tableData: tableData(), canEdit: true } });
		const slider = wrapper.findAll('input[type="range"]')[0];
		await slider.setValue('60');

		const widths = lastPatch(wrapper).columnWidths ?? [];
		expect(widths[0]).toBeCloseTo(0.6, 5);
		expect(widths.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
		// The untouched columns' 0.3:0.5 ratio to each other is preserved.
		expect(widths[2] / widths[1]).toBeCloseTo(0.5 / 0.3, 5);
	});

	it('distributes column widths evenly', async () => {
		const wrapper = mount(TableSizePanel, { props: { tableData: tableData(), canEdit: true } });
		const buttons = wrapper.findAll('button');
		await buttons[0].trigger('click');

		expect(lastPatch(wrapper).columnWidths).toStrictEqual([1 / 3, 1 / 3, 1 / 3]);
	});

	it('distributes row heights evenly, rounded to the average', async () => {
		const wrapper = mount(TableSizePanel, { props: { tableData: tableData(), canEdit: true } });
		const buttons = wrapper.findAll('button');
		await buttons[1].trigger('click');

		const rows = lastPatch(wrapper).rows;
		expect(rows?.[0].height).toBe(40);
		expect(rows?.[1].height).toBe(40);
	});
});
