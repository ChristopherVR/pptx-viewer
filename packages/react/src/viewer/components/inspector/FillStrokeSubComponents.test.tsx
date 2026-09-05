// @vitest-environment happy-dom
/**
 * W3-G3: a gradient stop's colour swatch also shows the deck's theme palette
 * and commits a `PptxThemeColorRef` alongside the resolved hex; the native
 * colour input (a plain hex, no theme identity) clears any previously-stored
 * ref for that stop.
 */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { GradientStop } from './FillStrokeHelpers';
import { GradientStopRow } from './FillStrokeSubComponents';
import { ThemeColorMapProvider } from './ThemeColorMapContext';

const OFFICE_THEME = {
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
	bg1: '#FFFFFF',
	tx1: '#000000',
	bg2: '#E7E6E6',
	tx2: '#44546A',
};

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

function renderRow(stop: GradientStop, onUpdate: (stops: GradientStop[]) => void) {
	const allStops: GradientStop[] = [stop, { color: '#ffffff', position: 100 }];
	act(() => {
		root.render(
			<ThemeColorMapProvider value={OFFICE_THEME}>
				<GradientStopRow stop={stop} index={0} total={2} allStops={allStops} onUpdate={onUpdate} />
			</ThemeColorMapProvider>,
		);
	});
}

describe('gradientStopRow theme colour picker', () => {
	it('commits both the resolved hex and the ref on a theme swatch click', () => {
		let updated: GradientStop[] | undefined;
		renderRow({ color: '#4472c4', position: 0 }, (stops) => (updated = stops));
		const accent1 = container.querySelector('button[title="Accent 1"]') as HTMLElement;
		expect(accent1).not.toBeNull();
		act(() => accent1.click());
		expect(updated?.[0]).toMatchObject({ color: '#4472c4', colorRef: { scheme: 'accent1' } });
	});

	it('clears a previously-stored ref when the native colour input changes', () => {
		let updated: GradientStop[] | undefined;
		renderRow(
			{ color: '#4472c4', position: 0, colorRef: { scheme: 'accent1' } },
			(stops) => (updated = stops),
		);
		const input = container.querySelector('input[type="color"]') as HTMLInputElement;
		act(() => {
			const nativeSetter = Object.getOwnPropertyDescriptor(
				window.HTMLInputElement.prototype,
				'value',
			)?.set;
			nativeSetter?.call(input, '#ff0000');
			input.dispatchEvent(new Event('change', { bubbles: true }));
		});
		expect(updated?.[0]?.colorRef).toBeFalsy();
	});
});
