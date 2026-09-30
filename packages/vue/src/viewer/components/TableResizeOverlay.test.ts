import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';

import TableResizeOverlay from './TableResizeOverlay.vue';

describe('table resize release', () => {
	it('lets a scaled cell-center click bubble while consuming the visible row edge', async () => {
		const wrapper = mount(TableResizeOverlay, {
			props: { columnWidths: [0.5, 0.5], editable: true },
			slots: {
				default:
					'<table><tbody><tr><td>A</td></tr><tr><td>B</td></tr><tr><td>C</td></tr></tbody></table>',
			},
			attachTo: document.body,
		});
		Object.defineProperty(wrapper.element, 'offsetHeight', { value: 200 });
		vi.spyOn(wrapper.element, 'getBoundingClientRect').mockReturnValue({
			left: 0,
			top: 0,
			width: 250,
			height: 125,
		} as DOMRect);
		for (const row of wrapper.element.querySelectorAll('tr')) {
			Object.defineProperty(row, 'offsetHeight', { value: 40 });
		}
		await nextTick();
		try {
			const center = new MouseEvent('mousedown', {
				clientX: 10,
				clientY: 37.5,
				bubbles: true,
				cancelable: true,
			});
			wrapper.element.dispatchEvent(center);
			expect(center.defaultPrevented).toBeFalsy();
			const edge = new MouseEvent('mousedown', {
				clientX: 10,
				clientY: 25,
				bubbles: true,
				cancelable: true,
			});
			wrapper.element.dispatchEvent(edge);
			expect(edge.defaultPrevented).toBeTruthy();
			window.dispatchEvent(new MouseEvent('mouseup', { clientX: 10, clientY: 25 }));
			expect(wrapper.emitted('resizeRow')).toBeUndefined();
		} finally {
			wrapper.unmount();
		}
	});

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
