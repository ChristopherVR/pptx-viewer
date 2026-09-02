// @vitest-environment happy-dom
/**
 * B6 (wave-4): recent colours. `ColorPickerRow` reads/pushes the "Recent
 * Colors" row through `RecentColorsContext` rather than a per-caller prop
 * (the fill colour's own row previously received no `recentColors` prop at
 * all and silently rendered nothing).
 */
import React, { act, useCallback, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ColorPickerRow } from './FillStrokeSubComponents';
import { RecentColorsProvider } from './RecentColorsContext';

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
