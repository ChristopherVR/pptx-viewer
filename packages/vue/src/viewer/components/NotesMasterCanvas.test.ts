import { mount } from '@vue/test-utils';
import type { PptxNotesMaster } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import NotesMasterCanvas from './NotesMasterCanvas.vue';

const canvasSize = { width: 800, height: 600 };

describe('notesMasterCanvas', () => {
	it('shows an empty message when there is no notes master', () => {
		const wrapper = mount(NotesMasterCanvas, {
			props: { notesMaster: undefined, canvasSize },
		});
		expect(wrapper.find('[data-testid="notes-master-empty"]').exists()).toBeTruthy();
		expect(wrapper.find('[data-testid="notes-master-page"]').exists()).toBeFalsy();
	});

	it('renders the default placeholder regions when none are provided', () => {
		const master: PptxNotesMaster = { path: 'notes' };
		const wrapper = mount(NotesMasterCanvas, { props: { notesMaster: master, canvasSize } });
		expect(wrapper.find('[data-testid="notes-master-page"]').exists()).toBeTruthy();
		// Default set: sldImg, body, hdr, ftr, dt, sldNum → 6 regions.
		expect(wrapper.findAll('[data-region]')).toHaveLength(6);
		expect(wrapper.text()).toContain('Slide Image');
		expect(wrapper.text()).toContain('Notes Body');
	});

	it('renders the supplied slide thumbnail in the slide-image region', () => {
		const master: PptxNotesMaster = { path: 'notes', placeholders: [{ type: 'sldImg' }] };
		const wrapper = mount(NotesMasterCanvas, {
			props: { notesMaster: master, canvasSize, slideThumbnail: 'data:image/png;base64,AAA' },
		});
		const img = wrapper.find('.pptx-vue-notes-master-canvas__slide-img');
		expect(img.exists()).toBeTruthy();
		expect(img.attributes('src')).toBe('data:image/png;base64,AAA');
	});

	it('renders notes text in the body region', () => {
		const master: PptxNotesMaster = { path: 'notes', placeholders: [{ type: 'body' }] };
		const wrapper = mount(NotesMasterCanvas, {
			props: { notesMaster: master, canvasSize, notesText: 'Speaker notes here' },
		});
		expect(wrapper.text()).toContain('Speaker notes here');
	});
});
