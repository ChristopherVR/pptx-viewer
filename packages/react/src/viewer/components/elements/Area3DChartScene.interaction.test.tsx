// @vitest-environment happy-dom
/**
 * Regression tests for Area3DChartScene's interaction/selection/text-style
 * wiring. Mirrors `Bar3DChartScene.interaction.test.tsx`; see there for the
 * rationale (stable interaction identity, mount-resolve catch-up).
 */
import type { AreaChart3DHandle, AreaChart3DSceneOptions, ChartPartRef } from 'pptx-viewer-shared';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mountAreaChart3D = vi.fn();

vi.mock(import('pptx-viewer-shared'), () => ({
	mountAreaChart3D: (...args: unknown[]) => mountAreaChart3D(...args),
}));

const { default: Area3DChartScene } = await import('./Area3DChartScene');

function makeHandle(): AreaChart3DHandle {
	return {
		ok: true,
		resize: vi.fn(),
		setSelectedPart: vi.fn(),
		setTextStyle: vi.fn(),
		dispose: vi.fn(),
	};
}

const options = { width: 400, height: 300 } as unknown as AreaChart3DSceneOptions;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
	mountAreaChart3D.mockReset();
});

afterEach(() => {
	act(() => {
		root.unmount();
	});
	container.remove();
});

describe('area3DChartScene interaction wiring', () => {
	it('mounts once and proxies interaction calls to the LATEST interaction prop', async () => {
		const handle = makeHandle();
		mountAreaChart3D.mockResolvedValue(handle);
		const firstOnSelect = vi.fn();

		await act(async () => {
			root.render(
				React.createElement(Area3DChartScene, {
					options,
					interaction: { onSelect: firstOnSelect },
				}),
			);
			await Promise.resolve();
		});
		expect(mountAreaChart3D).toHaveBeenCalledOnce();
		const passedInteraction = mountAreaChart3D.mock.calls[0]?.[2] as {
			onSelect: (part: ChartPartRef | null) => void;
		};

		passedInteraction.onSelect(null);
		expect(firstOnSelect).toHaveBeenCalledOnce();

		const secondOnSelect = vi.fn();
		act(() => {
			root.render(
				React.createElement(Area3DChartScene, {
					options,
					interaction: { onSelect: secondOnSelect },
				}),
			);
		});
		expect(mountAreaChart3D).toHaveBeenCalledOnce();

		passedInteraction.onSelect(null);
		expect(secondOnSelect).toHaveBeenCalledOnce();
		expect(firstOnSelect).toHaveBeenCalledOnce();
	});

	it('applies setSelectedPart right after mount and again on prop change', async () => {
		const handle = makeHandle();
		mountAreaChart3D.mockResolvedValue(handle);
		const part: ChartPartRef = { role: 'dataPoint', seriesIndex: 0, pointIndex: 3 };

		await act(async () => {
			root.render(React.createElement(Area3DChartScene, { options, selectedPart: part }));
			await Promise.resolve();
		});
		expect(handle.setSelectedPart).toHaveBeenCalledWith(part);

		act(() => {
			root.render(React.createElement(Area3DChartScene, { options, selectedPart: null }));
		});
		expect(handle.setSelectedPart).toHaveBeenLastCalledWith(null);
	});

	it('applies setTextStyle right after mount and again on prop change', async () => {
		const handle = makeHandle();
		mountAreaChart3D.mockResolvedValue(handle);

		await act(async () => {
			root.render(
				React.createElement(Area3DChartScene, { options, textStyle: { underline: true } }),
			);
			await Promise.resolve();
		});
		expect(handle.setTextStyle).toHaveBeenCalledWith({ underline: true });

		act(() => {
			root.render(React.createElement(Area3DChartScene, { options, textStyle: undefined }));
		});
		expect(handle.setTextStyle).toHaveBeenLastCalledWith(undefined);
	});
});
