import { mount } from '@vue/test-utils';
import type { PptxElement } from 'pptx-viewer-core';
import { RIBBON_SHAPE_SWATCHES } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

import { RecentColorsKey } from '../../composables/recent-colors-context';
import { ThemeColorMapKey } from '../../composables/theme-color-map-context';
import DrawingGroup from './DrawingGroup.vue';

const OFFICE_THEME = {
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
	bg1: '#FFFFFF',
	tx1: '#000000',
	bg2: '#E7E6E6',
	tx2: '#44546A',
};

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

describe('drawingGroup theme colour grid (fill + outline popovers)', () => {
	it('commits both the resolved hex and the ref on a theme swatch click (fill)', async () => {
		const onUpdateElementStyle = vi.fn();
		const wrapper = mount(DrawingGroup, {
			props: {
				canEdit: true,
				selectedElement: shape(),
				newShapeType: 'rect',
				onSetNewShapeType: vi.fn(),
				onAddShape: vi.fn(),
				onMoveLayer: vi.fn(),
				onMoveLayerToEdge: vi.fn(),
				onUpdateElementStyle,
			},
			global: { provide: { [ThemeColorMapKey as symbol]: ref(OFFICE_THEME) } },
		});

		await wrapper.get('[title="Shape Fill"]').trigger('click');
		const accent1 = wrapper.get('button[title="Accent 1"]');
		await accent1.trigger('click');

		expect(onUpdateElementStyle).toHaveBeenCalledWith(
			expect.objectContaining({ fillColor: '#4472c4', fillColorRef: { scheme: 'accent1' } }),
		);
	});

	it('commits both the resolved hex and the ref on a theme swatch click (outline)', async () => {
		const onUpdateElementStyle = vi.fn();
		const wrapper = mount(DrawingGroup, {
			props: {
				canEdit: true,
				selectedElement: shape(),
				newShapeType: 'rect',
				onSetNewShapeType: vi.fn(),
				onAddShape: vi.fn(),
				onMoveLayer: vi.fn(),
				onMoveLayerToEdge: vi.fn(),
				onUpdateElementStyle,
			},
			global: { provide: { [ThemeColorMapKey as symbol]: ref(OFFICE_THEME) } },
		});

		await wrapper.get('[title="Shape Outline"]').trigger('click');
		const accent1 = wrapper.get('button[title="Accent 1"]');
		await accent1.trigger('click');

		expect(onUpdateElementStyle).toHaveBeenCalledWith(
			expect.objectContaining({ strokeColor: '#4472c4', strokeColorRef: { scheme: 'accent1' } }),
		);
	});

	it('clears the ref for a standard swatch click', async () => {
		const onUpdateElementStyle = vi.fn();
		const wrapper = mount(DrawingGroup, {
			props: {
				canEdit: true,
				selectedElement: shape(),
				newShapeType: 'rect',
				onSetNewShapeType: vi.fn(),
				onAddShape: vi.fn(),
				onMoveLayer: vi.fn(),
				onMoveLayerToEdge: vi.fn(),
				onUpdateElementStyle,
			},
			global: { provide: { [ThemeColorMapKey as symbol]: ref(OFFICE_THEME) } },
		});

		await wrapper.get('[title="Shape Fill"]').trigger('click');
		const standard = wrapper.get(`[aria-label="Fill colour ${RIBBON_SHAPE_SWATCHES[0]}"]`);
		await standard.trigger('click');

		expect(onUpdateElementStyle).toHaveBeenCalledWith(
			expect.objectContaining({ fillColorRef: undefined }),
		);
	});
});
