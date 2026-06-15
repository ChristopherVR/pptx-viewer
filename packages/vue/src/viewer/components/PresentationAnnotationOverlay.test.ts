import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import type { AnnotationStroke, PresentationTool } from '../composables/usePresentationAnnotations';
import type { CanvasSize } from '../types';
import PresentationAnnotationOverlay from './PresentationAnnotationOverlay.vue';

const canvasSize: CanvasSize = { width: 960, height: 540 };

const stroke: AnnotationStroke = {
	id: 's1',
	points: [
		{ x: 0, y: 0 },
		{ x: 10, y: 10 },
	],
	color: '#ff0000',
	width: 2.5,
	opacity: 1,
};

function mountOverlay(props: Partial<Record<string, unknown>> = {}) {
	return mount(PresentationAnnotationOverlay, {
		props: {
			canvasSize,
			editorScale: 1,
			presentationTool: 'pen' as PresentationTool,
			annotationStrokes: [stroke],
			currentStroke: null,
			laserPosition: null,
			...props,
		},
		attachTo: document.body,
	});
}

describe('presentationAnnotationOverlay', () => {
	it('renders nothing when the tool is none', () => {
		const wrapper = mount(PresentationAnnotationOverlay, {
			props: {
				canvasSize,
				editorScale: 1,
				presentationTool: 'none' as PresentationTool,
				annotationStrokes: [],
				currentStroke: null,
				laserPosition: null,
			},
		});
		expect(wrapper.find('.pptx-vue-annotation-overlay').exists()).toBeFalsy();
	});

	it('renders one path per stroke', () => {
		const wrapper = mountOverlay();
		const paths = wrapper.findAll('path');
		expect(paths).toHaveLength(1);
		expect(paths[0]?.attributes('d')).toBe('M 0 0 L 10 10');
		expect(paths[0]?.attributes('stroke')).toBe('#ff0000');
	});

	it('includes the in-progress current stroke', () => {
		const wrapper = mountOverlay({
			currentStroke: { ...stroke, id: 'cur' },
		});
		expect(wrapper.findAll('path')).toHaveLength(2);
	});

	it('emits pointer-down in slide coordinates (scaled)', async () => {
		const wrapper = mountOverlay({ editorScale: 2 });
		// happy-dom getBoundingClientRect returns zeros, so client coords / scale.
		await wrapper.find('svg').trigger('pointerdown', { clientX: 20, clientY: 40 });
		const ev = wrapper.emitted('pointer-down');
		expect(ev?.[0]).toStrictEqual([10, 20]);
	});

	it('emits erase events for the eraser tool', async () => {
		const wrapper = mountOverlay({ presentationTool: 'eraser' });
		await wrapper.find('svg').trigger('pointerdown', { clientX: 5, clientY: 5 });
		expect(wrapper.emitted('erase')?.[0]).toStrictEqual([5, 5]);
	});

	it('emits laser-move for the laser tool and shows the dot', async () => {
		const wrapper = mountOverlay({
			presentationTool: 'laser',
			laserPosition: { x: 100, y: 100 },
		});
		await wrapper.find('svg').trigger('pointermove', { clientX: 30, clientY: 40 });
		expect(wrapper.emitted('laser-move')?.[0]).toStrictEqual([30, 40]);
		expect(wrapper.find('.pptx-vue-annotation-laser').exists()).toBeTruthy();
	});

	it('emits pointer-up on pointerup', async () => {
		const wrapper = mountOverlay();
		await wrapper.find('svg').trigger('pointerup', { clientX: 0, clientY: 0 });
		expect(wrapper.emitted('pointer-up')).toHaveLength(1);
	});
});
