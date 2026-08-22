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

	/**
	 * The body region's font size used to be a fixed CSS `10px` rule
	 * regardless of the deck's authored `<p:notesStyle>`. It now resolves
	 * through the shared `resolveNotesSchematicBodyFontSizePx` cascade, scaled
	 * by this canvas's own preview-to-page ratio (0.53125 for an 800x600
	 * canvas against the default 720x960 notes page).
	 */
	function bodyFontSizePx(wrapper: ReturnType<typeof mount>): number {
		const style =
			wrapper.find('.pptx-vue-notes-master-canvas__body-text').attributes('style') ?? '';
		const match = /font-size:\s*([\d.]+)px/.exec(style);
		return match ? Number(match[1]) : Number.NaN;
	}

	it('falls back to the 9pt default (scaled to the preview) with no authored notesStyle', () => {
		const master: PptxNotesMaster = { path: 'notes', placeholders: [{ type: 'body' }] };
		const wrapper = mount(NotesMasterCanvas, {
			props: { notesMaster: master, canvasSize, notesText: 'x' },
		});
		// 9pt / 0.75 = 12px at 1:1, times a 0.53125 preview scale.
		expect(bodyFontSizePx(wrapper)).toBeCloseTo(12 * 0.53125, 3);
	});

	it("scales the deck's authored notesStyle level-0 font size instead of the fixed clamp", () => {
		const master: PptxNotesMaster = {
			path: 'notes',
			placeholders: [{ type: 'body' }],
			notesStyle: { 0: { fontSize: 64 } }, // 64px -> 48pt
		};
		const wrapper = mount(NotesMasterCanvas, {
			props: { notesMaster: master, canvasSize, notesText: 'x' },
		});
		// 48pt / 0.75 = 64px at 1:1, times a 0.53125 preview scale.
		expect(bodyFontSizePx(wrapper)).toBeCloseTo(64 * 0.53125, 3);
	});
});
