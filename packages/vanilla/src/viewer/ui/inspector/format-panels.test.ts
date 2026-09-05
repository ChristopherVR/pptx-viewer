import type { PptxChartData, MediaPptxElement, TextStyle } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../i18n';
import { createChartDataGrid } from './chart-data-grid';
import { createImageSection } from './image-section';
import { createMediaTrimTimeline } from './media-trim-timeline';
import { createQuickStylesGallery } from './quick-styles-gallery';
import { createText3DSection } from './text-3d-section';
import type { InspectorHandlers, InspectorState } from './types';

/** A `section()` factory matching the one `createInspector` passes in. */
function sectionFactory() {
	return (): HTMLElement => document.createElement('div');
}

function state(overrides: Partial<InspectorState> = {}): InspectorState {
	return { hasSelection: true, ...overrides } as InspectorState;
}

describe('quick styles gallery', () => {
	it('applies a shared preset style on click', () => {
		const setShapeStyle = vi.fn();
		const gallery = createQuickStylesGallery(document, createTranslator(), sectionFactory(), {
			setShapeStyle,
		});
		gallery.update(state({ canShape: true }));

		const buttons = gallery.el.querySelectorAll<HTMLButtonElement>('.pptxv-quick-style');
		expect(buttons.length).toBeGreaterThan(6);
		buttons[0].click();

		expect(setShapeStyle).toHaveBeenCalledWith(
			expect.objectContaining({ fillMode: 'solid', fillColor: expect.any(String) }),
		);
	});

	it('hides itself for a selection that cannot take a shape style', () => {
		const gallery = createQuickStylesGallery(document, createTranslator(), sectionFactory(), {
			setShapeStyle: vi.fn(),
		});
		gallery.update(state({ canShape: false }));
		expect(gallery.el.hidden).toBeTruthy();
	});
});

describe('text 3d section', () => {
	function build() {
		const setTextStyle = vi.fn();
		const section = createText3DSection(document, createTranslator(), sectionFactory(), {
			setTextStyle,
		} as unknown as InspectorHandlers);
		return { section, setTextStyle };
	}

	it('seeds a 6pt extrusion when the toggle is switched on', () => {
		const { section, setTextStyle } = build();
		section.update(state({ canText: true, textStyle: {} as TextStyle }));

		const toggle = section.el.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
		toggle.checked = true;
		toggle.dispatchEvent(new Event('change'));

		expect(setTextStyle).toHaveBeenCalledWith({ text3d: { extrusionHeight: 76200 } });
	});

	it('clears the whole 3d style when the toggle is switched off', () => {
		const { section, setTextStyle } = build();
		section.update(
			state({ canText: true, textStyle: { text3d: { extrusionHeight: 76200 } } as TextStyle }),
		);

		const toggle = section.el.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
		toggle.checked = false;
		toggle.dispatchEvent(new Event('change'));

		expect(setTextStyle).toHaveBeenCalledWith({ text3d: undefined });
	});

	it('shows the bevel/material options only once there is extrusion', () => {
		const { section } = build();
		section.update(state({ canText: true, textStyle: {} as TextStyle }));
		const options = section.el.querySelector<HTMLElement>('.pptxv-text3d-options')!;
		expect(options.hidden).toBeTruthy();

		section.update(
			state({ canText: true, textStyle: { text3d: { extrusionHeight: 76200 } } as TextStyle }),
		);
		expect(options.hidden).toBeFalsy();
	});

	it('commits a bevel width in EMU', () => {
		const { section, setTextStyle } = build();
		section.update(
			state({ canText: true, textStyle: { text3d: { extrusionHeight: 76200 } } as TextStyle }),
		);

		const widths = section.el.querySelectorAll<HTMLInputElement>('.pptxv-text3d-bevel input');
		const width = Array.from(widths).find((input) => input.type === 'number')!;
		width.value = '3';
		width.dispatchEvent(new Event('change'));

		expect(setTextStyle).toHaveBeenCalledWith(
			expect.objectContaining({ text3d: expect.objectContaining({ bevelTopWidth: 38100 }) }),
		);
	});
});

