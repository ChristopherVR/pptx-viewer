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

/**
 * The tile captions used to come from a private English map with a title-case
 * fallback, so an unmapped layout rendered its raw wire token. They now resolve
 * the shared `pptx.smartart.category.*` catalogue, which is the same source
 * React's switcher uses, so the two bindings read identically.
 */
describe('smartArtLayoutSwitcher - category labels', () => {
	it('spells every switchable layout from the shared catalogue', () => {
		const wrapper = mount(SmartArtLayoutSwitcher, {
			props: { current: 'list', canEdit: true },
		});
		const captions = Object.fromEntries(
			SWITCHABLE_LAYOUT_TYPES.map((layout) => [
				layout,
				wrapper.get(`[data-testid="smartart-layout-${layout}"]`).text(),
			]),
		);

		expect(captions.list).toBe('List');
		expect(captions.hierarchy).toBe('Hierarchy');
		expect(captions.bending).toBe('Bending');
		expect(captions.venn).toBe('Venn');
		// No tile may fall back to its raw token.
		for (const layout of SWITCHABLE_LAYOUT_TYPES) {
			expect(captions[layout]).not.toBe(layout);
		}
	});

	it('keeps the tile title in step with its caption', () => {
		const wrapper = mount(SmartArtLayoutSwitcher, {
			props: { current: 'list', canEdit: true },
		});
		const tile = wrapper.get('[data-testid="smartart-layout-timeline"]');
		expect(tile.attributes('title')).toBe('Timeline');
		expect(tile.text()).toBe('Timeline');
	});
});
