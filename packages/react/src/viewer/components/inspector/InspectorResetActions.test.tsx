// @vitest-environment happy-dom
/**
 * #398: the inspector reset and clear actions share one gating contract
 * (`inspector-reset-actions` in pptx-viewer-shared) across all five bindings.
 */
import type { MediaPptxElement, PptxChartData, PptxSlide } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChartSeriesColorOptions } from './ChartSeriesColorOptions';
import { ImageCropSection } from './ImageCropSection';
import { ImagePropertiesPanel } from './ImagePropertiesPanel';
import { MediaInspector } from './MediaInspector';
import { SlideBackgroundPanel } from './SlideBackgroundPanel';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});
afterEach(() => {
	act(() => root.unmount());
	container.remove();
});

function button(name: string): HTMLButtonElement | undefined {
	return [...container.querySelectorAll('button')].find(
		(b) => b.textContent === name || b.title === name,
	);
}

const picture = (extra: object = {}) =>
	({
		id: 'p',
		type: 'image',
		x: 0,
		y: 0,
		width: 10,
		height: 10,
		imageData: 'data:image/png;base64,',
		...extra,
	}) as never;

describe('react inspector reset and clear actions', () => {
	it('reset Picture is disabled until an override exists, then clears effects and crop shape', () => {
		const onUpdate = vi.fn();
		act(() =>
			root.render(
				<ImagePropertiesPanel selectedElement={picture()} canEdit onUpdateElement={onUpdate} />,
			),
		);
		expect(button('pptx.image.resetImage')?.disabled).toBeTruthy();
		act(() =>
			root.render(
				<ImagePropertiesPanel
					selectedElement={picture({ imageEffects: { brightness: 20 } })}
					canEdit
					onUpdateElement={onUpdate}
				/>,
			),
		);
		const reset = button('pptx.image.resetImage');
		expect(reset?.disabled).toBeFalsy();
		act(() => reset?.click());
		expect(onUpdate).toHaveBeenCalledWith({ imageEffects: undefined, cropShape: 'none' });
	});

	it('reset Crop zeroes the four insets and honours noCrop', () => {
		const onUpdate = vi.fn();
		act(() =>
			root.render(
				<ImageCropSection selectedElement={picture()} canEdit onUpdateElement={onUpdate} />,
			),
		);
		act(() => button('pptx.image.resetCrop')?.click());
		expect(onUpdate).toHaveBeenCalledWith({
			cropLeft: 0,
			cropTop: 0,
			cropRight: 0,
			cropBottom: 0,
		});
		act(() =>
			root.render(
				<ImageCropSection
					selectedElement={picture({ locks: { noCrop: true } })}
					canEdit
					onUpdateElement={onUpdate}
				/>,
			),
		);
		expect(button('pptx.image.resetCrop')?.disabled).toBeTruthy();
	});

	it('reset trim only exists for editable trimmed media', () => {
		const onUpdate = vi.fn();
		const media = (trimStartMs?: number) =>
			({
				id: 'm',
				type: 'media',
				x: 0,
				y: 0,
				width: 1,
				height: 1,
				trimStartMs,
			}) as MediaPptxElement;
		act(() =>
			root.render(
				<MediaInspector
					element={media()}
					canEdit
					durationSeconds={10}
					onUpdateElement={onUpdate}
				/>,
			),
		);
		expect(button('pptx.media.resetTrim')).toBeUndefined();
		act(() =>
			root.render(
				<MediaInspector
					element={media(1000)}
					canEdit={false}
					durationSeconds={10}
					onUpdateElement={onUpdate}
				/>,
			),
		);
		expect(button('pptx.media.resetTrim')).toBeUndefined();
		act(() =>
			root.render(
				<MediaInspector
					element={media(1000)}
					canEdit
					durationSeconds={10}
					onUpdateElement={onUpdate}
				/>,
			),
		);
		act(() => button('pptx.media.resetTrim')?.click());
		expect(onUpdate).toHaveBeenCalledWith({ trimStartMs: 0, trimEndMs: 0 });
	});

	it('clear series colour shows only for a coloured series and clears it', () => {
		const onSetColor = vi.fn();
		const data = {
			chartType: 'bar',
			categories: ['a'],
			series: [
				{ name: 'S1', values: [1], color: '#ff0000' },
				{ name: 'S2', values: [1] },
			],
		} as unknown as PptxChartData;
		act(() =>
			root.render(
				<ChartSeriesColorOptions
					chartData={data}
					canEdit
					onSetColor={onSetColor}
					onToggleSecondaryAxis={() => {}}
				/>,
			),
		);
		const clears = container.querySelectorAll('button[title="pptx.chart.clearSeriesColor"]');
		expect(clears).toHaveLength(1);
		act(() => (clears[0] as HTMLButtonElement).click());
		expect(onSetColor).toHaveBeenCalledWith(0, null);
	});

	it('clear Background is hidden without a background and clears every facet', () => {
		const onUpdate = vi.fn();
		const slide = (extra: object = {}) =>
			({ id: 's', number: 1, elements: [], ...extra }) as unknown as PptxSlide;
		act(() =>
			root.render(<SlideBackgroundPanel activeSlide={slide()} canEdit onUpdateSlide={onUpdate} />),
		);
		expect(button('pptx.slideBackground.clearBackground')).toBeUndefined();
		act(() =>
			root.render(
				<SlideBackgroundPanel
					activeSlide={slide({ backgroundPattern: { preset: 'x' } })}
					canEdit
					onUpdateSlide={onUpdate}
				/>,
			),
		);
		act(() => button('pptx.slideBackground.clearBackground')?.click());
		expect(onUpdate).toHaveBeenCalledWith({
			backgroundColor: undefined,
			backgroundImage: undefined,
			backgroundGradient: undefined,
			backgroundPattern: undefined,
		});
	});
});
