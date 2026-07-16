import { mount } from '@vue/test-utils';
import type { ImagePptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import ElementImageBox from './ElementImageBox.vue';

describe('element image box', () => {
	it('renders the shared clamped color-wash style', () => {
		const element: ImagePptxElement = {
			type: 'image',
			id: 'image-1',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			imageData: 'data:image/png;base64,AA==',
			imageEffects: { colorWash: { color: '#112233', opacity: 135 } },
		};

		const wrapper = mount(ElementImageBox, {
			props: { element, mediaDataUrls: new Map(), zIndex: 0 },
		});
		const wash = wrapper.get('.pptx-vue-image-color-wash');

		expect(wash.attributes('style')).toContain('background-color: #112233');
		expect(wash.attributes('style')).toContain('opacity: 1');
	});
});
