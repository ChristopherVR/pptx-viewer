import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { ref } from 'vue';

import { ThemeColorMapKey } from '../../composables/theme-color-map-context';
import TableCellColorField from './TableCellColorField.vue';

/**
 * W3-G3: table cell text/fill colour pickers show the deck's theme palette
 * and commit a `PptxThemeColorRef` alongside the resolved hex; the native
 * colour input clears any previously-stored ref.
 */
const OFFICE_THEME = {
	dk1: '#000000',
	lt1: '#FFFFFF',
	dk2: '#44546A',
	lt2: '#E7E6E6',
	accent1: '#4472C4',
	accent2: '#ED7D31',
	accent3: '#A5A5A5',
	accent4: '#FFC000',
	accent5: '#5B9BD5',
	accent6: '#70AD47',
	bg1: '#FFFFFF',
	tx1: '#000000',
	bg2: '#E7E6E6',
	tx2: '#44546A',
};

function mountField(props: Record<string, unknown>) {
	return mount(TableCellColorField, {
		props: {
			label: 'Background',
			value: '#ffffff',
			fallback: '#ffffff',
			selectedRef: undefined,
			disabled: false,
			...props,
		},
		global: { provide: { [ThemeColorMapKey as symbol]: ref(OFFICE_THEME) } },
	});
}

describe('tableCellColorField', () => {
	it('commits both the resolved hex and the ref on a theme swatch click', async () => {
		const wrapper = mountField({});
		const accent1 = wrapper.get('button[title="Accent 1"]');
		await accent1.trigger('click');
		expect(wrapper.emitted('commit')?.[0]).toStrictEqual(['#4472c4', { scheme: 'accent1' }]);
	});

	it('clears the ref when the native colour input changes', async () => {
		const wrapper = mountField({ value: '#4472c4', selectedRef: { scheme: 'accent1' } });
		const input = wrapper.find('input[type="color"]');
		await input.setValue('#ff0000');
		const commits = wrapper.emitted('commit');
		expect(commits).toBeTruthy();
		const [hex, colorRef] = commits![commits!.length - 1];
		expect(hex).toBe('#ff0000');
		expect(colorRef).toBeFalsy();
	});
});
