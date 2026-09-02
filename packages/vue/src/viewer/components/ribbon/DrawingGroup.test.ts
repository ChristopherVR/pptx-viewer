import { mount } from '@vue/test-utils';
import type { PptxElement } from 'pptx-viewer-core';
import { RIBBON_SHAPE_SWATCHES } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

import { RecentColorsKey } from '../../composables/recent-colors-context';
import DrawingGroup from './DrawingGroup.vue';

/**
 * DrawingGroup: the ribbon Home "Drawing" group (Shape Fill / Shape Outline
 * swatch popovers, wave-4 B6 "Recent colours" parity, surface A5). Both
 * popovers should offer the injected recent-colours row and push every
 * committed colour onto it, mirroring `RIBBON_SHAPE_SWATCHES`.
 */
function shape(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		id: 's1',
		type: 'shape',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		...overrides,
	} as PptxElement;
}

function mountGroup(global?: Record<string, unknown>) {
	return mount(DrawingGroup, {
		props: {
			canEdit: true,
			selectedElement: shape(),
			newShapeType: 'rect',
			onSetNewShapeType: vi.fn(),
			onAddShape: vi.fn(),
			onMoveLayer: vi.fn(),
			onMoveLayerToEdge: vi.fn(),
			onUpdateElementStyle: vi.fn(),
		},
		...(global ? { global } : {}),
	});
}

describe('drawingGroup recent colours (fill + outline popovers)', () => {
	it('shows the recent-colours row inside the Shape Fill popover once opened', async () => {
		const recent = ref<string[]>(['#112233']);
		const wrapper = mountGroup({
			provide: { [RecentColorsKey as symbol]: { recent, push: () => {} } },
		});

		await wrapper.get('[title="Shape Fill"]').trigger('click');
		expect(wrapper.find('[data-testid="pptx-color-recent"]').exists()).toBeTruthy();
	});

	it('picking a preset fill swatch pushes it onto the recent-colours list', async () => {
		const recent = ref<string[]>([]);
		const push = (hex: string): void => {
			recent.value = [hex, ...recent.value.filter((c) => c !== hex)];
		};
		const wrapper = mountGroup({
			provide: { [RecentColorsKey as symbol]: { recent, push } },
		});

		await wrapper.get('[title="Shape Fill"]').trigger('click');
		const swatch = wrapper.get(`[aria-label="Fill colour ${RIBBON_SHAPE_SWATCHES[0]}"]`);
		await swatch.trigger('click');

		expect(recent.value[0]).toBe(RIBBON_SHAPE_SWATCHES[0]);
	});

	it('clicking a recent swatch in the Shape Outline popover applies it and re-pushes it to the front', async () => {
		const recent = ref<string[]>(['#112233', '#445566']);
		const push = (hex: string): void => {
			recent.value = [hex, ...recent.value.filter((c) => c !== hex)];
		};
		const wrapper = mountGroup({ provide: { [RecentColorsKey as symbol]: { recent, push } } });

		await wrapper.get('[title="Shape Outline"]').trigger('click');
		const recentSwatch = wrapper.findAll('[data-testid="pptx-color-recent"] button')[1];
		await recentSwatch.trigger('click');

		expect(recent.value[0]).toBe('#445566');
	});

	it('renders no recent-colours row without an injected controller', async () => {
		const wrapper = mountGroup();
		await wrapper.get('[title="Shape Fill"]').trigger('click');
		expect(wrapper.find('[data-testid="pptx-color-recent"]').exists()).toBeFalsy();
	});
});
