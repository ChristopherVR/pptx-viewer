import type { SurfaceChart3DSceneOptions } from 'pptx-viewer-shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick, ref } from 'vue';
import type { Ref } from 'vue';

import type { ChartCanvasEditContext, ChartPartSelection } from './chart-part-selection';
import { useSurfaceChart3dScene } from './useSurfaceChart3dScene';

// Mock the shared controller so `three` is never required. `mountSurfaceChart3D`
// resolves to a configurable handle; `SURFACE_THREE_UNAVAILABLE` mirrors the
// real no-op sentinel (ok === false). Defined via vi.hoisted so the hoisted
// vi.mock factory can reference them.
const { SURFACE_THREE_UNAVAILABLE, mountSurfaceChart3D } = vi.hoisted(() => ({
	SURFACE_THREE_UNAVAILABLE: {
		ok: false,
		resize: vi.fn(),
		dispose: vi.fn(),
	},
	mountSurfaceChart3D: vi.fn(),
}));

vi.mock(import('pptx-viewer-shared'), async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual,
		mountSurfaceChart3D: (...args: unknown[]) => mountSurfaceChart3D(...args),
		SURFACE_THREE_UNAVAILABLE,
	};
});

// The composable calls `injectChartCanvasEdit()` internally; mock it so tests
// can supply a plain (non-injected) `ChartCanvasEditContext` fake without a
// real Vue component/provide tree.
const { injectChartCanvasEdit } = vi.hoisted(() => ({ injectChartCanvasEdit: vi.fn() }));
vi.mock(import('./chart-part-selection'), async (importOriginal) => {
	const actual = await importOriginal();
	return { ...actual, injectChartCanvasEdit };
});

function makeCtx(overrides: Partial<ChartCanvasEditContext> = {}): ChartCanvasEditContext {
	return {
		selection: ref<ChartPartSelection | null>(null),
		setSelection: vi.fn(),
		canSelectCharts: () => true,
		canEditChart: () => true,
		updateElement: vi.fn(),
		...overrides,
	};
}

function okHandle() {
	return {
		ok: true,
		resize: vi.fn(),
		setSelectedPart: vi.fn(),
		setTextStyle: vi.fn(),
		dispose: vi.fn(),
	};
}

function grid(overrides: Partial<SurfaceChart3DSceneOptions> = {}): SurfaceChart3DSceneOptions {
	return {
		cols: 2,
		rows: 2,
		heightMap: new Float32Array([0, 0.5, 1, 0.25]),
		colorMap: new Float32Array(12).fill(0.5),
		wireframe: true,
		categoryLabels: ['A', 'B'],
		seriesNames: ['S1', 'S2'],
		width: 400,
		height: 300,
		...overrides,
	};
}

interface SceneRefs {
	container: Ref<HTMLElement | null>;
	options: Ref<SurfaceChart3DSceneOptions | null>;
}

/** Run the composable inside an effect scope so onScopeDispose fires on stop(). */
function run(
	refs: SceneRefs,
	extra: {
		chartData?: () => import('pptx-viewer-core').PptxChartData | undefined;
		textStyle?: Ref<import('pptx-viewer-shared').TextStyleAnimationDescriptor | undefined>;
	} = {},
) {
	const scope = effectScope();
	const result = scope.run(() =>
		useSurfaceChart3dScene({
			...refs,
			elementId: () => 'el-1',
			chartData: extra.chartData ?? (() => undefined),
			textStyle: extra.textStyle,
		}),
	)!;
	return { scope, result };
}

function chartData() {
	return {
		chartType: 'surface3D',
		series: [
			{ name: 'S1', values: [1, 2] },
			{ name: 'S2', values: [3, 4] },
		],
		categories: ['A', 'B'],
	} as unknown as import('pptx-viewer-core').PptxChartData;
}