describe('chart data grid', () => {
	const chartData = (): PptxChartData => ({
		chartType: 'bar',
		categories: ['A', 'B'],
		series: [
			{ name: 'S1', values: [1, 2] },
			{ name: 'S2', values: [3, 4] },
		],
	});

	it('renders one column per series and one row per category', () => {
		const grid = createChartDataGrid(document, createTranslator(), vi.fn());
		grid.update(chartData());

		expect(grid.el.querySelectorAll('thead th')).toHaveLength(3);
		expect(grid.el.querySelectorAll('tbody tr')).toHaveLength(2);
	});

	it('commits an edited cell value', () => {
		const onChange = vi.fn();
		const grid = createChartDataGrid(document, createTranslator(), onChange);
		grid.update(chartData());

		const cell = grid.el.querySelector<HTMLInputElement>('tbody input[type="number"]')!;
		cell.value = '42';
		cell.dispatchEvent(new Event('change'));

		expect(onChange.mock.calls[0][0].series[0].values[0]).toBe(42);
	});

	it('ignores a non-numeric cell instead of writing NaN', () => {
		const onChange = vi.fn();
		const grid = createChartDataGrid(document, createTranslator(), onChange);
		grid.update(chartData());

		const cell = grid.el.querySelector<HTMLInputElement>('tbody input[type="number"]')!;
		cell.value = '';
		cell.dispatchEvent(new Event('change'));

		expect(onChange).not.toHaveBeenCalled();
	});

	it('adds a category and a series through the toolbar', () => {
		const onChange = vi.fn();
		const grid = createChartDataGrid(document, createTranslator(), onChange);
		grid.update(chartData());

		const [addCategory, addSeries] =
			grid.el.querySelectorAll<HTMLButtonElement>('.pptxv-chart-grid-btn');
		addCategory.click();
		addSeries.click();

		expect(onChange.mock.calls[0][0].categories).toHaveLength(3);
		expect(onChange.mock.calls[1][0].series).toHaveLength(3);
	});

	it('removes a series but never the last one', () => {
		const onChange = vi.fn();
		const grid = createChartDataGrid(document, createTranslator(), onChange);
		grid.update(chartData());
		grid.el.querySelector<HTMLButtonElement>('thead .pptxv-chart-grid-remove')!.click();
		expect(onChange.mock.calls[0][0].series).toHaveLength(1);

		onChange.mockClear();
		grid.update({ chartType: 'bar', categories: ['A'], series: [{ name: 'S1', values: [1] }] });
		expect(grid.el.querySelector('.pptxv-chart-grid-remove')).toBeNull();
	});
});

describe('media trim timeline', () => {
	it('projects the trim window and playhead onto the bar', () => {
		const timeline = createMediaTrimTimeline(document, {
			onTrimChange: vi.fn(),
			onSeek: vi.fn(),
		});
		// `trimEndMs` is p14:trim/@end's distance from the tail (G19): 2000 off
		// a 10s clip ends at 8s, so the window runs 2s..8s.
		timeline.update({
			duration: 10,
			trimStartMs: 2000,
			trimEndMs: 2000,
			currentTime: 5,
			bookmarks: [{ id: 'b1', time: 5, label: 'Mid' }],
			canEdit: true,
		});

		const region = timeline.el.querySelector<HTMLElement>('.pptxv-media-timeline-region')!;
		expect(region.style.left).toBe('20%');
		expect(region.style.width).toBe('60%');
		const labels = timeline.el.querySelectorAll<HTMLElement>('.pptxv-media-timeline-time');
		expect(labels[0]?.textContent).toBe('0:02.0');
		expect(labels[1]?.textContent).toBe('0:08.0');
		expect(
			timeline.el.querySelector<HTMLElement>('.pptxv-media-timeline-playhead')!.style.left,
		).toBe('50%');
		expect(timeline.el.querySelectorAll('.pptxv-media-timeline-mark')).toHaveLength(1);
	});

	it('seeks to a bookmark when its marker is clicked', () => {
		const onSeek = vi.fn();
		const timeline = createMediaTrimTimeline(document, { onTrimChange: vi.fn(), onSeek });
		timeline.update({
			duration: 10,
			trimStartMs: 0,
			trimEndMs: 0,
			currentTime: 0,
			bookmarks: [{ id: 'b1', time: 4, label: 'Cue' }],
			canEdit: true,
		});

		timeline.el.querySelector<HTMLButtonElement>('.pptxv-media-timeline-mark')!.click();
		expect(onSeek).toHaveBeenCalledWith(4);
	});

	it('hides the drag handles when the deck is read-only', () => {
		const timeline = createMediaTrimTimeline(document, {
			onTrimChange: vi.fn(),
			onSeek: vi.fn(),
		});
		timeline.update({
			duration: 4,
			trimStartMs: 0,
			trimEndMs: 0,
			currentTime: 0,
			bookmarks: [],
			canEdit: false,
		});
		expect(
			timeline.el.querySelector<HTMLElement>('.pptxv-media-timeline-handle.is-start')!.hidden,
		).toBeTruthy();
	});
});

