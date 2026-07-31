import { mount } from '@vue/test-utils';
import type { PptxSlide, PptxTheme } from 'pptx-viewer-core';
import { COLOR_MAP_ALIAS_KEYS, DEFAULT_COLOR_MAP } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import SlideThemeOverridePanel from './SlideThemeOverridePanel.vue';

function slide(over: Partial<PptxSlide> = {}): PptxSlide {
	return {
		id: 's1',
		elements: [
			{
				id: 'shape-1',
				type: 'shape',
				x: 0,
				y: 0,
				width: 100,
				height: 100,
				shapeStyle: { fillColor: '#4472C4' },
			},
		],
		...over,
	} as PptxSlide;
}

const theme: PptxTheme = {
	colorScheme: {
		dk1: '#000000',
		lt1: '#FFFFFF',
		dk2: '#44546A',
		lt2: '#E7E6E6',
		accent1: '#4472C4',
		accent2: '#ED7D31',
		accent3: '#A5A5A5',
		accent4: '#FFC000',
		accent5: '#5B9BD5',
		accent6: '#70AD47',
		hlink: '#0563C1',
		folHlink: '#954F72',
	},
};

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

	it('keeps an identity override enabled and visible', () => {
		const wrapper = mount(SlideThemeOverridePanel, {
			props: { slide: slide({ clrMapOverride: { ...DEFAULT_COLOR_MAP } }) },
		});
		expect(
			(wrapper.get('input[type="checkbox"]').element as HTMLInputElement).checked,
		).toBeTruthy();
		expect(wrapper.findAll('select')).toHaveLength(COLOR_MAP_ALIAS_KEYS.length);
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

	/**
	 * The target-slot select used to print the raw `a:clrScheme` slot names
	 * (`dk1`, `folHlink`). Text and value are asserted separately on purpose: the
	 * value is written straight into `clrMapOverride`, so it must stay the wire
	 * token even though the text is now translated.
	 */
	it('spells the theme-colour slots but keeps their wire values', () => {
		const wrapper = mount(SlideThemeOverridePanel, {
			props: { slide: slide({ clrMapOverride: { ...DEFAULT_COLOR_MAP } }), theme },
		});
		const options = wrapper.findAll('select')[0].findAll('option');

		expect(options.map((o) => (o.element as HTMLOptionElement).value)).toStrictEqual([
			'dk1',
			'lt1',
			'dk2',
			'lt2',
			'accent1',
			'accent2',
			'accent3',
			'accent4',
			'accent5',
			'accent6',
			'hlink',
			'folHlink',
		]);
		expect(options.map((o) => o.text())).toStrictEqual([
			'Dark 1',
			'Light 1',
			'Dark 2',
			'Light 2',
			'Accent 1',
			'Accent 2',
			'Accent 3',
			'Accent 4',
			'Accent 5',
			'Accent 6',
			'Hyperlink',
			'Followed Hyperlink',
		]);
	});

	it('renders an alias row per colour-map key when active and remaps on select', async () => {
		const active: Record<string, string> = { ...DEFAULT_COLOR_MAP, tx1: 'dk2' };
		const wrapper = mount(SlideThemeOverridePanel, {
			props: { slide: slide({ clrMapOverride: active }), theme },
		});
		const selects = wrapper.findAll('select');
		expect(selects).toHaveLength(COLOR_MAP_ALIAS_KEYS.length);

		await selects[4].setValue('accent2');
		const patch = wrapper.emitted('update')?.at(-1)?.[0] as Partial<PptxSlide>;
		expect(patch.clrMapOverride?.accent1).toBe('accent2');
		// Other aliases keep their existing values (defaults filled where missing).
		expect(patch.clrMapOverride?.[COLOR_MAP_ALIAS_KEYS[1]]).toBeDefined();
		const shape = patch.elements?.[0] as { shapeStyle?: { fillColor?: string } };
		expect(shape.shapeStyle?.fillColor).toBe('#ED7D31');
	});
});
