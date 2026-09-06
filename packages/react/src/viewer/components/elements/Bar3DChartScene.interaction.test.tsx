// @vitest-environment happy-dom
/**
 * Regression tests for Bar3DChartScene's interaction/selection/text-style
 * wiring:
 *  - the mount call receives a STABLE interaction bag, so a fresh inline
 *    interaction object from a re-rendering parent does not remount the
 *    WebGL scene (see `chart3d-interaction-hooks.ts`);
 *  - the mounted handle receives `setSelectedPart`/`setTextStyle` both right
 *    after mount (using the CURRENT prop, not whatever was passed when the
 *    mount effect started) and again on every later prop change.
 *
 * `mountBarChart3D` itself is stubbed; mounting a real WebGL scene needs a
 * real context, not available in happy-dom (see `Bar3DChartRenderer.test.ts`).
 */
import type { BarChart3DHandle, BarChart3DSceneOptions, ChartPartRef } from 'pptx-viewer-shared';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mountBarChart3D = vi.fn();

vi.mock(import('pptx-viewer-shared'), () => ({
	mountBarChart3D: (...args: unknown[]) => mountBarChart3D(...args),
}));

const { default: Bar3DChartScene } = await import('./Bar3DChartScene');

function makeHandle(): BarChart3DHandle {
	return {
		ok: true,
		resize: vi.fn(),
		setSelectedPart: vi.fn(),
		setTextStyle: vi.fn(),
		dispose: vi.fn(),
	};
}

const options = { width: 400, height: 300 } as unknown as BarChart3DSceneOptions;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
	mountBarChart3D.mockReset();
});

afterEach(() => {
	act(() => {
		root.unmount();
	});
	container.remove();
});

describe('bar3DChartScene interaction wiring', () => {
	it('mounts once and proxies interaction calls to the LATEST interaction prop', async () => {
		const handle = makeHandle();
		mountBarChart3D.mockResolvedValue(handle);
		const firstOnSelect = vi.fn();

		await act(async () => {
			root.render(
				React.createElement(Bar3DChartScene, { options, interaction: { onSelect: firstOnSelect } }),
			);
			await Promise.resolve();
		});
		expect(mountBarChart3D).toHaveBeenCalledOnce();
		const passedInteraction = mountBarChart3D.mock.calls[0]?.[2] as {
			onSelect: (part: ChartPartRef | null) => void;
		};

		passedInteraction.onSelect(null);
		expect(firstOnSelect).toHaveBeenCalledOnce();

		const secondOnSelect = vi.fn();
		act(() => {
			root.render(
				React.createElement(Bar3DChartScene, {
					options,
					interaction: { onSelect: secondOnSelect },
				}),
			);
		});
		// Re-rendering with a fresh inline interaction object must NOT remount
		// the scene: `mountBarChart3D` is still called only once.
		expect(mountBarChart3D).toHaveBeenCalledOnce();

		passedInteraction.onSelect(null);
		expect(secondOnSelect).toHaveBeenCalledOnce();
		expect(firstOnSelect).toHaveBeenCalledOnce();
	});

	it('applies setSelectedPart right after mount and again on prop change', async () => {
		const handle = makeHandle();
		mountBarChart3D.mockResolvedValue(handle);
		const part: ChartPartRef = { role: 'dataPoint', seriesIndex: 0, pointIndex: 1 };

		await act(async () => {
			root.render(React.createElement(Bar3DChartScene, { options, selectedPart: part }));
			await Promise.resolve();
		});
		expect(handle.setSelectedPart).toHaveBeenCalledWith(part);

		act(() => {
			root.render(React.createElement(Bar3DChartScene, { options, selectedPart: null }));
		});
		expect(handle.setSelectedPart).toHaveBeenLastCalledWith(null);
	});

	it('applies setTextStyle right after mount and again on prop change', async () => {
		const handle = makeHandle();
		mountBarChart3D.mockResolvedValue(handle);

		await act(async () => {
			root.render(React.createElement(Bar3DChartScene, { options, textStyle: { bold: true } }));
			await Promise.resolve();
		});
		expect(handle.setTextStyle).toHaveBeenCalledWith({ bold: true });

		act(() => {
			root.render(React.createElement(Bar3DChartScene, { options, textStyle: undefined }));
		});
		expect(handle.setTextStyle).toHaveBeenLastCalledWith(undefined);
	});
});