beforeEach(() => {
	mountSurfaceChart3D.mockReset();
	mountSurfaceChart3D.mockResolvedValue(okHandle());
	SURFACE_THREE_UNAVAILABLE.dispose.mockReset();
	injectChartCanvasEdit.mockReset();
	injectChartCanvasEdit.mockReturnValue(undefined);
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('useSurfaceChart3dScene', () => {
	it('mounts the shared scene when grid data and a container are present', async () => {
		const handle = okHandle();
		mountSurfaceChart3D.mockResolvedValue(handle);
		const refs: SceneRefs = {
			container: ref(document.createElement('div')),
			options: ref(grid()),
		};

		const { result } = run(refs);
		await nextTick();
		await Promise.resolve();

		expect(mountSurfaceChart3D).toHaveBeenCalledWith(
			refs.container.value,
			{ ...refs.options.value, textStyle: undefined },
			expect.objectContaining({
				onSelect: expect.any(Function),
				onValueDragPreview: expect.any(Function),
				onValueDragCommit: expect.any(Function),
			}),
		);
		expect(result.mounted.value).toBeTruthy();
	});

	it('does not mount and stays unmounted when there is no grid data', async () => {
		const refs: SceneRefs = {
			container: ref(document.createElement('div')),
			options: ref(null),
		};

		const { result } = run(refs);
		await nextTick();
		await Promise.resolve();

		expect(mountSurfaceChart3D).not.toHaveBeenCalled();
		expect(result.mounted.value).toBeFalsy();
	});

	it('stays unmounted (SVG fallback) when mount resolves to SURFACE_THREE_UNAVAILABLE', async () => {
		mountSurfaceChart3D.mockResolvedValue(SURFACE_THREE_UNAVAILABLE);
		const refs: SceneRefs = {
			container: ref(document.createElement('div')),
			options: ref(grid()),
		};

		const { result } = run(refs);
		await nextTick();
		await Promise.resolve();

		expect(mountSurfaceChart3D).toHaveBeenCalledOnce();
		expect(result.mounted.value).toBeFalsy();
	});

	it('disposes the handle on scope stop', async () => {
		const handle = okHandle();
		mountSurfaceChart3D.mockResolvedValue(handle);
		const refs: SceneRefs = {
			container: ref(document.createElement('div')),
			options: ref(grid()),
		};

		const { scope } = run(refs);
		await nextTick();
		await Promise.resolve();

		scope.stop();

		expect(handle.dispose).toHaveBeenCalledOnce();
	});

	it('remounts (does not resize in place) when only width/height change', async () => {
		const first = okHandle();
		const second = okHandle();
		mountSurfaceChart3D.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
		const refs: SceneRefs = {
			container: ref(document.createElement('div')),
			options: ref(grid()),
		};

		run(refs);
		await nextTick();
		await Promise.resolve();

		refs.options.value = grid({ width: 200, height: 150 });
		await nextTick();
		await Promise.resolve();

		// `buildSurfaceChart3DDataForElement` returns a fresh object on every
		// call, so a size-only change is indistinguishable from a data change
		// here: it remounts like one, matching the React/Angular ports.
		expect(first.dispose).toHaveBeenCalledOnce();
		expect(mountSurfaceChart3D).toHaveBeenCalledTimes(2);
		expect(mountSurfaceChart3D).toHaveBeenLastCalledWith(
			refs.container.value,
			expect.objectContaining({ width: 200, height: 150 }),
			expect.any(Object),
		);
	});

	it('remounts and disposes the prior handle when grid data changes', async () => {
		const first = okHandle();
		const second = okHandle();
		mountSurfaceChart3D.mockResolvedValueOnce(first).mockResolvedValueOnce(second);

		const refs: SceneRefs = {
			container: ref(document.createElement('div')),
			options: ref(grid()),
		};

		run(refs);
		await nextTick();
		await Promise.resolve();

		refs.options.value = grid({ cols: 3, rows: 3 });
		await nextTick();
		await Promise.resolve();

		expect(first.dispose).toHaveBeenCalledOnce();
		expect(mountSurfaceChart3D).toHaveBeenCalledTimes(2);
	});

	it('mounts with the active text-style override and re-applies it via setTextStyle when it changes', async () => {
		const handle = okHandle();
		mountSurfaceChart3D.mockResolvedValue(handle);
		const textStyle = ref<import('pptx-viewer-shared').TextStyleAnimationDescriptor | undefined>({
			bold: true,
		});
		const refs: SceneRefs = {
			container: ref(document.createElement('div')),
			options: ref(grid()),
		};

		run(refs, { textStyle });
		await nextTick();
		await Promise.resolve();

		expect(mountSurfaceChart3D).toHaveBeenCalledWith(
			refs.container.value,
			expect.objectContaining({ textStyle: { bold: true } }),
			expect.any(Object),
		);

		textStyle.value = { underline: true };
		await nextTick();

		expect(handle.setTextStyle).toHaveBeenCalledWith({ underline: true });
	});

	it('selects the clicked facet through the injected chart-canvas-edit context', async () => {
		const ctx = makeCtx();
		injectChartCanvasEdit.mockReturnValue(ctx);
		const handle = okHandle();
		mountSurfaceChart3D.mockResolvedValue(handle);
		const refs: SceneRefs = {
			container: ref(document.createElement('div')),
			options: ref(grid()),
		};

		run(refs);
		await nextTick();
		await Promise.resolve();

		const interaction = mountSurfaceChart3D.mock.calls[0]![2] as {
			onSelect: (
				part: { role: 'dataPoint'; seriesIndex: number; pointIndex: number } | null,
			) => void;
		};
		interaction.onSelect({ role: 'dataPoint', seriesIndex: 0, pointIndex: 0 });

		expect(ctx.setSelection).toHaveBeenCalledWith({
			elementId: 'el-1',
			part: { role: 'dataPoint', seriesIndex: 0, pointIndex: 0 },
		});
	});

	it('commits a value drag through withChartPointValue and the same update path 2D dragging uses', async () => {
		const ctx = makeCtx();
		injectChartCanvasEdit.mockReturnValue(ctx);
		const handle = okHandle();
		mountSurfaceChart3D.mockResolvedValue(handle);
		const refs: SceneRefs = {
			container: ref(document.createElement('div')),
			options: ref(grid()),
		};

		run(refs, { chartData });
		await nextTick();
		await Promise.resolve();

		const interaction = mountSurfaceChart3D.mock.calls[0]![2] as {
			onValueDragCommit: (
				part: { role: 'dataPoint'; seriesIndex: number; pointIndex: number },
				value: number,
			) => void;
		};
		interaction.onValueDragCommit({ role: 'dataPoint', seriesIndex: 1, pointIndex: 0 }, 42);

		expect(ctx.updateElement).toHaveBeenCalledOnce();
		const [elementId, patch] = vi.mocked(ctx.updateElement).mock.calls[0]!;
		expect(elementId).toBe('el-1');
		expect(
			(patch as { chartData: import('pptx-viewer-core').PptxChartData }).chartData.series[1]
				?.values?.[0],
		).toBe(42);
	});

	it('re-applies setSelectedPart when the selection changes from outside this scene', async () => {
		const ctx = makeCtx();
		injectChartCanvasEdit.mockReturnValue(ctx);
		const handle = okHandle();
		mountSurfaceChart3D.mockResolvedValue(handle);
		const refs: SceneRefs = {
			container: ref(document.createElement('div')),
			options: ref(grid()),
		};

		run(refs);
		await nextTick();
		await Promise.resolve();
		handle.setSelectedPart.mockClear();

		ctx.selection.value = {
			elementId: 'el-1',
			part: { role: 'dataPoint', seriesIndex: 1, pointIndex: 0 },
		};
		await nextTick();

		expect(handle.setSelectedPart).toHaveBeenCalledWith({
			role: 'dataPoint',
			seriesIndex: 1,
			pointIndex: 0,
		});
	});
});
