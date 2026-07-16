import { mount } from '@vue/test-utils';
import type { MediaPptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import MediaPropertiesPanel from './MediaPropertiesPanel.vue';

function mediaElement(patch: Partial<MediaPptxElement> = {}): MediaPptxElement {
	return {
		type: 'media',
		id: 'media-1',
		x: 0,
		y: 0,
		width: 320,
		height: 180,
		mediaType: 'video',
		...patch,
	};
}

describe('MediaPropertiesPanel', () => {
	it('previews relationship-backed media through the viewer URL map', () => {
		const wrapper = mount(MediaPropertiesPanel, {
			props: {
				element: mediaElement({ mediaPath: 'ppt/media/video1.mp4' }),
				mediaDataUrls: new Map([['ppt/media/video1.mp4', 'blob:resolved-video']]),
			},
		});

		expect(wrapper.get('video').attributes('src')).toBe('blob:resolved-video');
	});

	it('prefers embedded media data over the relationship map', () => {
		const wrapper = mount(MediaPropertiesPanel, {
			props: {
				element: mediaElement({
					mediaData: 'data:video/mp4;base64,AAAA',
					mediaPath: 'ppt/media/video1.mp4',
				}),
				mediaDataUrls: new Map([['ppt/media/video1.mp4', 'blob:resolved-video']]),
			},
		});

		expect(wrapper.get('video').attributes('src')).toBe('data:video/mp4;base64,AAAA');
	});
});
