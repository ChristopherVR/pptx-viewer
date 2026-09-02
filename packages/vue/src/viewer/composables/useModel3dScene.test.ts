import type { Model3DPptxElement } from 'pptx-viewer-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick, ref } from 'vue';
import type { Ref } from 'vue';

import { useModel3dScene } from './useModel3dScene';

// Mock the shared controller so `three` is never required. `mountModel3D`
// resolves to a configurable handle; `THREE_UNAVAILABLE` mirrors the real
// no-op sentinel (ok === false). Defined via vi.hoisted so the hoisted
// vi.mock factory can reference them.
const { THREE_UNAVAILABLE, mountModel3D } = vi.hoisted(() => ({
	THREE_UNAVAILABLE: {
		ok: false,
		resize: vi.fn(),
		setInteractive: vi.fn(),
		dispose: vi.fn(),
	},
	mountModel3D: vi.fn(),
}));

// `modelDataToBlobUrl` stays the REAL shared implementation (built on core's
// real `parseDataUrlToBytes`) so these tests exercise the actual repointed
// data-URL -> Blob URL conversion, not a re-hand-rolled stand-in; only the
// three.js-touching `mountModel3D` / `THREE_UNAVAILABLE` are mocked out.
vi.mock(import('pptx-viewer-shared'), async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual,
		mountModel3D: (...args: unknown[]) => mountModel3D(...args),
		THREE_UNAVAILABLE,
	};
});

function okHandle() {
	return {
		ok: true,
		resize: vi.fn(),
		setInteractive: vi.fn(),
		dispose: vi.fn(),
	};
}

function model3d(overrides: Partial<Model3DPptxElement> = {}): Model3DPptxElement {
	return {
		type: 'model3d',
		id: 'm3d-1',
		x: 0,
		y: 0,
		width: 320,
		height: 240,
		...overrides,
	} as Model3DPptxElement;
}

const GLB_DATA_URL = 'data:model/gltf-binary;base64,AAAA';

interface SceneRefs {
	container: Ref<HTMLElement | null>;
	element: Ref<Model3DPptxElement | undefined>;
	width: Ref<number>;
	height: Ref<number>;
	interactive: Ref<boolean>;
}

/** Run the composable inside an effect scope so onScopeDispose fires on stop(). */
function run(refs: SceneRefs) {
	const scope = effectScope();
	const result = scope.run(() => useModel3dScene(refs))!;
	return { scope, result };
}

beforeEach(() => {
	mountModel3D.mockReset();
	mountModel3D.mockResolvedValue(okHandle());
	THREE_UNAVAILABLE.dispose.mockReset();
	vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake');
	vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('useModel3dScene', () => {
	it('mounts the shared scene when modelData and a container are present', async () => {
		const handle = okHandle();
		mountModel3D.mockResolvedValue(handle);
		const refs: SceneRefs = {
			container: ref(document.createElement('div')),
			element: ref(model3d({ modelData: GLB_DATA_URL })),
			width: ref(320),
			height: ref(240),
			interactive: ref(true),
		};

		const { result } = run(refs);
		await nextTick();
		await Promise.resolve();

		expect(URL.createObjectURL).toHaveBeenCalledOnce();
		expect(mountModel3D).toHaveBeenCalledWith(refs.container.value, 'blob:fake', {
			width: 320,
			height: 240,
			interactive: true,
		});
		expect(result.mounted.value).toBeTruthy();
	});

	it('does not mount and stays unmounted when there is no modelData', async () => {
		const refs: SceneRefs = {
			container: ref(document.createElement('div')),
			element: ref(model3d()),
			width: ref(100),
			height: ref(100),
			interactive: ref(true),
		};

		const { result } = run(refs);
		await nextTick();
		await Promise.resolve();

		expect(mountModel3D).not.toHaveBeenCalled();
		expect(URL.createObjectURL).not.toHaveBeenCalled();
		expect(result.mounted.value).toBeFalsy();
	});

	it('stays unmounted (poster) when mount resolves to THREE_UNAVAILABLE', async () => {
		mountModel3D.mockResolvedValue(THREE_UNAVAILABLE);
		const refs: SceneRefs = {
			container: ref(document.createElement('div')),
			element: ref(model3d({ modelData: GLB_DATA_URL })),
			width: ref(100),
			height: ref(100),
			interactive: ref(true),
		};

		const { result } = run(refs);
		await nextTick();
		await Promise.resolve();

		expect(mountModel3D).toHaveBeenCalledOnce();
		expect(result.mounted.value).toBeFalsy();
	});

	it('disposes the handle and revokes the blob URL on scope stop', async () => {
		const handle = okHandle();
		mountModel3D.mockResolvedValue(handle);
		const refs: SceneRefs = {
			container: ref(document.createElement('div')),
			element: ref(model3d({ modelData: GLB_DATA_URL })),
			width: ref(100),
			height: ref(100),
			interactive: ref(true),
		};

		const { scope } = run(refs);
		await nextTick();
		await Promise.resolve();

		scope.stop();

		expect(handle.dispose).toHaveBeenCalledOnce();
		expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake');
	});

	it('pushes interactivity changes to the live handle without remounting', async () => {
		const handle = okHandle();
		mountModel3D.mockResolvedValue(handle);
		const refs: SceneRefs = {
			container: ref(document.createElement('div')),
			element: ref(model3d({ modelData: GLB_DATA_URL })),
			width: ref(100),
			height: ref(100),
			interactive: ref(true),
		};

		run(refs);
		await nextTick();
		await Promise.resolve();

		refs.interactive.value = false;
		await nextTick();

		expect(handle.setInteractive).toHaveBeenCalledWith(false);
		expect(mountModel3D).toHaveBeenCalledOnce();
	});

	it('pushes size changes to the live handle without remounting', async () => {
		const handle = okHandle();
		mountModel3D.mockResolvedValue(handle);
		const refs: SceneRefs = {
			container: ref(document.createElement('div')),
			element: ref(model3d({ modelData: GLB_DATA_URL })),
			width: ref(100),
			height: ref(100),
			interactive: ref(true),
		};

		run(refs);
		await nextTick();
		await Promise.resolve();

		refs.width.value = 200;
		refs.height.value = 150;
		await nextTick();

		expect(handle.resize).toHaveBeenCalledWith(200, 150);
		expect(mountModel3D).toHaveBeenCalledOnce();
	});

	it('remounts and revokes the prior URL when modelData changes', async () => {
		const first = okHandle();
		const second = okHandle();
		mountModel3D.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
		(URL.createObjectURL as ReturnType<typeof vi.fn>)
			.mockReturnValueOnce('blob:first')
			.mockReturnValueOnce('blob:second');

		const refs: SceneRefs = {
			container: ref(document.createElement('div')),
			element: ref(model3d({ modelData: GLB_DATA_URL })),
			width: ref(100),
			height: ref(100),
			interactive: ref(true),
		};

		run(refs);
		await nextTick();
		await Promise.resolve();

		refs.element.value = model3d({ modelData: 'data:model/gltf-binary;base64,BBBB' });
		await nextTick();
		await Promise.resolve();

		expect(first.dispose).toHaveBeenCalledOnce();
		expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:first');
		expect(mountModel3D).toHaveBeenCalledTimes(2);
	});
});
