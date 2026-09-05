// @vitest-environment happy-dom
/**
 * B6 (wave-4): recent colours. `ColorPickerRow` reads/pushes the "Recent
 * Colors" row through `RecentColorsContext` rather than a per-caller prop
 * (the fill colour's own row previously received no `recentColors` prop at
 * all and silently rendered nothing).
 */
import type { PptxThemeColorRef } from 'pptx-viewer-core';
import React, { act, useCallback, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ColorPickerRow } from './FillStrokeSubComponents';
import { RecentColorsProvider } from './RecentColorsContext';
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

function Harness({ seed }: { seed: string[] }): React.ReactElement {
	const [recentColors, setRecentColors] = useState(seed);
	const pushColor = useCallback((hex: string) => {
		setRecentColors((prev) => [hex, ...prev.filter((c) => c !== hex)].slice(0, 8));
	}, []);
	return (
		<RecentColorsProvider value={{ recentColors, pushColor }}>
			<ColorPickerRow label='Fill' value='#000000' prefix='fill' onChange={() => {}} />
		</RecentColorsProvider>
	);
}

describe('colorPickerRow recent colours (wave-4 B6)', () => {
	it('renders the seeded recent-colours row with a swatch per colour', () => {
		act(() => {
			root.render(<Harness seed={['#112233', '#445566']} />);
		});
		const row = container.querySelector('[data-testid="pptx-color-recent"]');
		expect(row).not.toBeNull();
		expect(row!.querySelectorAll('button[data-pptx-compact]')).toHaveLength(2);
	});

	it('renders no recent-colours row when the list is empty', () => {
		act(() => {
			root.render(<Harness seed={[]} />);
		});
		expect(container.querySelector('[data-testid="pptx-color-recent"]')).toBeNull();
	});

	it('picking the native colour input pushes it into the recent list', () => {
		act(() => {
			root.render(<Harness seed={['#112233']} />);
		});
		const input = container.querySelector('input[type="color"]') as HTMLInputElement;
		act(() => {
			const nativeSetter = Object.getOwnPropertyDescriptor(
				window.HTMLInputElement.prototype,
				'value',
			)!.set!;
			nativeSetter.call(input, '#ff0000');
			input.dispatchEvent(new Event('change', { bubbles: true }));
		});
		const row = container.querySelector('[data-testid="pptx-color-recent"]');
		const first = row!.querySelectorAll('button[data-pptx-compact]')[0] as HTMLElement;
		expect(first.title).toBe('#ff0000');
	});
});

describe('colorPickerRow theme colours (W3-G2)', () => {
	function ThemeHarness({
		onChange,
		selectedRef,
	}: {
		onChange: (color: string, ref?: PptxThemeColorRef) => void;
		selectedRef?: PptxThemeColorRef;
	}): React.ReactElement {
		return (
			<ThemeColorMapProvider value={OFFICE_THEME}>
				<RecentColorsProvider value={{ recentColors: [], pushColor: () => {} }}>
					<ColorPickerRow
						label='Fill'
						value='#000000'
						prefix='fill'
						selectedRef={selectedRef}
						onChange={onChange}
					/>
				</RecentColorsProvider>
			</ThemeColorMapProvider>
		);
	}

	it('clicking a theme swatch commits both the resolved hex and the ref', () => {
		const calls: Array<[string, PptxThemeColorRef | undefined]> = [];
		act(() => {
			root.render(<ThemeHarness onChange={(c, r) => calls.push([c, r])} />);
		});
		const swatch = container.querySelector('button[title="Accent 2"]') as HTMLButtonElement;
		expect(swatch).not.toBeNull();
		act(() => swatch.click());
		expect(calls).toStrictEqual([['#ed7d31', { scheme: 'accent2' }]]);
	});

	it('clicking a standard-colour swatch clears the ref', () => {
		const calls: Array<[string, PptxThemeColorRef | undefined]> = [];
		act(() => {
			root.render(<ThemeHarness onChange={(c, r) => calls.push([c, r])} />);
		});
		const swatch = container.querySelector('button[title="Fill Red"]') as HTMLButtonElement;
		expect(swatch).not.toBeNull();
		act(() => swatch.click());
		expect(calls).toStrictEqual([['#ff0000', undefined]]);
	});

	it('highlights the swatch matching the current ref', () => {
		act(() => {
			root.render(<ThemeHarness onChange={() => {}} selectedRef={{ scheme: 'accent2' }} />);
		});
		const swatch = container.querySelector('button[title="Accent 2"]') as HTMLElement;
		expect(swatch.className).toContain('border-primary');
	});
});
