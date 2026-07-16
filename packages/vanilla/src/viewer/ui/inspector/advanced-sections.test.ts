import type { PptxChartData, MediaPptxElement } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../i18n';
import { createChartAdvancedSection } from './chart-advanced-section';
import { createMediaSection } from './media-section';
import type { InspectorHandlers, InspectorState } from './types';

describe('advanced inspector sections', () => {
	it('commits axis and series formatting from the chart controls', () => {
		const changes: PptxChartData[] = [];
		const section = createChartAdvancedSection(document, createTranslator(), (data) =>
			changes.push(data),
		);
		section.update({
			chartType: 'line',
			categories: ['A'],
			axes: [{ axisType: 'valAx' }],
			series: [{ name: 'Sales', values: [2], marker: { symbol: 'circle' } }],
		});

		const numeric = section.el.querySelectorAll<HTMLInputElement>('input[type="number"]');
		numeric[0].value = '10';
		numeric[0].dispatchEvent(new Event('change'));
		const colors = section.el.querySelectorAll<HTMLInputElement>('input[type="color"]');
		colors[0].value = '#ff0000';
		colors[0].dispatchEvent(new Event('change'));

		expect(changes[0].axes?.[0].min).toBe(10);
		expect(changes.at(-1)?.series[0].color).toBe('#ff0000');
	});

	it('authors media bookmarks and captions', () => {
		const setMediaProperties = vi.fn();
		const handlers = { setMediaProperties } as unknown as InspectorHandlers;
		const host = document.createElement('div');
		const section = createMediaSection(
			document,
			createTranslator(),
			() => {
				const el = document.createElement('div');
				host.appendChild(el);
				return el;
			},
			handlers,
		);
		const media = {
			type: 'media',
			id: 'm1',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			mediaType: 'video',
		} as MediaPptxElement;
		section.update({ isMedia: true, media } as InspectorState);
		const textareas = section.el.querySelectorAll<HTMLTextAreaElement>('textarea');

		textareas[0].value = '12.5 | Intro';
		textareas[0].dispatchEvent(new Event('change'));
		textareas[1].value = 'en | English | captions | captions.vtt';
		textareas[1].dispatchEvent(new Event('change'));

		expect(setMediaProperties).toHaveBeenCalledWith({
			bookmarks: [{ id: 'bookmark-1', time: 12.5, label: 'Intro' }],
		});
		expect(setMediaProperties).toHaveBeenCalledWith({
			captionTracks: [
				{
					id: 'caption-1',
					language: 'en',
					label: 'English',
					kind: 'captions',
					src: 'captions.vtt',
				},
			],
		});
	});
});
