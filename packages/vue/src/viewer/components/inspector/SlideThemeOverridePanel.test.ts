import { mount } from '@vue/test-utils';
import type { PptxSlide } from 'pptx-viewer-core';
import { COLOR_MAP_ALIAS_KEYS, DEFAULT_COLOR_MAP } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import SlideThemeOverridePanel from './SlideThemeOverridePanel.vue';

function slide(over: Partial<PptxSlide> = {}): PptxSlide {
	return { id: 's1', elements: [], ...over } as PptxSlide;
}

describe('slideThemeOverridePanel', () => {
	it('shows only the toggle (off) when no override is set', () => {
		const wrapper = mount(SlideThemeOverridePanel, { props: { slide: slide() } });
		expect((wrapper.get('input[type="checkbox"]').element as HTMLInputElement).checked).toBeFalsy();
		expect(wrapper.findAll('select')).toHaveLength(0);
	});

	it('enables an identity override when toggled on', async () => {
		const wrapper = mount(SlideThemeOverridePanel, { props: { slide: slide() } });
		await wrapper.get('input[type="checkbox"]').setValue(true);
		const patch = wrapper.emitted('update')?.[0]?.[0] as Partial<PptxSlide>;
		expect(patch.clrMapOverride).toBeDefined();
		// Identity map: every alias maps to its default slot.
		for (const key of COLOR_MAP_ALIAS_KEYS) {
			expect(patch.clrMapOverride?.[key]).toBe(DEFAULT_COLOR_MAP[key]);
		}
	});

	it('clears the override when toggled off', async () => {
		const active: Record<string, string> = { ...DEFAULT_COLOR_MAP, bg1: 'dk1' };
		const wrapper = mount(SlideThemeOverridePanel, {
			props: { slide: slide({ clrMapOverride: active }) },
		});
		await wrapper.get('input[type="checkbox"]').setValue(false);
		expect(wrapper.emitted('update')?.at(-1)?.[0]).toStrictEqual(
			[{ clrMapOverride: undefined }][0],
		);
	});

	it('renders an alias row per colour-map key when active and remaps on select', async () => {
		// A non-trivial override (one alias differs from default) keeps the rows
		// visible: hasNonTrivialOverride treats an identity map as inactive.
		const active: Record<string, string> = { ...DEFAULT_COLOR_MAP, tx1: 'dk2' };
		const wrapper = mount(SlideThemeOverridePanel, {
			props: { slide: slide({ clrMapOverride: active }) },
		});
		const selects = wrapper.findAll('select');
		expect(selects).toHaveLength(COLOR_MAP_ALIAS_KEYS.length);

		await selects[0].setValue('dk2');
		const patch = wrapper.emitted('update')?.at(-1)?.[0] as Partial<PptxSlide>;
		expect(patch.clrMapOverride?.[COLOR_MAP_ALIAS_KEYS[0]]).toBe('dk2');
		// Other aliases keep their existing values (defaults filled where missing).
		expect(patch.clrMapOverride?.[COLOR_MAP_ALIAS_KEYS[1]]).toBeDefined();
	});
});
