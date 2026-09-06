import type { PieChart3DSceneOptions } from 'pptx-viewer-shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick, ref } from 'vue';
import type { Ref } from 'vue';

import type { ChartCanvasEditContext, ChartPartSelection } from './chart-part-selection';
import { usePieChart3dScene } from './usePieChart3dScene';

// Mock the shared controller so `three` is never required. `mountPieChart3D`
// resolves to a configurable handle; `PIE_CHART_THREE_UNAVAILABLE` mirrors the
// real no-op sentinel (ok === false). Defined via vi.hoisted so the hoisted
// vi.mock factory can reference them.
const { PIE_CHART_THREE_UNAVAILABLE, mountPieChart3D } = vi.hoisted(() => ({
	PIE_CHART_THREE_UNAVAILABLE: {
		ok: false,
		resize: vi.fn(),
		dispose: vi.fn(),
	},
	mountPieChart3D: vi.fn(),
}));

vi.mock(import('pptx-viewer-shared'), async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual,
		mountPieChart3D: (...args: unknown[]) => mountPieChart3D(...args),
		PIE_CHART_THREE_UNAVAILABLE,
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
		dispose: vi.fn(),
	};
}

function wedges(overrides: Partial<PieChart3DSceneOptions> = {}): PieChart3DSceneOptions {
	return {
		wedges: [
			{
				pointIndex: 0,
				value: 10,
				startAngle: 0,
				thetaLength: Math.PI,
				explodeOffset: [0, 0],
				color: '#4472c4',
			},
		],
		categoryLabels: ['A', 'B'],
		seriesName: 'S1',
		numberFormat: undefined,
		outerRadius: 1,
		thickness: 0.3,
		width: 400,
		height: 300,
		...overrides,
	};
}

interface SceneRefs {
	container: Ref<HTMLElement | null>;
	options: Ref<PieChart3DSceneOptions | null>;
}

/** Run the composable inside an effect scope so onScopeDispose fires on stop(). */
function run(
	refs: SceneRefs,
	extra: { chartData?: () => import('pptx-viewer-core').PptxChartData | undefined } = {},
) {
	const scope = effectScope();
	const result = scope.run(() =>
		usePieChart3dScene({
			...refs,
			elementId: () => 'el-1',
			chartData: extra.chartData ?? (() => undefined),
		}),
	)!;
	return { scope, result };
}

function chartData() {
	return {
		chartType: 'pie3D',
		series: [{ name: 'S1', values: [10, 20] }],
		categories: ['A', 'B'],
	} as unknown as import('pptx-viewer-core').PptxChartData;
}

