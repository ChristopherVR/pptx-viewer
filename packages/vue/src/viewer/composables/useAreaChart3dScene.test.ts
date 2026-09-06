import type { AreaChart3DSceneOptions } from 'pptx-viewer-shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick, ref } from 'vue';
import type { Ref } from 'vue';

import type { ChartCanvasEditContext, ChartPartSelection } from './chart-part-selection';
import { useAreaChart3dScene } from './useAreaChart3dScene';

const { AREA_CHART_THREE_UNAVAILABLE, mountAreaChart3D } = vi.hoisted(() => ({
	AREA_CHART_THREE_UNAVAILABLE: {
		ok: false,
		resize: vi.fn(),
		dispose: vi.fn(),
	},
	mountAreaChart3D: vi.fn(),
}));

vi.mock(import('pptx-viewer-shared'), async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual,
		mountAreaChart3D: (...args: unknown[]) => mountAreaChart3D(...args),
		AREA_CHART_THREE_UNAVAILABLE,
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

function paths(overrides: Partial<AreaChart3DSceneOptions> = {}): AreaChart3DSceneOptions {
	return {
		cols: 2,
		rows: 1,
		series: [
			{
				seriesIndex: 0,
				color: '#4472c4',
				depthZ: 0,
				baselineY: 0,
				vertices: [
					{ seriesIndex: 0, categoryIndex: 0, value: 10, position: [-0.25, 0.5, 0] },
					{ seriesIndex: 0, categoryIndex: 1, value: 20, position: [0.25, 1, 0] },
				],
			},
		],
		categoryLabels: ['A', 'B'],
		seriesNames: ['S1'],
		width: 400,
		height: 300,
		...overrides,
	};
}

interface SceneRefs {
	container: Ref<HTMLElement | null>;
	options: Ref<AreaChart3DSceneOptions | null>;
}

function run(
	refs: SceneRefs,
	extra: {
		chartData?: () => import('pptx-viewer-core').PptxChartData | undefined;
		textStyle?: Ref<import('pptx-viewer-shared').TextStyleAnimationDescriptor | undefined>;
	} = {},
) {
	const scope = effectScope();
	const result = scope.run(() =>
		useAreaChart3dScene({
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
		chartType: 'area3D',
		series: [{ name: 'S1', values: [10, 20] }],
		categories: ['A', 'B'],
	} as unknown as import('pptx-viewer-core').PptxChartData;
}

beforeEach(() => {
	mountAreaChart3D.mockReset();
	mountAreaChart3D.mockResolvedValue(okHandle());
	AREA_CHART_THREE_UNAVAILABLE.dispose.mockReset();
	injectChartCanvasEdit.mockReset();
	injectChartCanvasEdit.mockReturnValue(undefined);
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('useAreaChart3dScene', () => {
	it('mounts the shared scene when path data and a container are present', async () => {
		const handle = okHandle();
		mountAreaChart3D.mockResolvedValue(handle);
		const refs: SceneRefs = {
			container: ref(document.createElement('div')),
			options: ref(paths()),
		};

		const { result } = run(refs);
		await nextTick();
		await Promise.resolve();

		expect(mountAreaChart3D).toHaveBeenCalledWith(
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

	it('does not mount and stays unmounted when there is no path data', async () => {
		const refs: SceneRefs = {
			container: ref(document.createElement('div')),
			options: ref(null),
		};

		const { result } = run(refs);
		await nextTick();
		await Promise.resolve();

		expect(mountAreaChart3D).not.toHaveBeenCalled();
		expect(result.mounted.value).toBeFalsy();
	});

	it('stays unmounted (SVG fallback) when mount resolves to AREA_CHART_THREE_UNAVAILABLE', async () => {
		mountAreaChart3D.mockResolvedValue(AREA_CHART_THREE_UNAVAILABLE);
		const refs: SceneRefs = {
			container: ref(document.createElement('div')),
			options: ref(paths()),
		};

		const { result } = run(refs);
		await nextTick();
		await Promise.resolve();

		expect(mountAreaChart3D).toHaveBeenCalledOnce();
		expect(result.mounted.value).toBeFalsy();
	});

	it('disposes the handle on scope stop', async () => {
		const handle = okHandle();
		mountAreaChart3D.mockResolvedValue(handle);
		const refs: SceneRefs = {
			container: ref(document.createElement('div')),
			options: ref(paths()),
		};

		const { scope } = run(refs);
		await nextTick();
		await Promise.resolve();

		scope.stop();

		expect(handle.dispose).toHaveBeenCalledOnce();
	});

	it('remounts and disposes the prior handle when path data changes', async () => {
		const first = okHandle();
		const second = okHandle();
		mountAreaChart3D.mockResolvedValueOnce(first).mockResolvedValueOnce(second);

		const refs: SceneRefs = {
			container: ref(document.createElement('div')),
			options: ref(paths()),
		};

		run(refs);
		await nextTick();
		await Promise.resolve();

		refs.options.value = paths({ seriesNames: ['S1', 'S2'] });
		await nextTick();
		await Promise.resolve();

		expect(first.dispose).toHaveBeenCalledOnce();
		expect(mountAreaChart3D).toHaveBeenCalledTimes(2);
	});

	it('mounts with the active text-style override and re-applies it via setTextStyle when it changes', async () => {
		const handle = okHandle();
		mountAreaChart3D.mockResolvedValue(handle);
		const textStyle = ref<import('pptx-viewer-shared').TextStyleAnimationDescriptor | undefined>({
			bold: true,
		});
		const refs: SceneRefs = {
			container: ref(document.createElement('div')),
			options: ref(paths()),
		};

		run(refs, { textStyle });
		await nextTick();
		await Promise.resolve();

		expect(mountAreaChart3D).toHaveBeenCalledWith(
			refs.container.value,
			expect.objectContaining({ textStyle: { bold: true } }),
			expect.any(Object),
		);

		textStyle.value = { underline: true };
		await nextTick();

		expect(handle.setTextStyle).toHaveBeenCalledWith({ underline: true });
	});

	it('selects the clicked part through the injected chart-canvas-edit context', async () => {
		const ctx = makeCtx();
		injectChartCanvasEdit.mockReturnValue(ctx);
		const handle = okHandle();
		mountAreaChart3D.mockResolvedValue(handle);
		const refs: SceneRefs = {
			container: ref(document.createElement('div')),
			options: ref(paths()),
		};

		run(refs);
		await nextTick();
		await Promise.resolve();

		const interaction = mountAreaChart3D.mock.calls[0]![2] as {
			onSelect: (
				part: { role: 'dataPoint'; seriesIndex: number; pointIndex: number } | null,
			) => void;
		};
		interaction.onSelect({ role: 'dataPoint', seriesIndex: 0, pointIndex: 1 });

		expect(ctx.setSelection).toHaveBeenCalledWith({
			elementId: 'el-1',
			part: { role: 'dataPoint', seriesIndex: 0, pointIndex: 1 },
		});
	});

	it('commits a value drag through withChartPointValue and the same update path 2D dragging uses', async () => {
		const ctx = makeCtx();
		injectChartCanvasEdit.mockReturnValue(ctx);
		const handle = okHandle();
		mountAreaChart3D.mockResolvedValue(handle);
		const refs: SceneRefs = {
			container: ref(document.createElement('div')),
			options: ref(paths()),
		};

		run(refs, { chartData });
		await nextTick();
		await Promise.resolve();

		const interaction = mountAreaChart3D.mock.calls[0]![2] as {
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

	it('re-applies setSelectedPart when the selection changes from outside this scene', async () => {
		const ctx = makeCtx();
		injectChartCanvasEdit.mockReturnValue(ctx);
		const handle = okHandle();
		mountAreaChart3D.mockResolvedValue(handle);
		const refs: SceneRefs = {
			container: ref(document.createElement('div')),
			options: ref(paths()),
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
