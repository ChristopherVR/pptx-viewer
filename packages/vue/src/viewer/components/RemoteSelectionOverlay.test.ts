import { mount } from '@vue/test-utils';
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import type { RemotePresence } from '../composables/useCollaboration';
import RemoteSelectionOverlay from './RemoteSelectionOverlay.vue';

function el(id: string, x: number, y: number, width: number, height: number): PptxElement {
	return { id, type: 'shape', x, y, width, height } as unknown as PptxElement;
}

function presence(over: Partial<RemotePresence>): RemotePresence {
	return {
		clientId: 1,
		userName: 'Ada',
		color: '#ff0000',
		selectionIds: [],
		activeSlide: 0,
		...over,
	};
}

const elements = [el('a', 10, 20, 100, 50), el('b', 200, 100, 80, 40)];

function mountOverlay(
	presences: RemotePresence[],
	activeSlideIndex = 0,
	zoom = 1,
	els: PptxElement[] = elements,
) {
	return mount(RemoteSelectionOverlay, {
		props: { presences, elements: els, activeSlideIndex, zoom },
	});
}

describe('remoteSelectionOverlay', () => {
	it('draws a box per resolved selected element on the active slide', () => {
		const wrapper = mountOverlay([
			presence({ clientId: 2, userName: 'Bob', selectionIds: ['a', 'b'], activeSlide: 0 }),
		]);
		expect(wrapper.findAll('.pptx-vue-remote-selection')).toHaveLength(2);
	});

	it('renders nothing when no peers have selections', () => {
		const wrapper = mountOverlay([presence({ clientId: 2, selectionIds: [] })]);
		expect(wrapper.findAll('.pptx-vue-remote-selection')).toHaveLength(0);
	});

	it('ignores peers on a different slide', () => {
		const wrapper = mountOverlay(
			[presence({ clientId: 2, selectionIds: ['a'], activeSlide: 1 })],
			0,
		);
		expect(wrapper.findAll('.pptx-vue-remote-selection')).toHaveLength(0);
	});

	it('ignores selected ids that do not resolve to an element', () => {
		const wrapper = mountOverlay([
			presence({ clientId: 2, selectionIds: ['a', 'missing'], activeSlide: 0 }),
		]);
		expect(wrapper.findAll('.pptx-vue-remote-selection')).toHaveLength(1);
	});

	it('positions and sizes the box at raw slide geometry at zoom 1', () => {
		const wrapper = mountOverlay([presence({ clientId: 2, selectionIds: ['a'] })]);
		const box = wrapper.get('.pptx-vue-remote-selection');
		const style = box.attributes('style') ?? '';
		expect(style).toContain('translate(10px, 20px)');
		expect(style).toContain('width: 100px');
		expect(style).toContain('height: 50px');
	});

	it('scales geometry with zoom', () => {
		const wrapper = mountOverlay([presence({ clientId: 2, selectionIds: ['a'] })], 0, 2);
		const box = wrapper.get('.pptx-vue-remote-selection');
		const style = box.attributes('style') ?? '';
		expect(style).toContain('translate(20px, 40px)');
		expect(style).toContain('width: 200px');
		expect(style).toContain('height: 100px');
	});

	it('labels each box with the peer name and applies the peer color', () => {
		const wrapper = mountOverlay([
			presence({ clientId: 2, userName: 'Grace', color: 'rgb(0, 128, 0)', selectionIds: ['a'] }),
		]);
		const label = wrapper.get('.pptx-vue-remote-selection-label');
		expect(label.text()).toBe('Grace');
		expect(label.attributes('style')).toContain('background-color: rgb(0, 128, 0)');
	});

	it('does not intercept pointer events on the overlay', () => {
		const wrapper = mountOverlay([presence({ clientId: 2, selectionIds: ['a'] })]);
		const overlay = wrapper.get('.pptx-vue-remote-selections');
		expect(overlay.attributes('aria-hidden')).toBe('true');
	});
});
