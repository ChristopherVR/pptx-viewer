// @vitest-environment happy-dom
/**
 * Regression tests for PieChart3DScene's interaction/selection wiring.
 * Mirrors `Bar3DChartScene.interaction.test.tsx`; see there for the
 * rationale. Drag-to-value proxying (`onValueDragPreview`/`onValueDragCommit`)
 * is covered generically by `chart3d-interaction-hooks.test.tsx`
 * (`useStableChart3DInteraction`); pie3D draws no axis labels, so there is no
 * `setTextStyle` to cover here.
 */
import type { ChartPartRef, PieChart3DHandle, PieChart3DSceneOptions } from 'pptx-viewer-shared';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mountPieChart3D = vi.fn();

vi.mock(import('pptx-viewer-shared'), () => ({
	mountPieChart3D: (...args: unknown[]) => mountPieChart3D(...args),
}));

const { default: PieChart3DScene } = await import('./PieChart3DScene');

function makeHandle(): PieChart3DHandle {
	return {
		ok: true,
		resize: vi.fn(),
		setSelectedPart: vi.fn(),
		dispose: vi.fn(),
	};
}

const options = { width: 400, height: 300 } as unknown as PieChart3DSceneOptions;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
	mountPieChart3D.mockReset();
});

afterEach(() => {
	act(() => {
		root.unmount();
	});
	container.remove();
});

describe('pieChart3DScene interaction wiring', () => {
	it('mounts once and proxies onSelect to the LATEST interaction prop', async () => {
		const handle = makeHandle();
		mountPieChart3D.mockResolvedValue(handle);
		const firstOnSelect = vi.fn();

		await act(async () => {
			root.render(
				React.createElement(PieChart3DScene, { options, interaction: { onSelect: firstOnSelect } }),
			);
			await Promise.resolve();
		});
		expect(mountPieChart3D).toHaveBeenCalledOnce();
		const passedInteraction = mountPieChart3D.mock.calls[0]?.[2] as {
			onSelect: (part: ChartPartRef | null) => void;
		};

		passedInteraction.onSelect(null);
		expect(firstOnSelect).toHaveBeenCalledOnce();

		const secondOnSelect = vi.fn();
		act(() => {
			root.render(
				React.createElement(PieChart3DScene, {
					options,
					interaction: { onSelect: secondOnSelect },
				}),
			);
		});
		expect(mountPieChart3D).toHaveBeenCalledOnce();

		passedInteraction.onSelect(null);
		expect(secondOnSelect).toHaveBeenCalledOnce();
		expect(firstOnSelect).toHaveBeenCalledOnce();
	});

	it('applies setSelectedPart right after mount and again on prop change', async () => {
		const handle = makeHandle();
		mountPieChart3D.mockResolvedValue(handle);
		const part: ChartPartRef = { role: 'dataPoint', seriesIndex: 0, pointIndex: 2 };

		await act(async () => {
			root.render(React.createElement(PieChart3DScene, { options, selectedPart: part }));
			await Promise.resolve();
		});
		expect(handle.setSelectedPart).toHaveBeenCalledWith(part);

		act(() => {
			root.render(React.createElement(PieChart3DScene, { options, selectedPart: null }));
		});
		expect(handle.setSelectedPart).toHaveBeenLastCalledWith(null);
	});
});
