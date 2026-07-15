// @vitest-environment happy-dom
import type { PptxSlide, PptxTheme } from 'pptx-viewer-core';
import { DEFAULT_COLOR_MAP } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SlideThemeOverridePanel } from './SlideThemeOverridePanel';

vi.mock(import('react-i18next'), () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

const theme: PptxTheme = {
	colorScheme: {
		dk1: '#000000',
		lt1: '#FFFFFF',
		dk2: '#44546A',
		lt2: '#E7E6E6',
		accent1: '#4472C4',
		accent2: '#ED7D31',
		accent3: '#A5A5A5',
		accent4: '#FFC000',
		accent5: '#5B9BD5',
		accent6: '#70AD47',
		hlink: '#0563C1',
		folHlink: '#954F72',
	},
};

function slide(overrides: Partial<PptxSlide> = {}): PptxSlide {
	return {
		id: 'slide-1',
		elements: [
			{
				id: 'shape-1',
				type: 'shape',
				x: 0,
				y: 0,
				width: 100,
				height: 100,
				shapeStyle: { fillColor: '#4472C4' },
			},
		],
		...overrides,
	} as PptxSlide;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
	globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

function renderPanel(activeSlide: PptxSlide, onUpdateSlide: (patch: Partial<PptxSlide>) => void) {
	act(() => {
		root.render(
			<SlideThemeOverridePanel
				activeSlide={activeSlide}
				theme={theme}
				canEdit
				onUpdateSlide={onUpdateSlide}
			/>,
		);
	});
}

describe('slideThemeOverridePanel', () => {
	it('keeps an identity override enabled and visible', () => {
		renderPanel(slide({ clrMapOverride: { ...DEFAULT_COLOR_MAP } }), vi.fn());

		expect(
			container.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked,
		).toBeTruthy();
		expect(container.querySelectorAll('select')).toHaveLength(12);
	});

	it('recolours theme-derived slide elements when an alias changes', () => {
		const onUpdateSlide = vi.fn<(patch: Partial<PptxSlide>) => void>();
		renderPanel(slide({ clrMapOverride: { ...DEFAULT_COLOR_MAP } }), onUpdateSlide);
		const accent1Select = container.querySelectorAll('select')[4] as HTMLSelectElement;

		act(() => {
			accent1Select.value = 'accent2';
			accent1Select.dispatchEvent(new Event('change', { bubbles: true }));
		});

		const patch = onUpdateSlide.mock.calls[0][0];
		const shape = patch.elements?.[0] as { shapeStyle?: { fillColor?: string } };
		expect(patch.clrMapOverride?.accent1).toBe('accent2');
		expect(shape.shapeStyle?.fillColor).toBe('#ED7D31');
	});
});
