/**
 * Draw ribbon tab: the pen colour is a colour pick like any other, so the
 * COMMITTED value (`change`) joins the deck's "Recent colours" list, while the
 * continuous `input` stream keeps driving the live pen colour only.
 */
import { mount } from '@vue/test-utils';
import { registerPptxWebControls } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';

import { RecentColorsKey } from '../../composables/recent-colors-context';
import { setControlValue } from '../inspector/test-control-value';
import DrawSection from './DrawSection.vue';

registerPptxWebControls();

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
	it('routes shared tools and width choices, updates controlled state and gates edits', async () => {
		const wrapper = mountDraw(vi.fn(), vi.fn());
		const tool = vi.fn(),
			width = vi.fn();
		await wrapper.setProps({ onSetActiveTool: tool, onSetDrawingWidth: width });
		const command = wrapper.element.querySelector('[data-ribbon-control="draw.tools.freeform"]')!;
		const button = command.shadowRoot!.querySelector<HTMLButtonElement>('button')!;
		button.click();
		expect(tool).toHaveBeenCalledExactlyOnceWith('freeform');
		await setControlValue(wrapper.find('pptx-ui-select'), '16');
		expect(width).toHaveBeenCalledExactlyOnceWith(16);
		await wrapper.setProps({ activeTool: 'freeform', canEdit: false });
		expect(button.getAttribute('aria-pressed')).toBe('true');
		expect(button.disabled).toBeTruthy();
		button.click();
		expect(tool).toHaveBeenCalledOnce();
		wrapper.unmount();
	});

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