describe('image alt text', () => {
	it('commits the accessibility description on change', () => {
		const setAltText = vi.fn();
		const handlers = {
			setAltText,
			replaceImage: vi.fn(),
			resetImage: vi.fn(),
			setImageBrightness: vi.fn(),
			setImageContrast: vi.fn(),
			setImageSaturation: vi.fn(),
			setImageCrop: vi.fn(),
			setImageEffects: vi.fn(),
		} as unknown as InspectorHandlers;
		const section = createImageSection(document, createTranslator(), sectionFactory(), handlers);
		section.update(state({ isImage: true, altText: 'Old' }));

		const alt = section.el.querySelector<HTMLTextAreaElement>('.pptxv-image-alt-input')!;
		expect(alt.value).toBe('Old');
		alt.value = 'A cat on a mat';
		alt.dispatchEvent(new Event('change'));

		expect(setAltText).toHaveBeenCalledWith('A cat on a mat');
	});
});

describe('media section trim timeline wiring', () => {
	it('renders a timeline inside the media section', async () => {
		const { createMediaSection } = await import('./media-section');
		const section = createMediaSection(document, createTranslator(), sectionFactory(), {
			setMediaProperties: vi.fn(),
		} as unknown as InspectorHandlers);
		section.update(
			state({
				isMedia: true,
				media: { type: 'media', id: 'm1', trimStartMs: 0, trimEndMs: 0 } as MediaPptxElement,
			}),
		);
		expect(section.el.querySelector('.pptxv-media-timeline')).not.toBeNull();
	});

	/**
	 * `trimEndMs` is `p14:trim/@end`'s distance from the clip's TAIL
	 * (COM-verified). The "Trim End" number field used to bind that distance
	 * directly, so typing "the last 5s" of a 20s clip meant computing
	 * 20000-5000 by hand; it now shows/accepts the absolute end position, like
	 * React's `MediaInspector` and Vue's `MediaPropertiesPanel.vue`.
	 */
	it('shows 15000 (15s) for a 20s clip with trimEndMs=5000, and stores 5000 for a typed 15000', async () => {
		const { createMediaSection } = await import('./media-section');
		const setMediaProperties = vi.fn();
		const section = createMediaSection(document, createTranslator(), sectionFactory(), {
			setMediaProperties,
		} as unknown as InspectorHandlers);
		section.update(
			state({
				isMedia: true,
				media: {
					type: 'media',
					id: 'm1',
					trimStartMs: 0,
					trimEndMs: 5000,
					metadata: { duration: 20 },
				} as MediaPptxElement,
			}),
		);

		const trimEndInput = section.el.querySelector<HTMLInputElement>(
			'input[aria-label="Trim End"]',
		)!;
		expect(trimEndInput.value).toBe('15000');

		// A different absolute end than the one just displayed (15000), so the
		// field's own "unchanged commit" guard does not swallow it.
		trimEndInput.value = '12000';
		trimEndInput.dispatchEvent(new Event('change'));
		expect(setMediaProperties).toHaveBeenCalledWith({ trimEndMs: 8000 });
	});
});
