// oxlint-disable react-hooks/rules-of-hooks
import { mount } from '@vue/test-utils';
import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { PATTERN_PRESET_OPTIONS } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import FillPatternControls from './FillPatternControls.vue';

function shape(shapeStyle: ShapeStyle = {}): PptxElement {
	return {
		type: 'shape',
		id: 'sp 1',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		shapeStyle,
	} as PptxElement;
}

function lastPatch(wrapper: ReturnType<typeof mount>): { shapeStyle: ShapeStyle } {
	const events = wrapper.emitted('update');
	expect(events).toBeTruthy();
	const ev = events as unknown[][];
	return ev[ev.length - 1][0] as { shapeStyle: ShapeStyle };
}

describe('fillPatternControls', () => {
	it('renders every shared PATTERN_PRESET_OPTIONS entry as a swatch', () => {
		const wrapper = mount(FillPatternControls, { props: { element: shape() } });
		expect(wrapper.findAll('[data-testid="fx-pattern-swatch"]')).toHaveLength(
			PATTERN_PRESET_OPTIONS.length,
		);
	});

	it('selecting a swatch patches fillPatternPreset and activates fillMode: pattern', async () => {
		const wrapper = mount(FillPatternControls, {
			props: { element: shape({ fillColor: '#112233' }) },
		});
		const swatches = wrapper.findAll('[data-testid="fx-pattern-swatch"]');
		const target = PATTERN_PRESET_OPTIONS[3];
		await swatches[3].trigger('click');
		const style = lastPatch(wrapper).shapeStyle;
		expect(style.fillMode).toBe('pattern');
		expect(style.fillPatternPreset).toBe(target.value);
		// Unrelated existing fields survive the merge.
		expect(style.fillColor).toBe('#112233');
	});

	it('foreground colour maps to fillColor', async () => {
		const wrapper = mount(FillPatternControls, { props: { element: shape() } });
		const colorInputs = wrapper.findAll('input[type="color"]');
		await colorInputs[0].setValue('#abcdef');
		expect(lastPatch(wrapper).shapeStyle.fillColor).toBe('#abcdef');
	});

	it('background colour maps to fillPatternBackgroundColor', async () => {
		const wrapper = mount(FillPatternControls, { props: { element: shape() } });
		const colorInputs = wrapper.findAll('input[type="color"]');
		await colorInputs[1].setValue('#fedcba');
		expect(lastPatch(wrapper).shapeStyle.fillPatternBackgroundColor).toBe('#fedcba');
	});
});
