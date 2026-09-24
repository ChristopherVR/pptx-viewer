import { mount } from '@vue/test-utils';
import type { MediaPptxElement, PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';
import { defineComponent, h, nextTick, ref } from 'vue';

import { useMediaFullscreen } from './useMediaFullscreen';

// Alias keeps the composable out of a `use*`-named call site inside the
// component-literal `setup()` below, which the react-hooks linter otherwise
// flags as a rules-of-hooks false positive (same idiom as
// `use-color-change-image.test.ts`'s `runColorChange`).
const runMediaFullscreen = useMediaFullscreen;

function makeMedia(overrides: Partial<MediaPptxElement> = {}): PptxElement {
	return {
		type: 'media',
		id: 'media_1',
		x: 0,
		y: 0,
		width: 320,
		height: 180,
		mediaType: 'video',
		...overrides,
	} as MediaPptxElement;
}

/**
 * Host component exercising `useMediaFullscreen` against a real mounted
 * `<video>`, since the composable's play/pause tracking depends on native
 * DOM event listeners.
 */
function mountHost(element: PptxElement, presenting: boolean) {
	const host = defineComponent({
		setup() {
			const el = ref<HTMLVideoElement | null>(null);
			const fullscreen = runMediaFullscreen(
				() => element,
				() => el.value,
				() => presenting,
			);
			return () =>
				h('div', [
					h('video', { ref: el }),
					h('span', { class: 'active' }, String(fullscreen.active.value)),
					h('span', { class: 'aria' }, fullscreen.stopAriaLabel.value),
				]);
		},
	});
	return mount(host);
}

describe('useMediaFullscreen', () => {
	it('is inactive before playback starts', () => {
		const wrapper = mountHost(makeMedia({ fullScreen: true }), true);
		expect(wrapper.get('.active').text()).toBe('false');
	});

	it('becomes active once the mounted video starts playing', async () => {
		const wrapper = mountHost(makeMedia({ fullScreen: true }), true);
		await nextTick(); // let the composable's watch attach its play/pause listeners
		wrapper.find('video').element.dispatchEvent(new Event('play'));
		await nextTick();
		expect(wrapper.get('.active').text()).toBe('true');
	});

	it('drops back to inactive on pause', async () => {
		const wrapper = mountHost(makeMedia({ fullScreen: true }), true);
		await nextTick();
		const video = wrapper.find('video').element;
		video.dispatchEvent(new Event('play'));
		await nextTick();
		video.dispatchEvent(new Event('pause'));
		await nextTick();
		expect(wrapper.get('.active').text()).toBe('false');
	});

	it('never activates off the live show stage', async () => {
		const wrapper = mountHost(makeMedia({ fullScreen: true }), false);
		await nextTick();
		wrapper.find('video').element.dispatchEvent(new Event('play'));
		await nextTick();
		expect(wrapper.get('.active').text()).toBe('false');
	});

	it('never activates for media not authored fullScrn', async () => {
		const wrapper = mountHost(makeMedia({ fullScreen: false }), true);
		await nextTick();
		wrapper.find('video').element.dispatchEvent(new Event('play'));
		await nextTick();
		expect(wrapper.get('.active').text()).toBe('false');
	});

	it('exposes the translated stop aria label', () => {
		const wrapper = mountHost(makeMedia({ fullScreen: true }), true);
		expect(wrapper.get('.aria').text()).toBe('Stop full-screen playback');
	});
});
