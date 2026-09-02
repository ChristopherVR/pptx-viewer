// @vitest-environment happy-dom
import type { SlideSizeEmu } from 'pptx-viewer-shared';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SlideSizeCard } from './SlideSizeCard';

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

// PowerPoint's on-screen 4:3 preset (widescreen -> screen4x3).
const widescreen: SlideSizeEmu = { widthEmu: 12192000, heightEmu: 6858000, type: '' };

describe('slideSizeCard rescale prompt', () => {
	it('applies a preset change directly when the deck is empty', () => {
		const onUpdateSlideSize = vi.fn();
		act(() =>
			root.render(
				<SlideSizeCard
					canvasSize={{ width: 1280, height: 720 }}
					slideSizeEmu={widescreen}
					canEdit
					onUpdate={() => {}}
					onUpdateSlideSize={onUpdateSlideSize}
					hasContent={false}
				/>,
			),
		);
		const select = container.querySelector('[data-pptx-slide-size-preset]') as HTMLSelectElement;
		act(() => {
			select.value = 'screen4x3';
			select.dispatchEvent(new Event('change', { bubbles: true }));
		});
		expect(onUpdateSlideSize).toHaveBeenCalledExactlyOnceWith(
			expect.objectContaining({ widthEmu: 9144000, heightEmu: 6858000 }),
		);
		expect(container.querySelector('[data-testid="pptx-slide-size-rescale-maximize"]')).toBeNull();
	});

	it('shows the rescale prompt instead of applying directly when the deck has content', () => {
		const onUpdateSlideSize = vi.fn();
		act(() =>
			root.render(
				<SlideSizeCard
					canvasSize={{ width: 1280, height: 720 }}
					slideSizeEmu={widescreen}
					canEdit
					onUpdate={() => {}}
					onUpdateSlideSize={onUpdateSlideSize}
					hasContent
				/>,
			),
		);
		const select = container.querySelector('[data-pptx-slide-size-preset]') as HTMLSelectElement;
		act(() => {
			select.value = 'screen4x3';
			select.dispatchEvent(new Event('change', { bubbles: true }));
		});
		expect(onUpdateSlideSize).not.toHaveBeenCalled();
		expect(
			container.querySelector('[data-testid="pptx-slide-size-rescale-maximize"]'),
		).not.toBeNull();
		expect(
			container.querySelector('[data-testid="pptx-slide-size-rescale-ensure-fit"]'),
		).not.toBeNull();
	});

	it('confirming Maximize applies the picked size with rescaleMode "maximize"', () => {
		const onUpdateSlideSize = vi.fn();
		act(() =>
			root.render(
				<SlideSizeCard
					canvasSize={{ width: 1280, height: 720 }}
					slideSizeEmu={widescreen}
					canEdit
					onUpdate={() => {}}
					onUpdateSlideSize={onUpdateSlideSize}
					hasContent
				/>,
			),
		);
		const select = container.querySelector('[data-pptx-slide-size-preset]') as HTMLSelectElement;
		act(() => {
			select.value = 'screen4x3';
			select.dispatchEvent(new Event('change', { bubbles: true }));
		});
		const maximizeButton = container.querySelector(
			'[data-testid="pptx-slide-size-rescale-maximize"]',
		) as HTMLButtonElement;
		act(() => maximizeButton.click());

		expect(onUpdateSlideSize).toHaveBeenCalledWith(
			expect.objectContaining({ widthEmu: 9144000, heightEmu: 6858000 }),
			'maximize',
		);
		// The prompt closes after a choice is confirmed.
		expect(container.querySelector('[data-testid="pptx-slide-size-rescale-maximize"]')).toBeNull();
	});

	it('does not prompt when the picked size matches the current one', () => {
		const onUpdateSlideSize = vi.fn();
		act(() =>
			root.render(
				<SlideSizeCard
					canvasSize={{ width: 1280, height: 720 }}
					slideSizeEmu={widescreen}
					canEdit
					onUpdate={() => {}}
					onUpdateSlideSize={onUpdateSlideSize}
					hasContent
				/>,
			),
		);
		const orientationSelect = container.querySelector(
			'[data-pptx-slide-size-orientation]',
		) as HTMLSelectElement;
		// Widescreen is already landscape: re-picking "landscape" is a no-op size.
		act(() => {
			orientationSelect.value = 'landscape';
			orientationSelect.dispatchEvent(new Event('change', { bubbles: true }));
		});
		expect(onUpdateSlideSize).toHaveBeenCalledOnce();
		expect(container.querySelector('[data-testid="pptx-slide-size-rescale-maximize"]')).toBeNull();
	});
});
