import { mount } from '@vue/test-utils';
import type { VueWrapper } from '@vue/test-utils';
import type { PptxElement } from 'pptx-viewer-core';
import { isRibbonControlId, isRibbonGroupId, TOOLBAR_TABS } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';

import { createRibbonPropsFixture } from './ribbon-props-fixture';
import type { RibbonProps, ToolbarSection } from './ribbon-types';
import RibbonToolbar from './RibbonToolbar.vue';

/**
 * The ribbon's gallery placements, contextual tabs and catalogue tagging.
 * Placement and visibility are decided in shared; these guard the Vue view
 * layer that maps them (the failure mode is template wiring no shared test
 * can see).
 */
function shape(): PptxElement {
	return {
		id: 's1',
		type: 'shape',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		shapeType: 'rect',
		shapeStyle: { fillColor: '#FF0000' },
	} as unknown as PptxElement;
}

function mountRibbon(overrides: Partial<RibbonProps> = {}): VueWrapper {
	return mount(RibbonToolbar, { props: createRibbonPropsFixture(overrides) });
}

function attrValues(wrapper: VueWrapper, attr: string): string[] {
	return wrapper.findAll(`[${attr}]`).map((el) => el.attributes(attr) ?? '');
}

describe('ribbonToolbar contextual tabs', () => {
	it('shows Shape Format for a shape selection and falls back to Home without one', async () => {
		const onSetToolbarSection = vi.fn();
		const wrapper = mountRibbon({ selectedElement: shape(), onSetToolbarSection });
		const tab = wrapper.get('[data-ribbon-contextual-tab="shapeFormat"]');
		expect(tab.text()).toBe('Shape Format');
		await tab.trigger('click');
		expect(onSetToolbarSection).toHaveBeenCalledWith('shapeFormat');

		await wrapper.setProps({ toolbarSection: 'shapeFormat' });
		expect(tab.attributes('aria-selected')).toBe('true');
		expect(wrapper.find('[data-ribbon-group="shapeFormat.shapeStyles"]').exists()).toBeTruthy();
		expect(
			wrapper.find('[data-ribbon-control="shapeFormat.shapeStyles.gallery"]').exists(),
		).toBeTruthy();
		expect(wrapper.find('[data-ribbon-group="shapeFormat.wordArtStyles"]').exists()).toBeTruthy();

		onSetToolbarSection.mockClear();
		await wrapper.setProps({ selectedElement: null });
		expect(wrapper.find('[data-ribbon-contextual-tab]').exists()).toBeFalsy();
		expect(onSetToolbarSection).toHaveBeenCalledWith('home');
		expect(wrapper.find('[data-ribbon-group="home.clipboard"]').exists()).toBeTruthy();
		expect(wrapper.find('[data-ribbon-group="shapeFormat.shapeStyles"]').exists()).toBeFalsy();
	});

	it('does not switch to a contextual tab on selection by itself', () => {
		const onSetToolbarSection = vi.fn();
		mountRibbon({ selectedElement: shape(), onSetToolbarSection });
		expect(onSetToolbarSection).not.toHaveBeenCalled();
	});
});

describe('ribbonToolbar fixed-tab galleries', () => {
	it('replaces the Shape Effects placeholder with the Shape Effects gallery', () => {
		const wrapper = mountRibbon({ selectedElement: shape() });
		expect(wrapper.find('[title="Shape Effects (not available)"]').exists()).toBeFalsy();
		const effects = wrapper.get('[data-ribbon-control="home.drawing.shapeEffects"]');
		expect(effects.find('[data-ribbon-gallery="shapeEffects"]').exists()).toBeTruthy();
		const quick = wrapper.get('[data-ribbon-control="home.drawing.quickStyles"]');
		expect(quick.find('[data-ribbon-gallery="shapeStyles"]').exists()).toBeTruthy();
	});

	it('puts the Bullets / Numbering library chevrons beside their toggles', () => {
		const wrapper = mountRibbon();
		for (const kind of ['bullets', 'numbering']) {
			const control = wrapper.get(`[data-ribbon-control="home.paragraph.${kind}"]`);
			expect(control.find('button[aria-pressed]').exists()).toBeTruthy();
			expect(control.find(`[data-ribbon-gallery="${kind}"]`).exists()).toBeTruthy();
		}
	});

	it('adds the Design > Variants group with the Colors and Fonts galleries', () => {
		const wrapper = mountRibbon({ toolbarSection: 'design' });
		const group = wrapper.get('[data-ribbon-group="design.variants"]');
		expect(group.text()).toContain('Variants');
		expect(
			group
				.find('[data-ribbon-control="design.variants.colors"] [data-ribbon-gallery="themeColors"]')
				.exists(),
		).toBeTruthy();
		expect(
			group
				.find('[data-ribbon-control="design.variants.fonts"] [data-ribbon-gallery="themeFonts"]')
				.exists(),
		).toBeTruthy();
	});
});

describe('ribbonToolbar catalogue tagging', () => {
	it('tags the Home tab groups', () => {
		const groups = new Set(attrValues(mountRibbon(), 'data-ribbon-group'));
		for (const id of [
			'clipboard',
			'slides',
			'font',
			'paragraph',
			'drawing',
			'arrange',
			'editing',
		]) {
			expect(groups.has(`home.${id}`)).toBeTruthy();
		}
	});

	it('only ever uses catalogued group and control ids, on every tab', () => {
		const sections: ToolbarSection[] = [
			...TOOLBAR_TABS.map((tab) => tab.id).filter((id) => id !== 'file'),
			'shapeFormat',
		];
		for (const toolbarSection of sections) {
			const wrapper = mountRibbon({ toolbarSection, selectedElement: shape() });
			for (const id of attrValues(wrapper, 'data-ribbon-group')) {
				expect(isRibbonGroupId(id), `${toolbarSection}: group ${id}`).toBeTruthy();
			}
			for (const id of attrValues(wrapper, 'data-ribbon-control')) {
				expect(isRibbonControlId(id), `${toolbarSection}: control ${id}`).toBeTruthy();
			}
			wrapper.unmount();
		}
	});
});
