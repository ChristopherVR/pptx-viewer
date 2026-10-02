/**
 * #398: the inspector reset and clear actions share one gating contract
 * (`inspector-reset-actions` in pptx-viewer-shared) across all five bindings.
 */
import type { PptxChartData, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { buildInspectorState } from '../../editor/inspector-state-builder';
import { createTranslator } from '../../i18n';
import { createChartAdvancedSection } from './chart-advanced-section';
import { createImageSection } from './image-section';
import { createMediaSection } from './media-section';
import { createSlideBackgroundFillCard } from './slide-background-fill-card';
import type { InspectorDeckState, InspectorHandlers, InspectorState } from './types';

const t = createTranslator();
const section = (): HTMLElement => document.createElement('div');
const button = (root: HTMLElement, text: string): HTMLButtonElement | undefined =>
	[...root.querySelectorAll('button')].find((b) => b.textContent === text);

const picture = (extra: object = {}) =>
	({ id: 'p', type: 'image', x: 0, y: 0, width: 10, height: 10, ...extra }) as never;

describe('vanilla inspector reset and clear actions', () => {
	it('reset Picture and Reset Crop are gated by the shared state and call their handlers', () => {
		const handlers = { resetImage: vi.fn(), resetCrop: vi.fn() } as unknown as InspectorHandlers;
		const image = createImageSection(document, t, section, handlers);

		image.update(buildInspectorState(picture()));
		expect(button(image.el, 'Reset Picture')?.disabled).toBeTruthy();
		expect(button(image.el, 'Reset Crop')?.disabled).toBeFalsy();

		image.update(buildInspectorState(picture({ imageEffects: { brightness: 10 } })));
		button(image.el, 'Reset Picture')?.click();
		button(image.el, 'Reset Crop')?.click();
		expect(handlers.resetImage).toHaveBeenCalledOnce();
		expect(handlers.resetCrop).toHaveBeenCalledOnce();

		image.update(buildInspectorState(picture({ locks: { noCrop: true } })));
		expect(button(image.el, 'Reset Crop')?.disabled).toBeTruthy();
	});

	it('reset trim is hidden until the media is trimmed, then zeroes both ends', () => {
		const handlers = { setMediaProperties: vi.fn() } as unknown as InspectorHandlers;
		const media = createMediaSection(document, t, section, handlers);
		const stateFor = (trimStartMs: number) =>
			({
				isMedia: true,
				editable: true,
				media: { id: 'm', type: 'media', mediaType: 'video', trimStartMs },
			}) as unknown as InspectorState;
		media.update(stateFor(0));
		expect(button(media.el, 'Reset trim')?.hidden).toBeTruthy();
		media.update(stateFor(300));
		const reset = button(media.el, 'Reset trim');
		expect(reset?.hidden).toBeFalsy();
		reset?.click();
		expect(handlers.setMediaProperties).toHaveBeenCalledWith({ trimStartMs: 0, trimEndMs: 0 });
	});

	it('clear series colour appears for a coloured series, clears it and hides read-only', () => {
		const onChange = vi.fn();
		const section2 = createChartAdvancedSection(document, t, onChange);
		const data = {
			chartType: 'bar',
			categories: ['A'],
			series: [
				{ name: 'S1', values: [1], color: '#ff0000' },
				{ name: 'S2', values: [2] },
			],
		} as unknown as PptxChartData;
		section2.update(data);
		const clear = button(section2.el, 'Clear series colour');
		expect(clear?.hidden).toBeFalsy();
		clear?.click();
		expect(onChange.mock.calls[0]?.[0].series[0].color).toBeUndefined();

		section2.setEditable(false);
		expect(clear?.hidden).toBeTruthy();
		section2.setEditable(true);
		const select = [...section2.el.querySelectorAll('select, pptx-ui-select')].find((node) =>
			node.textContent?.includes('S2'),
		) as HTMLSelectElement;
		select.selectedIndex = 1;
		select.dispatchEvent(new Event('change'));
		expect(clear?.hidden).toBeTruthy();
	});

	it('clear Background is hidden without a background and clears every facet', () => {
		const handlers = {
			updateActiveSlide: vi.fn(),
			pushRecentColor: vi.fn(),
		} as unknown as InspectorHandlers;
		const card = createSlideBackgroundFillCard(document, t, handlers);
		const stateFor = (slide: Partial<PptxSlide>, editable = true) =>
			({
				activeSlide: { id: 's', elements: [], ...slide },
				editable,
			}) as unknown as InspectorDeckState;
		card.update(stateFor({}));
		expect(button(card.el, 'Clear Background')?.hidden).toBeTruthy();
		card.update(stateFor({ backgroundColor: '#123456' }, false));
		expect(button(card.el, 'Clear Background')?.disabled).toBeTruthy();
		card.update(stateFor({ backgroundColor: '#123456' }));
		button(card.el, 'Clear Background')?.click();
		expect(handlers.updateActiveSlide).toHaveBeenCalledWith({
			backgroundColor: undefined,
			backgroundImage: undefined,
			backgroundGradient: undefined,
			backgroundPattern: undefined,
		});
	});
});
