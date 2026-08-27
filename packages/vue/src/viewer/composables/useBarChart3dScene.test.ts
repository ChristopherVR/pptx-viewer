import type { BarChart3DSceneOptions } from 'pptx-viewer-shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick, ref } from 'vue';
import type { Ref } from 'vue';

import { useBarChart3dScene } from './useBarChart3dScene';

// Mock the shared controller so `three` is never required. `mountBarChart3D`
// resolves to a configurable handle; `BAR_CHART_THREE_UNAVAILABLE` mirrors the
// real no-op sentinel (ok === false). Defined via vi.hoisted so the hoisted
// vi.mock factory can reference them.
const { BAR_CHART_THREE_UNAVAILABLE, mountBarChart3D } = vi.hoisted(() => ({
	BAR_CHART_THREE_UNAVAILABLE: {
		ok: false,
		resize: vi.fn(),
		dispose: vi.fn(),
	},
	mountBarChart3D: vi.fn(),
}));

vi.mock(import('pptx-viewer-shared'), () => ({
	mountBarChart3D: (...args: unknown[]) => mountBarChart3D(...args),
	BAR_CHART_THREE_UNAVAILABLE,
}));

function okHandle() {
	return {
		ok: true,
		resize: vi.fn(),
		dispose: vi.fn(),
	};
}

function boxes(overrides: Partial<BarChart3DSceneOptions> = {}): BarChart3DSceneOptions {
	return {
		cols: 2,
		rows: 1,
		boxes: [
			{
				seriesIndex: 0,
				categoryIndex: 0,
				value: 10,
				color: '#4472c4',
				center: [0, 0.5, 0],
				size: [1, 1, 1],
			},
		],
		categoryLabels: ['A', 'B'],
		seriesNames: ['S1', 'S2'],
		grouping: 'clustered',
		width: 400,
		height: 300,
		...overrides,
	};
}

interface SceneRefs {
	container: Ref<HTMLElement | null>;
	options: Ref<BarChart3DSceneOptions | null>;
}

/** Run the composable inside an effect scope so onScopeDispose fires on stop(). */
function run(refs: SceneRefs) {
	const scope = effectScope();
	const result = scope.run(() => useBarChart3dScene(refs))!;
	return { scope, result };
}

beforeEach(() => {
	mountBarChart3D.mockReset();
	mountBarChart3D.mockResolvedValue(okHandle());
	BAR_CHART_THREE_UNAVAILABLE.dispose.mockReset();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('useBarChart3dScene', () => {
	it('mounts the shared scene when box data and a container are present', async () => {
		const handle = okHandle();
		mountBarChart3D.mockResolvedValue(handle);
		const refs: SceneRefs = {
			container: ref(document.createElement('div')),
			options: ref(boxes()),
		};

		const { result } = run(refs);
		await nextTick();
		await Promise.resolve();

		expect(mountBarChart3D).toHaveBeenCalledWith(refs.container.value, refs.options.value);
		expect(result.mounted.value).toBeTruthy();
	});

	it('does not mount and stays unmounted when there is no box data', async () => {
		const refs: SceneRefs = {
			container: ref(document.createElement('div')),
			options: ref(null),
		};

		const { result } = run(refs);
		await nextTick();
		await Promise.resolve();

		expect(mountBarChart3D).not.toHaveBeenCalled();
		expect(result.mounted.value).toBeFalsy();
	});

	it('stays unmounted (SVG fallback) when mount resolves to BAR_CHART_THREE_UNAVAILABLE', async () => {
		mountBarChart3D.mockResolvedValue(BAR_CHART_THREE_UNAVAILABLE);
		const refs: SceneRefs = {
			container: ref(document.createElement('div')),
			options: ref(boxes()),
		};

		const { result } = run(refs);
		await nextTick();
		await Promise.resolve();

		expect(mountBarChart3D).toHaveBeenCalledOnce();
		expect(result.mounted.value).toBeFalsy();
	});

	it('disposes the handle on scope stop', async () => {
		const handle = okHandle();
		mountBarChart3D.mockResolvedValue(handle);
		const refs: SceneRefs = {
			container: ref(document.createElement('div')),
			options: ref(boxes()),
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
		mountBarChart3D.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
		const refs: SceneRefs = {
			container: ref(document.createElement('div')),
			options: ref(boxes()),
		};

		run(refs);
		await nextTick();
		await Promise.resolve();

		refs.options.value = boxes({ width: 200, height: 150 });
		await nextTick();
		await Promise.resolve();

		// `buildBarChart3DDataForElement` returns a fresh object on every call,
		// so a size-only change is indistinguishable from a data change here: it
		// remounts like one, matching the surface-chart composable's property.
		expect(first.dispose).toHaveBeenCalledOnce();
		expect(mountBarChart3D).toHaveBeenCalledTimes(2);
		expect(mountBarChart3D).toHaveBeenLastCalledWith(
			refs.container.value,
			expect.objectContaining({ width: 200, height: 150 }),
		);
	});

	it('remounts and disposes the prior handle when box data changes', async () => {
		const first = okHandle();
		const second = okHandle();
		mountBarChart3D.mockResolvedValueOnce(first).mockResolvedValueOnce(second);

		const refs: SceneRefs = {
			container: ref(document.createElement('div')),
			options: ref(boxes()),
		};

		run(refs);
		await nextTick();
		await Promise.resolve();

		refs.options.value = boxes({ seriesNames: ['S1', 'S2', 'S3'] });
		await nextTick();
		await Promise.resolve();

		expect(first.dispose).toHaveBeenCalledOnce();
		expect(mountBarChart3D).toHaveBeenCalledTimes(2);
	});
});
