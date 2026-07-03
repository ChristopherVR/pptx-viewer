import { mount } from '@vue/test-utils';
import type { PptxTheme } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import ThemeEditorPanel from './ThemeEditorPanel.vue';

const theme = {
	name: 'My Theme',
	colorScheme: {
		dk1: '#111111',
		lt1: '#ffffff',
		dk2: '#222222',
		lt2: '#eeeeee',
		accent1: '#4472c4',
		accent2: '#ed7d31',
		accent3: '#a5a5a5',
		accent4: '#ffc000',
		accent5: '#5b9bd5',
		accent6: '#70ad47',
		hlink: '#0563c1',
		folHlink: '#954f72',
	},
	fontScheme: { majorFont: { latin: 'Georgia' }, minorFont: { latin: 'Verdana' } },
} as unknown as PptxTheme;

describe('themeEditorPanel', () => {
	it('renders 12 colour slots + fonts seeded from the theme', () => {
		const wrapper = mount(ThemeEditorPanel, { props: { theme, canEdit: true } });
		expect(wrapper.findAll('input[type="color"]')).toHaveLength(12);
		expect((wrapper.find('input[type="text"]').element as HTMLInputElement).value).toBe('My Theme');
	});

	it('emits apply with the edited colour scheme, fonts, and name', async () => {
		const wrapper = mount(ThemeEditorPanel, { props: { theme, canEdit: true } });
		await wrapper.find('button[aria-label="Close"]').exists();
		const applyBtn = wrapper
			.findAll('button')
			.find((b) => b.text().includes('Apply to Presentation'))!;
		await applyBtn.trigger('click');
		const payload = wrapper.emitted('apply')?.[0]?.[0] as {
			colorScheme: { accent1: string };
			fontScheme: { majorFont: { latin: string } };
			name: string;
		};
		expect(payload.name).toBe('My Theme');
		expect(payload.colorScheme.accent1).toBe('#4472c4');
		expect(payload.fontScheme.majorFont.latin).toBe('Georgia');
	});

	it('emits close from the header button', async () => {
		const wrapper = mount(ThemeEditorPanel, { props: { theme, canEdit: true } });
		await wrapper.get('button[aria-label="Close"]').trigger('click');
		expect(wrapper.emitted('close')).toHaveLength(1);
	});
});
