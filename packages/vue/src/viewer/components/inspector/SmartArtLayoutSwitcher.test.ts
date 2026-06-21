import { mount } from '@vue/test-utils';
import { SWITCHABLE_LAYOUT_TYPES } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import SmartArtLayoutSwitcher from './SmartArtLayoutSwitcher.vue';

describe('smartArtLayoutSwitcher', () => {
	it('renders one tile per switchable layout type', () => {
		const wrapper = mount(SmartArtLayoutSwitcher, {
			props: { current: 'list', canEdit: true },
		});
		expect(wrapper.findAll('[data-testid^="smartart-layout-"]')).toHaveLength(
			SWITCHABLE_LAYOUT_TYPES.length,
		);
	});

	it('marks the current layout tile as pressed', () => {
		const wrapper = mount(SmartArtLayoutSwitcher, {
			props: { current: 'cycle', canEdit: true },
		});
		const tile = wrapper.get('[data-testid="smartart-layout-cycle"]');
		expect(tile.attributes('aria-pressed')).toBe('true');
		expect(wrapper.get('[data-testid="smartart-layout-list"]').attributes('aria-pressed')).toBe(
			'false',
		);
	});

	it('emits switch with the clicked layout', async () => {
		const wrapper = mount(SmartArtLayoutSwitcher, {
			props: { current: 'list', canEdit: true },
		});
		await wrapper.get('[data-testid="smartart-layout-process"]').trigger('click');
		expect(wrapper.emitted('switch')?.[0]).toStrictEqual(['process']);
	});

	it('does not emit when clicking the already-active layout', async () => {
		const wrapper = mount(SmartArtLayoutSwitcher, {
			props: { current: 'list', canEdit: true },
		});
		await wrapper.get('[data-testid="smartart-layout-list"]').trigger('click');
		expect(wrapper.emitted('switch')).toBeUndefined();
	});

	it('disables tiles and does not emit when not editable', async () => {
		const wrapper = mount(SmartArtLayoutSwitcher, {
			props: { current: 'list', canEdit: false },
		});
		const tile = wrapper.get('[data-testid="smartart-layout-cycle"]');
		expect((tile.element as HTMLButtonElement).disabled).toBeTruthy();
		await tile.trigger('click');
		expect(wrapper.emitted('switch')).toBeUndefined();
	});
});
