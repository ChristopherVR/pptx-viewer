import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import TableResizeOverlay from './TableResizeOverlay.vue';

describe('table resize release', () => {
	it.each([
		[200, 10],
		[10, 0],
	])('does not commit a stationary boundary click at %s, %s', async (x, y) => {
		const wrapper = mount(TableResizeOverlay, {
			props: { columnWidths: [0.5, 0.5], editable: true },
			slots: { default: '<table><tbody><tr><td>A</td></tr><tr><td>B</td></tr></tbody></table>' },
			attachTo: document.body,
		});
		vi.spyOn(wrapper.element, 'getBoundingClientRect').mockReturnValue({
			left: 0,
			top: 0,
			width: 400,
			height: 200,
		} as DOMRect);
		try {
			await wrapper.trigger('mousedown', { clientX: x, clientY: y });
			window.dispatchEvent(new MouseEvent('mouseup', { clientX: x, clientY: y }));
			expect(wrapper.emitted('resizeColumns')).toBeUndefined();
			expect(wrapper.emitted('resizeRow')).toBeUndefined();
			expect(document.body.style.cursor).toBe('');
		} finally {
			wrapper.unmount();
		}
	});
});
