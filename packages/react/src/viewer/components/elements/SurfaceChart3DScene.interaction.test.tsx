// @vitest-environment happy-dom
/**
 * Regression tests for SurfaceChart3DScene's interaction/selection/text-style
 * wiring. Mirrors `Bar3DChartScene.interaction.test.tsx`; see there for the
 * rationale (stable interaction identity, mount-resolve catch-up). Surface has
 * no drag (one shared mesh), but keeps `setSelectedPart`/`setTextStyle`.
 */
import type {
	ChartPartRef,
	SurfaceChart3DHandle,
	SurfaceChart3DSceneOptions,
} from 'pptx-viewer-shared';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mountSurfaceChart3D = vi.fn();

vi.mock(import('pptx-viewer-shared'), () => ({
	mountSurfaceChart3D: (...args: unknown[]) => mountSurfaceChart3D(...args),
}));

const { default: SurfaceChart3DScene } = await import('./SurfaceChart3DScene');

function makeHandle(): SurfaceChart3DHandle {
	return {
		ok: true,
		resize: vi.fn(),
		setSelectedPart: vi.fn(),
		setTextStyle: vi.fn(),
		dispose: vi.fn(),
	};
}

const options = { width: 400, height: 300 } as unknown as SurfaceChart3DSceneOptions;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
	mountSurfaceChart3D.mockReset();
});

afterEach(() => {
	act(() => {
		root.unmount();
	});
	container.remove();
});

describe('surfaceChart3DScene interaction wiring', () => {
	it('mounts once and proxies onSelect to the LATEST interaction prop', async () => {
		const handle = makeHandle();
		mountSurfaceChart3D.mockResolvedValue(handle);
		const firstOnSelect = vi.fn();

		await act(async () => {
			root.render(
				React.createElement(SurfaceChart3DScene, {
					options,
					interaction: { onSelect: firstOnSelect },
				}),
			);
			await Promise.resolve();
		});
		expect(mountSurfaceChart3D).toHaveBeenCalledOnce();
		const passedInteraction = mountSurfaceChart3D.mock.calls[0]?.[2] as {
			onSelect: (part: ChartPartRef | null) => void;
		};

		passedInteraction.onSelect(null);
		expect(firstOnSelect).toHaveBeenCalledOnce();

		const secondOnSelect = vi.fn();
		act(() => {
			root.render(
				React.createElement(SurfaceChart3DScene, {
					options,
					interaction: { onSelect: secondOnSelect },
				}),
			);
		});
		expect(mountSurfaceChart3D).toHaveBeenCalledOnce();

		passedInteraction.onSelect(null);
		expect(secondOnSelect).toHaveBeenCalledOnce();
		expect(firstOnSelect).toHaveBeenCalledOnce();
	});

	it('applies setSelectedPart right after mount and again on prop change', async () => {
		const handle = makeHandle();
		mountSurfaceChart3D.mockResolvedValue(handle);
		const part: ChartPartRef = { role: 'dataPoint', seriesIndex: 2, pointIndex: 1 };

		await act(async () => {
			root.render(React.createElement(SurfaceChart3DScene, { options, selectedPart: part }));
			await Promise.resolve();
		});
		expect(handle.setSelectedPart).toHaveBeenCalledWith(part);

		act(() => {
			root.render(React.createElement(SurfaceChart3DScene, { options, selectedPart: null }));
		});
		expect(handle.setSelectedPart).toHaveBeenLastCalledWith(null);
	});

	it('applies setTextStyle right after mount and again on prop change', async () => {
		const handle = makeHandle();
		mountSurfaceChart3D.mockResolvedValue(handle);

		await act(async () => {
			root.render(
				React.createElement(SurfaceChart3DScene, { options, textStyle: { fontScale: 1.5 } }),
			);
			await Promise.resolve();
		});
		expect(handle.setTextStyle).toHaveBeenCalledWith({ fontScale: 1.5 });

		act(() => {
			root.render(React.createElement(SurfaceChart3DScene, { options, textStyle: undefined }));
		});
		expect(handle.setTextStyle).toHaveBeenLastCalledWith(undefined);
	});
});
