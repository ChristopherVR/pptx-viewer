import { mount } from '@vue/test-utils';
import { PRESET_THEMES, registerPptxWebControls } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import ThemeEditorPanel from './ThemeEditorPanel.vue';

registerPptxWebControls();
const theme = {
	name: 'Loaded',
	colorScheme: PRESET_THEMES[0].colorScheme,
	fontScheme: {
		majorFont: { latin: 'Georgia', eastAsia: 'Yu Gothic' },
		minorFont: { latin: 'Verdana' },
	},
};

describe('theme editor Vue adapter', () => {
	it('stages preset edits and forwards one complete apply payload', () => {
		const wrapper = mount(ThemeEditorPanel, { props: { theme, canEdit: true } });
		const root = wrapper.element.shadowRoot!;
		expect(root.querySelectorAll('input[type=color]')).toHaveLength(12);
		root.querySelectorAll<HTMLButtonElement>('.preset')[1].click();
		expect(wrapper.emitted('apply')).toBeUndefined();
		root.querySelector<HTMLButtonElement>('.apply')!.click();
		expect(wrapper.emitted('apply')).toStrictEqual([
			[
				expect.objectContaining({
					name: 'Facet',
					fontScheme: expect.objectContaining({
						majorFont: expect.objectContaining({ eastAsia: 'Yu Gothic' }),
					}),
				}),
			],
		]);
		wrapper.unmount();
	});

	it('updates disabled properties and forwards close once', async () => {
		const wrapper = mount(ThemeEditorPanel, { props: { theme, canEdit: true } });
		await wrapper.setProps({ canEdit: false });
		const root = wrapper.element.shadowRoot!;
		expect(root.querySelector<HTMLButtonElement>('.apply')!.disabled).toBeTruthy();
		root.querySelector<HTMLButtonElement>('.apply')!.click();
		expect(wrapper.emitted('apply')).toBeUndefined();
		root.querySelector<HTMLButtonElement>('.close')!.click();
		expect(wrapper.emitted('close')).toHaveLength(1);
		wrapper.unmount();
	});
});
