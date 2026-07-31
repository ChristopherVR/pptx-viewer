import { mount } from '@vue/test-utils';
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { translationsEn } from '../../i18n';
import MotionPathOverlay from './MotionPathOverlay.vue';

/** A 200x120 shape whose centre lands at (640, 360) on a 1280x720 stage. */
const ELEMENT = {
	id: 'el-1',
	type: 'shape',
	x: 540,
	y: 300,
	width: 200,
	height: 120,
} as unknown as PptxElement;

const CANVAS = { width: 1280, height: 720 };

function mountOverlay(path: string, overrides: Record<string, unknown> = {}) {
	return mount(MotionPathOverlay, {
		props: { element: ELEMENT, path, canvasSize: CANVAS, scale: 1, canEdit: true, ...overrides },
	});
}

/**
 * MotionPathOverlay: the on-canvas path preview and its draggable end point.
 *
 * The geometry assertions are in unscaled SLIDE pixels because the overlay is a
 * sibling inside the scaled stage: the stage's CSS transform applies the zoom,
 * so anything the overlay multiplies by the zoom itself would be applied twice.
 */
describe('motionPathOverlay', () => {
	it('draws the path from the element centre in slide pixels', () => {
		const d = mountOverlay('M 0 0 L 0.25 0').get('path').attributes('d');
		// Centre is (540 + 100, 300 + 60) = (640, 360); +0.25 * 1280 = 960.
		expect(d).toBe('M 640 360 L 640 360 L 960 360');
	});

	it('places the end handle at the path end', () => {
		const handle = mountOverlay('M 0 0 L 0.25 0').get('[data-pptx-motion-path-handle="end"]');
		expect(handle.attributes('cx')).toBe('960');
		expect(handle.attributes('cy')).toBe('360');
	});

	it('names the overlay and its handle for assistive technology', () => {
		const wrapper = mountOverlay('M 0 0 L 0.25 0');
		const svg = wrapper.get('[data-pptx-motion-path-overlay="true"]');
		expect(svg.attributes('role')).toBe('img');
		expect(svg.attributes('aria-label')).toBe(translationsEn['pptx.animation.motionPath.overlay']);
		expect(wrapper.get('[data-pptx-motion-path-handle="end"]').attributes('aria-label')).toBe(
			translationsEn['pptx.animation.motionPath.endHandle'],
		);
	});

	it('renders nothing for an unparseable path', () => {
		expect(mountOverlay('').find('svg').exists()).toBeFalsy();
	});

	it('leaves the handle inert on a closed shape path (no free end)', () => {
		const wrapper = mountOverlay('M 0 0 L 0.125 0 L 0.125 -0.2222 Z');
		const handle = wrapper.get('[data-pptx-motion-path-handle="end"]');
		expect(handle.classes()).not.toContain('pointer-events-auto');
	});

	it('leaves the handle inert when editing is not allowed', () => {
		const wrapper = mountOverlay('M 0 0 L 0.25 0', { canEdit: false });
		expect(wrapper.get('[data-pptx-motion-path-handle="end"]').classes()).not.toContain(
			'pointer-events-auto',
		);
	});

	it('commits a retargeted path while the end handle is dragged', async () => {
		const wrapper = mountOverlay('M 0 0 L 0.25 0');
		const handle = wrapper.get('[data-pptx-motion-path-handle="end"]');

		await handle.trigger('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 });
		await handle.trigger('pointermove', { pointerId: 1, clientX: 128, clientY: 72 });

		// +128px of 1280 == +0.1 fraction; +72px of 720 == +0.1 fraction.
		expect(wrapper.emitted('changePath')).toStrictEqual([['M 0 0 L 0.35 0.1']]);
	});

	/** The stage applies the zoom, so a pointer delta must be divided back out. */
	it('converts the pointer delta by the editor zoom', async () => {
		const wrapper = mountOverlay('M 0 0 L 0.25 0', { scale: 2 });
		const handle = wrapper.get('[data-pptx-motion-path-handle="end"]');

		await handle.trigger('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 });
		await handle.trigger('pointermove', { pointerId: 1, clientX: 256, clientY: 0 });

		expect(wrapper.emitted('changePath')).toStrictEqual([['M 0 0 L 0.35 0']]);
	});

	it('ignores a drag it never accepted (inert handle, or a second pointer)', async () => {
		const wrapper = mountOverlay('M 0 0 L 0.25 0', { canEdit: false });
		const handle = wrapper.get('[data-pptx-motion-path-handle="end"]');

		await handle.trigger('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 });
		await handle.trigger('pointermove', { pointerId: 1, clientX: 128, clientY: 72 });

		expect(wrapper.emitted('changePath')).toBeUndefined();
	});

	it('stops committing once the pointer is released', async () => {
		const wrapper = mountOverlay('M 0 0 L 0.25 0');
		const handle = wrapper.get('[data-pptx-motion-path-handle="end"]');

		await handle.trigger('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 });
		await handle.trigger('pointerup', { pointerId: 1, clientX: 0, clientY: 0 });
		await handle.trigger('pointermove', { pointerId: 1, clientX: 128, clientY: 0 });

		expect(wrapper.emitted('changePath')).toBeUndefined();
	});
});
