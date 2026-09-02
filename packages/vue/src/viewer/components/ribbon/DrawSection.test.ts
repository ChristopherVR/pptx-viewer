/**
 * Draw ribbon tab: the pen colour is a colour pick like any other, so the
 * COMMITTED value (`change`) joins the deck's "Recent colours" list, while the
 * continuous `input` stream keeps driving the live pen colour only.
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import { RecentColorsKey } from '../../composables/recent-colors-context';
import DrawSection from './DrawSection.vue';

function mountDraw(push: (hex: string) => void, onSetDrawingColor: (hex: string) => void) {
	return mount(DrawSection, {
		props: {
			activeTool: 'select',
			drawingColor: '#000000',
			drawingWidth: 2,
			onSetActiveTool: () => {},
			onSetDrawingColor,
			onSetDrawingWidth: () => {},
		},
		global: {
			provide: { [RecentColorsKey as symbol]: { recentColors: [], push } },
		},
	});
}

describe('drawSection pen colour (recent colours)', () => {
	it('drives the live pen colour on input without recording a recent colour', async () => {
		const push = vi.fn();
		const onSetDrawingColor = vi.fn();
		const wrapper = mountDraw(push, onSetDrawingColor);

		const input = wrapper.find<HTMLInputElement>('input[type="color"]');
		input.element.value = '#123456';
		// `setValue` would fire `change` too; a drag inside the native dialog
		// streams only `input` events.
		await input.trigger('input');

		expect(onSetDrawingColor).toHaveBeenCalledWith('#123456');
		expect(push).not.toHaveBeenCalled();
	});

	it('pushes the committed pen colour into the recent-colours list on change', async () => {
		const push = vi.fn();
		const wrapper = mountDraw(push, () => {});

		const input = wrapper.find<HTMLInputElement>('input[type="color"]');
		input.element.value = '#abcdef';
		await input.trigger('change');

		expect(push).toHaveBeenCalledWith('#abcdef');
	});

	it('tolerates being mounted without a recent-colours provider', async () => {
		const wrapper = mount(DrawSection, {
			props: {
				activeTool: 'select',
				drawingColor: '#000000',
				drawingWidth: 2,
				onSetActiveTool: () => {},
				onSetDrawingColor: () => {},
				onSetDrawingWidth: () => {},
			},
		});
		await expect(wrapper.find('input[type="color"]').trigger('change')).resolves.toBeUndefined();
	});
});
