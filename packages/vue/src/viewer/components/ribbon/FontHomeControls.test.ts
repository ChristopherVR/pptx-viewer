/**
 * Home > Font character strip: the Vue adapter reflects the effective text
 * style into the shared `pptx-ui-ribbon-home-font` element and re-emits its
 * single intent as the typed events TextSection already handles.
 */
import { mount } from '@vue/test-utils';
import { registerPptxWebControls } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import FontHomeControls from './FontHomeControls.vue';

registerPptxWebControls();

function mountControls(props: Record<string, unknown> = {}) {
	const wrapper = mount(FontHomeControls, {
		props: { disabled: false, textStyle: { bold: true, textShadowColor: '#000000' }, ...props },
	});
	const button = (id: string) =>
		wrapper.element.querySelector<HTMLButtonElement>(`[data-ribbon-control="home.font.${id}"]`)!;
	return { wrapper, button };
}

describe('fontDecorationControls', () => {
	it('reflects pressed state from the effective text style', () => {
		const { wrapper, button } = mountControls();
		expect(button('bold').getAttribute('aria-pressed')).toBe('true');
		expect(button('italic').getAttribute('aria-pressed')).toBe('false');
		expect(button('shadow').getAttribute('aria-pressed')).toBe('true');
		expect(button('increaseFontSize').hasAttribute('aria-pressed')).toBeFalsy();
		wrapper.unmount();
	});

	it('re-emits each shared intent as the existing typed event', () => {
		const { wrapper, button } = mountControls();
		button('underline').click();
		button('shadow').click();
		button('increaseFontSize').click();
		button('decreaseFontSize').click();
		button('clearFormatting').click();
		expect(wrapper.emitted('format')).toStrictEqual([['underline']]);
		expect(wrapper.emitted('shadow')).toHaveLength(1);
		expect(wrapper.emitted('increase')).toHaveLength(1);
		expect(wrapper.emitted('decrease')).toHaveLength(1);
		expect(wrapper.emitted('clear')).toHaveLength(1);
		wrapper.unmount();
	});

	it('emits nothing while disabled', async () => {
		const { wrapper, button } = mountControls({ disabled: true });
		expect(button('bold').disabled).toBeTruthy();
		button('bold').click();
		expect(wrapper.emitted('format')).toBeUndefined();
		await wrapper.setProps({ disabled: false });
		expect(button('bold').disabled).toBeFalsy();
		wrapper.unmount();
	});
});
