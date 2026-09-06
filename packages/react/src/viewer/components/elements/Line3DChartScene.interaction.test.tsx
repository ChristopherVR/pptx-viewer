// @vitest-environment happy-dom
/**
 * Regression tests for Line3DChartScene's interaction/selection/text-style
 * wiring. Mirrors `Bar3DChartScene.interaction.test.tsx`; see there for the
 * rationale (stable interaction identity, mount-resolve catch-up).
 */
import type { ChartPartRef, LineChart3DHandle, LineChart3DSceneOptions } from 'pptx-viewer-shared';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mountLineChart3D = vi.fn();

vi.mock(import('pptx-viewer-shared'), () => ({
	mountLineChart3D: (...args: unknown[]) => mountLineChart3D(...args),
}));

const { default: Line3DChartScene } = await import('./Line3DChartScene');

function makeHandle(): LineChart3DHandle {
	return {
		ok: true,
		resize: vi.fn(),
		setSelectedPart: vi.fn(),
		setTextStyle: vi.fn(),
		dispose: vi.fn(),
	};
}

const options = { width: 400, height: 300 } as unknown as LineChart3DSceneOptions;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
	mountLineChart3D.mockReset();
});

afterEach(() => {
	act(() => {
		root.unmount();
	});
	container.remove();
});

describe('line3DChartScene interaction wiring', () => {
	it('mounts once and proxies interaction calls to the LATEST interaction prop', async () => {
		const handle = makeHandle();
		mountLineChart3D.mockResolvedValue(handle);
		const firstOnSelect = vi.fn();

		await act(async () => {
			root.render(
				React.createElement(Line3DChartScene, {
					options,
					interaction: { onSelect: firstOnSelect },
				}),
			);
			await Promise.resolve();
		});
		expect(mountLineChart3D).toHaveBeenCalledOnce();
		const passedInteraction = mountLineChart3D.mock.calls[0]?.[2] as {
			onSelect: (part: ChartPartRef | null) => void;
		};

		passedInteraction.onSelect(null);
		expect(firstOnSelect).toHaveBeenCalledOnce();

		const secondOnSelect = vi.fn();
		act(() => {
			root.render(
				React.createElement(Line3DChartScene, {
					options,
					interaction: { onSelect: secondOnSelect },
				}),
			);
		});
		expect(mountLineChart3D).toHaveBeenCalledOnce();

		passedInteraction.onSelect(null);
		expect(secondOnSelect).toHaveBeenCalledOnce();
		expect(firstOnSelect).toHaveBeenCalledOnce();
	});

	it('applies setSelectedPart right after mount and again on prop change', async () => {
		const handle = makeHandle();
		mountLineChart3D.mockResolvedValue(handle);
		const part: ChartPartRef = { role: 'dataPoint', seriesIndex: 1, pointIndex: 2 };

		await act(async () => {
			root.render(React.createElement(Line3DChartScene, { options, selectedPart: part }));
			await Promise.resolve();
		});
		expect(handle.setSelectedPart).toHaveBeenCalledWith(part);

		act(() => {
			root.render(React.createElement(Line3DChartScene, { options, selectedPart: null }));
		});
		expect(handle.setSelectedPart).toHaveBeenLastCalledWith(null);
	});

	it('applies setTextStyle right after mount and again on prop change', async () => {
		const handle = makeHandle();
		mountLineChart3D.mockResolvedValue(handle);

		await act(async () => {
			root.render(React.createElement(Line3DChartScene, { options, textStyle: { italic: true } }));
			await Promise.resolve();
		});
		expect(handle.setTextStyle).toHaveBeenCalledWith({ italic: true });

		act(() => {
			root.render(React.createElement(Line3DChartScene, { options, textStyle: undefined }));
		});
		expect(handle.setTextStyle).toHaveBeenLastCalledWith(undefined);
	});
});
