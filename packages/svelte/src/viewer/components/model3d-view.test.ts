import type { PptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ElementRenderer from './ElementRenderer.svelte';

/**
 * Model3dView tests: poster / placeholder fallback and the on-demand "view in
 * 3D" affordance (mount success, `three` unavailable, malformed model data,
 * and in-flight click de-duplication), mirroring the vanilla model3d
 * renderer tests.
 */

// Mock the shared 3D controller so the optional `three` peer dep is never
// loaded (same pattern as the vanilla / Vue Model3D tests). Defined via
// vi.hoisted so the hoisted vi.mock factory can reference it.
const { mountModel3D } = vi.hoisted(() => ({ mountModel3D: vi.fn() }));

vi.mock(import('pptx-viewer-shared'), async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual,
		mountModel3D: (...args: Parameters<typeof actual.mountModel3D>) => mountModel3D(...args),
	};
});

function okHandle(ok = true) {
	return { ok, resize: vi.fn(), setInteractive: vi.fn(), dispose: vi.fn() };
}

let cleanup: (() => void) | undefined;

function mountEl(element: PptxElement): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(ElementRenderer, {
		target,
		props: { element, mediaDataUrls: new Map<string, string>(), zIndex: 3 },
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

function model3dElement(overrides: Record<string, unknown>): PptxElement {
	return {
		type: 'model3d',
		id: 'm3d-1',
		x: 20,
		y: 30,
		width: 320,
		height: 240,
		...overrides,
	} as PptxElement;
}

const POSTER_DATA_URL = 'data:image/png;base64,POSTER';
const GLB_DATA_URL = 'data:model/gltf-binary;base64,AAAA';

/** Flush the mount promise chain plus the Svelte state-update scheduler. */
async function flushMount(): Promise<void> {
	for (let i = 0; i < 10; i++) {
		flushSync();
		// eslint-disable-next-line no-await-in-loop -- draining the microtask
		// queue between flushes so `tick()` + the mocked `mountModel3D` promise
		// both settle before we assert on the DOM.
		await Promise.resolve();
	}
	flushSync();
}

beforeEach(() => {
	mountModel3D.mockReset();
	mountModel3D.mockResolvedValue(okHandle());
	vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake');
	vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
	vi.restoreAllMocks();
});

describe('model3dView', () => {
	it('renders the poster image without a view button when there is no model data', () => {
		const target = mountEl(model3dElement({ posterImage: POSTER_DATA_URL }));
		const node = target.querySelector<HTMLElement>('[data-element-id="m3d-1"]');
		expect(node?.getAttribute('style')).toContain('left: 20px');
		expect(node?.getAttribute('style')).toContain('z-index: 3');

		const img = node?.querySelector<HTMLImageElement>('img.pptx-svelte-model3d-poster');
		expect(img?.getAttribute('src')).toBe(POSTER_DATA_URL);
		expect(img?.alt).toBe('3D Model');
		expect(node?.querySelector('button')).toBeNull();
	});

	it('falls back to imageData when posterImage is absent', () => {
		const target = mountEl(model3dElement({ imageData: POSTER_DATA_URL }));
		expect(target.querySelector('img')?.getAttribute('src')).toBe(POSTER_DATA_URL);
	});

	it('renders a labelled placeholder box when no poster or image exists', () => {
		const target = mountEl(model3dElement({}));
		expect(target.querySelector('img')).toBeNull();
		const box = target.querySelector<HTMLElement>('.pptx-svelte-model3d-placeholder');
		expect(box).toBeTruthy();
		expect(box?.querySelector('svg')).toBeTruthy();
		expect(box?.textContent).toContain('3D Model');
	});

	it('mounts the interactive scene on demand and swaps out the poster', async () => {
		const target = mountEl(
			model3dElement({ posterImage: POSTER_DATA_URL, modelData: GLB_DATA_URL }),
		);

		const button = target.querySelector<HTMLButtonElement>('button.pptx-svelte-model3d-view');
		expect(button).toBeTruthy();
		expect(target.querySelector('.pptx-svelte-model3d-scene')).toBeNull();

		button?.click();
		await flushMount();

		expect(mountModel3D).toHaveBeenCalledExactlyOnceWith(expect.anything(), 'blob:fake', {
			width: 320,
			height: 240,
			interactive: true,
		});
		expect(target.querySelector('.pptx-svelte-model3d-scene')).toBeTruthy();
		expect(target.querySelector('img')).toBeNull();
		expect(target.querySelector('button')).toBeNull();
		expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake');
	});

	it('keeps the poster and drops the affordance when three is unavailable', async () => {
		mountModel3D.mockResolvedValue(okHandle(false));
		const target = mountEl(
			model3dElement({ posterImage: POSTER_DATA_URL, modelData: GLB_DATA_URL }),
		);

		target.querySelector<HTMLButtonElement>('button')?.click();
		await flushMount();

		expect(mountModel3D).toHaveBeenCalledOnce();
		expect(target.querySelector('img')?.getAttribute('src')).toBe(POSTER_DATA_URL);
		expect(target.querySelector('.pptx-svelte-model3d-scene')).toBeNull();
		expect(target.querySelector('button')).toBeNull();
	});

	it('drops the affordance without mounting when the model data URL is malformed', async () => {
		const target = mountEl(
			model3dElement({ posterImage: POSTER_DATA_URL, modelData: 'not-a-data-url' }),
		);

		target.querySelector<HTMLButtonElement>('button')?.click();
		await flushMount();

		expect(mountModel3D).not.toHaveBeenCalled();
		expect(target.querySelector('button')).toBeNull();
		expect(target.querySelector('img')?.getAttribute('src')).toBe(POSTER_DATA_URL);
	});

	it('ignores repeat clicks while a mount is in flight', async () => {
		let resolveMount: ((handle: ReturnType<typeof okHandle>) => void) | undefined;
		mountModel3D.mockImplementation(
			() =>
				new Promise((resolve) => {
					resolveMount = resolve;
				}),
		);
		const target = mountEl(
			model3dElement({ posterImage: POSTER_DATA_URL, modelData: GLB_DATA_URL }),
		);

		const button = target.querySelector<HTMLButtonElement>('button');
		button?.click();
		flushSync();
		button?.click();
		flushSync();
		resolveMount?.(okHandle());
		await flushMount();

		expect(mountModel3D).toHaveBeenCalledOnce();
	});
});
