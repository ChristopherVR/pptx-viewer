import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import InsertHyperlinkButton from './InsertHyperlinkButton.vue';

/**
 * Insert > Link.
 *
 * The hyperlink editor and the context-menu entry that opens it have always
 * existed; the ribbon entry point PowerPoint puts on Insert did not, so the
 * command had no discoverable home. Asserted by accessible name because that
 * is what the cross-binding inventory compares.
 */
describe('insertHyperlinkButton', () => {
	it('is named after the hyperlink dialog and opens it', async () => {
		const onOpenHyperlinkDialog = vi.fn();
		const wrapper = mount(InsertHyperlinkButton, {
			props: { hasSelection: true, onOpenHyperlinkDialog },
		});

		expect(wrapper.text()).toBe('Hyperlink');
		expect(wrapper.get('button').attributes('disabled')).toBeUndefined();

		await wrapper.get('button').trigger('click');
		expect(onOpenHyperlinkDialog).toHaveBeenCalledOnce();
	});

	it('is unavailable with nothing selected, since a link attaches to something', () => {
		const wrapper = mount(InsertHyperlinkButton, {
			props: { hasSelection: false, onOpenHyperlinkDialog: vi.fn() },
		});
		expect(wrapper.get('button').attributes('disabled')).toBeDefined();
	});
});
