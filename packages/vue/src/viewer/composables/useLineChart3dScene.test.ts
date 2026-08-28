import type { LineChart3DSceneOptions } from 'pptx-viewer-shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick, ref } from 'vue';
import type { Ref } from 'vue';

import { useLineChart3dScene } from './useLineChart3dScene';

const { LINE_CHART_THREE_UNAVAILABLE, mountLineChart3D } = vi.hoisted(() => ({
	LINE_CHART_THREE_UNAVAILABLE: {
		ok: false,
		resize: vi.fn(),
		dispose: vi.fn(),
	},
	mountLineChart3D: vi.fn(),
}));

vi.mock(import('pptx-viewer-shared'), () => ({
	mountLineChart3D: (...args: unknown[]) => mountLineChart3D(...args),
	LINE_CHART_THREE_UNAVAILABLE,
}));

function okHandle() {
	return {
		ok: true,
		resize: vi.fn(),
		dispose: vi.fn(),
	};
}

function paths(overrides: Partial<LineChart3DSceneOptions> = {}): LineChart3DSceneOptions {
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
	options: Ref<LineChart3DSceneOptions | null>;
}

function run(refs: SceneRefs) {
	const scope = effectScope();
	const result = scope.run(() => useLineChart3dScene(refs))!;
	return { scope, result };
}

beforeEach(() => {
	mountLineChart3D.mockReset();
	mountLineChart3D.mockResolvedValue(okHandle());
	LINE_CHART_THREE_UNAVAILABLE.dispose.mockReset();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('useLineChart3dScene', () => {
	it('mounts the shared scene when path data and a container are present', async () => {
		const handle = okHandle();
		mountLineChart3D.mockResolvedValue(handle);
		const refs: SceneRefs = {
			container: ref(document.createElement('div')),
			options: ref(paths()),
		};

		const { result } = run(refs);
		await nextTick();
		await Promise.resolve();

		expect(mountLineChart3D).toHaveBeenCalledWith(refs.container.value, refs.options.value);
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

		expect(mountLineChart3D).not.toHaveBeenCalled();
		expect(result.mounted.value).toBeFalsy();
	});

	it('stays unmounted (SVG fallback) when mount resolves to LINE_CHART_THREE_UNAVAILABLE', async () => {
		mountLineChart3D.mockResolvedValue(LINE_CHART_THREE_UNAVAILABLE);
		const refs: SceneRefs = {
			container: ref(document.createElement('div')),
			options: ref(paths()),
		};

		const { result } = run(refs);
		await nextTick();
		await Promise.resolve();

		expect(mountLineChart3D).toHaveBeenCalledOnce();
		expect(result.mounted.value).toBeFalsy();
	});

	it('disposes the handle on scope stop', async () => {
		const handle = okHandle();
		mountLineChart3D.mockResolvedValue(handle);
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
		mountLineChart3D.mockResolvedValueOnce(first).mockResolvedValueOnce(second);

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
		expect(mountLineChart3D).toHaveBeenCalledTimes(2);
	});
});
