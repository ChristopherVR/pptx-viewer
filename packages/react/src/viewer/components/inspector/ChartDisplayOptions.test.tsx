// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChartDisplayOptions } from './ChartDisplayOptions';

/**
 * Regression pin: the "Show Gridlines" checkbox used to read/write
 * `style.hasGridlines`, a field the chart renderer never looks at (gridline
 * visibility is driven by the primary value axis's `majorGridlines`, per the
 * shared `chartGridlinesState` / `chartGridlinesPatch` in
 * packages/shared/src/render/chart-gridlines-toggle.ts). So toggling the
 * checkbox silently did nothing on the canvas. `ChartDisplayOptions` now
 * takes `hasGridlines` / `onToggleGridlines` as explicit props sourced from
 * those shared helpers (wired in `ChartDataPanel.tsx`), decoupled entirely
 * from `style.hasGridlines`.
 */

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

describe('chartDisplayOptions gridlines checkbox', () => {
	it('reflects hasGridlines regardless of style.hasGridlines', () => {
		act(() =>
			root.render(
				<ChartDisplayOptions
					style={{ hasGridlines: false }}
					canEdit
					onUpdateStyle={() => {}}
					hasGridlines
					onToggleGridlines={() => {}}
				/>,
			),
		);
		const checkboxes = container.querySelectorAll('input[type="checkbox"]');
		// Show title, Show legend, Show gridlines, Data labels: gridlines is 3rd.
		const gridlinesCheckbox = checkboxes[2] as HTMLInputElement;
		expect(gridlinesCheckbox.checked).toBeTruthy();
	});

	it('calls onToggleGridlines, not onUpdateStyle, when toggled', () => {
		const onToggleGridlines = vi.fn();
		const onUpdateStyle = vi.fn();
		act(() =>
			root.render(
				<ChartDisplayOptions
					style={undefined}
					canEdit
					onUpdateStyle={onUpdateStyle}
					hasGridlines={false}
					onToggleGridlines={onToggleGridlines}
				/>,
			),
		);
		const checkboxes = container.querySelectorAll('input[type="checkbox"]');
		const gridlinesCheckbox = checkboxes[2] as HTMLInputElement;
		act(() => {
			gridlinesCheckbox.click();
		});
		expect(onToggleGridlines).toHaveBeenCalledWith(true);
		expect(onUpdateStyle).not.toHaveBeenCalled();
	});
});