beforeEach(() => {
	mountPieChart3D.mockReset();
	mountPieChart3D.mockResolvedValue(okHandle());
	PIE_CHART_THREE_UNAVAILABLE.dispose.mockReset();
	injectChartCanvasEdit.mockReset();
	injectChartCanvasEdit.mockReturnValue(undefined);
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('usePieChart3dScene', () => {
	it('mounts the shared scene when wedge data and a container are present', async () => {
		const handle = okHandle();
		mountPieChart3D.mockResolvedValue(handle);
		const refs: SceneRefs = {
			container: ref(document.createElement('div')),
			options: ref(wedges()),
		};

		const { result } = run(refs);
		await nextTick();
		await Promise.resolve();

		expect(mountPieChart3D).toHaveBeenCalledWith(
			refs.container.value,
			refs.options.value,
			expect.objectContaining({ onSelect: expect.any(Function) }),
		);
		expect(result.mounted.value).toBeTruthy();
	});

	it('does not mount and stays unmounted when there is no wedge data', async () => {
		const refs: SceneRefs = {
			container: ref(document.createElement('div')),
			options: ref(null),
		};

		const { result } = run(refs);
		await nextTick();
		await Promise.resolve();

		expect(mountPieChart3D).not.toHaveBeenCalled();
		expect(result.mounted.value).toBeFalsy();
	});

	it('stays unmounted (SVG fallback) when mount resolves to PIE_CHART_THREE_UNAVAILABLE', async () => {
		mountPieChart3D.mockResolvedValue(PIE_CHART_THREE_UNAVAILABLE);
		const refs: SceneRefs = {
			container: ref(document.createElement('div')),
			options: ref(wedges()),
		};

		const { result } = run(refs);
		await nextTick();
		await Promise.resolve();

		expect(mountPieChart3D).toHaveBeenCalledOnce();
		expect(result.mounted.value).toBeFalsy();
	});

	it('disposes the handle on scope stop', async () => {
		const handle = okHandle();
		mountPieChart3D.mockResolvedValue(handle);
		const refs: SceneRefs = {
			container: ref(document.createElement('div')),
			options: ref(wedges()),
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
		mountPieChart3D.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
		const refs: SceneRefs = {
			container: ref(document.createElement('div')),
			options: ref(wedges()),
		};

		run(refs);
		await nextTick();
		await Promise.resolve();

		refs.options.value = wedges({ width: 200, height: 150 });
		await nextTick();
		await Promise.resolve();

		// `buildPieChart3DDataForElement` returns a fresh object on every call,
		// so a size-only change is indistinguishable from a data change here: it
		// remounts like one, matching the bar-chart composable's same property.
		expect(first.dispose).toHaveBeenCalledOnce();
		expect(mountPieChart3D).toHaveBeenCalledTimes(2);
		expect(mountPieChart3D).toHaveBeenLastCalledWith(
			refs.container.value,
			expect.objectContaining({ width: 200, height: 150 }),
			expect.any(Object),
		);
	});

	it('remounts and disposes the prior handle when wedge data changes', async () => {
		const first = okHandle();
		const second = okHandle();
		mountPieChart3D.mockResolvedValueOnce(first).mockResolvedValueOnce(second);

		const refs: SceneRefs = {
			container: ref(document.createElement('div')),
			options: ref(wedges()),
		};

		run(refs);
		await nextTick();
		await Promise.resolve();

		refs.options.value = wedges({ seriesName: 'S2' });
		await nextTick();
		await Promise.resolve();

		expect(first.dispose).toHaveBeenCalledOnce();
		expect(mountPieChart3D).toHaveBeenCalledTimes(2);
	});

	it('selects the clicked wedge through the injected chart-canvas-edit context', async () => {
		const ctx = makeCtx();
		injectChartCanvasEdit.mockReturnValue(ctx);
		const handle = okHandle();
		mountPieChart3D.mockResolvedValue(handle);
		const refs: SceneRefs = {
			container: ref(document.createElement('div')),
			options: ref(wedges()),
		};

		run(refs);
		await nextTick();
		await Promise.resolve();

		const interaction = mountPieChart3D.mock.calls[0]![2] as {
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
		mountPieChart3D.mockResolvedValue(handle);
		const refs: SceneRefs = {
			container: ref(document.createElement('div')),
			options: ref(wedges()),
		};

		run(refs, { chartData });
		await nextTick();
		await Promise.resolve();

		const interaction = mountPieChart3D.mock.calls[0]![2] as {
			onValueDragCommit: (
				part: { role: 'dataPoint'; seriesIndex: number; pointIndex: number },
				value: number,
			) => void;
		};
		interaction.onValueDragCommit({ role: 'dataPoint', seriesIndex: 0, pointIndex: 1 }, 42);

		expect(ctx.updateElement).toHaveBeenCalledOnce();
		const [elementId, patch] = vi.mocked(ctx.updateElement).mock.calls[0]!;
		expect(elementId).toBe('el-1');
		expect(
			(patch as { chartData: import('pptx-viewer-core').PptxChartData }).chartData.series[0]
				?.values?.[1],
		).toBe(42);
	});

	it('drives the drag label from onValueDragPreview, clearing it on commit', async () => {
		const ctx = makeCtx();
		injectChartCanvasEdit.mockReturnValue(ctx);
		const handle = okHandle();
		mountPieChart3D.mockResolvedValue(handle);
		const refs: SceneRefs = {
			container: ref(document.createElement('div')),
			options: ref(wedges()),
		};

		const { result } = run(refs, { chartData });
		await nextTick();
		await Promise.resolve();

		const interaction = mountPieChart3D.mock.calls[0]![2] as {
			onValueDragPreview: (
				part: { role: 'dataPoint'; seriesIndex: number; pointIndex: number },
				value: number,
			) => void;
			onValueDragCommit: (
				part: { role: 'dataPoint'; seriesIndex: number; pointIndex: number },
				value: number,
			) => void;
		};

		expect(result.dragLabel.value).toBeNull();
		interaction.onValueDragPreview({ role: 'dataPoint', seriesIndex: 0, pointIndex: 1 }, 42);
		expect(result.dragLabel.value).not.toBeNull();

		interaction.onValueDragCommit({ role: 'dataPoint', seriesIndex: 0, pointIndex: 1 }, 42);
		expect(result.dragLabel.value).toBeNull();
	});

	it('applies the current selection to a freshly mounted handle', async () => {
		const ctx = makeCtx({
			selection: ref({
				elementId: 'el-1',
				part: { role: 'dataPoint', seriesIndex: 0, pointIndex: 0 },
			}),
		});
		injectChartCanvasEdit.mockReturnValue(ctx);
		const handle = okHandle();
		mountPieChart3D.mockResolvedValue(handle);
		const refs: SceneRefs = {
			container: ref(document.createElement('div')),
			options: ref(wedges()),
		};

		run(refs);
		await nextTick();
		await Promise.resolve();

		expect(handle.setSelectedPart).toHaveBeenCalledWith({
			role: 'dataPoint',
			seriesIndex: 0,
			pointIndex: 0,
		});
	});

	it('re-applies setSelectedPart when the selection changes from outside this scene', async () => {
		const ctx = makeCtx();
		injectChartCanvasEdit.mockReturnValue(ctx);
		const handle = okHandle();
		mountPieChart3D.mockResolvedValue(handle);
		const refs: SceneRefs = {
			container: ref(document.createElement('div')),
			options: ref(wedges()),
		};

		run(refs);
		await nextTick();
		await Promise.resolve();
		handle.setSelectedPart.mockClear();

		ctx.selection.value = {
			elementId: 'el-1',
			part: { role: 'dataPoint', seriesIndex: 0, pointIndex: 1 },
		};
		await nextTick();

		expect(handle.setSelectedPart).toHaveBeenCalledWith({
			role: 'dataPoint',
			seriesIndex: 0,
			pointIndex: 1,
		});
	});
});
