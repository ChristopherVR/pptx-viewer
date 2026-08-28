import type { PieChart3DSceneOptions } from 'pptx-viewer-shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick, ref } from 'vue';
import type { Ref } from 'vue';

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

vi.mock(import('pptx-viewer-shared'), () => ({
	mountPieChart3D: (...args: unknown[]) => mountPieChart3D(...args),
	PIE_CHART_THREE_UNAVAILABLE,
}));

function okHandle() {
	return {
		ok: true,
		resize: vi.fn(),
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
function run(refs: SceneRefs) {
	const scope = effectScope();
	const result = scope.run(() => usePieChart3dScene(refs))!;
	return { scope, result };
}

beforeEach(() => {
	mountPieChart3D.mockReset();
	mountPieChart3D.mockResolvedValue(okHandle());
	PIE_CHART_THREE_UNAVAILABLE.dispose.mockReset();
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

		expect(mountPieChart3D).toHaveBeenCalledWith(refs.container.value, refs.options.value);
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
});
