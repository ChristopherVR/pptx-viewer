// @vitest-environment happy-dom
/**
 * "Hide Background Graphics" checkbox (`p:sld/@showMasterSp`): reads
 * `activeSlide.showMasterShapes` (checked = hidden, i.e. showMasterShapes ===
 * false) and toggles it via `onUpdateSlide`.
 */
import type { PptxSlide } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

function slide(overrides: Partial<PptxSlide> = {}): PptxSlide {
	return { id: 'slide-1', number: 1, elements: [], ...overrides } as PptxSlide;
}

describe('slideBackgroundPanel: Hide Background Graphics', () => {
	it('is unchecked by default (background graphics shown)', () => {
		act(() => {
			root.render(<SlideBackgroundPanel activeSlide={slide()} canEdit onUpdateSlide={vi.fn()} />);
		});
		const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
		expect(checkbox.checked).toBeFalsy();
	});

	it('is checked when showMasterShapes is false', () => {
		act(() => {
			root.render(
				<SlideBackgroundPanel
					activeSlide={slide({ showMasterShapes: false })}
					canEdit
					onUpdateSlide={vi.fn()}
				/>,
			);
		});
		const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
		expect(checkbox.checked).toBeTruthy();
	});

	it('calls onUpdateSlide with showMasterShapes: false when checked', () => {
		const onUpdateSlide = vi.fn();
		act(() => {
			root.render(
				<SlideBackgroundPanel activeSlide={slide()} canEdit onUpdateSlide={onUpdateSlide} />,
			);
		});
		const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
		act(() => {
			checkbox.click();
		});
		expect(onUpdateSlide).toHaveBeenCalledWith({ showMasterShapes: false });
	});

	it('calls onUpdateSlide with showMasterShapes: true when unchecked', () => {
		const onUpdateSlide = vi.fn();
		act(() => {
			root.render(
				<SlideBackgroundPanel
					activeSlide={slide({ showMasterShapes: false })}
					canEdit
					onUpdateSlide={onUpdateSlide}
				/>,
			);
		});
		const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
		act(() => {
			checkbox.click();
		});
		expect(onUpdateSlide).toHaveBeenCalledWith({ showMasterShapes: true });
	});
});
