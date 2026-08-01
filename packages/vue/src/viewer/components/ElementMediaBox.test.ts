import { mount } from '@vue/test-utils';
import type { MediaPptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';
import { nextTick } from 'vue';

import ElementMediaBox from './ElementMediaBox.vue';

function makeMedia(overrides: Partial<MediaPptxElement> = {}): MediaPptxElement {
	return {
		type: 'media',
		id: 'media_1',
		x: 0,
		y: 0,
		width: 320,
		height: 180,
		mediaType: 'video',
		mediaData: 'data:video/mp4;base64,AAAA',
		...overrides,
	};
}

function mountMedia(element: MediaPptxElement) {
	return mount(ElementMediaBox, {
		props: { element, mediaDataUrls: new Map<string, string>(), zIndex: 1 },
	});
}

describe('elementMediaBox playback settings', () => {
	it("honours the deck's authored volume and playback speed", async () => {
		// solution-explorer.pptx slide 2 authors vol="0"; Vue played it at full
		// volume because volume/playbackRate are IDL-only and were never applied.
		const wrapper = mountMedia(makeMedia({ volume: 0, playbackSpeed: 1.5, loop: true }));
		// The settings land once the media node's template ref resolves.
		await nextTick();
		const video = wrapper.find('video').element;
		expect(video.volume).toBe(0);
		expect(video.playbackRate).toBe(1.5);
		expect(video.loop).toBeTruthy();
	});

	it('defaults to full volume at normal speed when the deck says nothing', async () => {
		const wrapper = mountMedia(makeMedia());
		await nextTick();
		const video = wrapper.find('video').element;
		expect(video.volume).toBe(1);
		expect(video.playbackRate).toBe(1);
		expect(wrapper.find('video').attributes('loop')).toBeUndefined();
	});
});
