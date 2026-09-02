// @vitest-environment happy-dom
/**
 * Draw ribbon tab: the pen colour is a colour pick like any other, so the
 * COMMITTED value joins the deck's "Recent colours" list. React's `onChange`
 * on a native colour input is the continuous `input` stream while the dialog
 * is dragged, so the push must hang off the native `change` event instead.
 */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RecentColorsProvider } from '../inspector/RecentColorsContext';
import { DrawSection } from './DrawSection';

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

function renderSection(pushColor: (hex: string) => void, onSetDrawingColor: (hex: string) => void) {
	act(() => {
		root.render(
			<RecentColorsProvider value={{ recentColors: [], pushColor }}>
				<DrawSection
					activeTool='select'
					drawingColor='#000000'
					drawingWidth={2}
					onSetActiveTool={() => {}}
					onSetDrawingColor={onSetDrawingColor}
					onSetDrawingWidth={() => {}}
				/>
			</RecentColorsProvider>,
		);
	});
	return container.querySelector<HTMLInputElement>('input[type="color"]')!;
}

describe('drawSection pen colour (recent colours)', () => {
	it('drives the live pen colour on input without recording a recent colour', () => {
		const pushColor = vi.fn();
		const onSetDrawingColor = vi.fn();
		const input = renderSection(pushColor, onSetDrawingColor);

		const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
		act(() => {
			setter.call(input, '#123456');
			input.dispatchEvent(new Event('input', { bubbles: true }));
		});

		expect(onSetDrawingColor).toHaveBeenCalledWith('#123456');
		expect(pushColor).not.toHaveBeenCalled();
	});

	it('pushes the committed pen colour into the recent-colours list on change', () => {
		const pushColor = vi.fn();
		const input = renderSection(pushColor, () => {});

		const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
		act(() => {
			setter.call(input, '#abcdef');
			input.dispatchEvent(new Event('change', { bubbles: true }));
		});

		expect(pushColor).toHaveBeenCalledWith('#abcdef');
	});
});
