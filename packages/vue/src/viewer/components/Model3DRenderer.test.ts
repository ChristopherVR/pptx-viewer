import { mount } from '@vue/test-utils';
import type { PptxElement } from 'pptx-viewer-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';

import Model3DRenderer from './Model3DRenderer.vue';

// Mock the shared controller so the optional `three` peer dep is never needed.
// Defined via vi.hoisted so the hoisted vi.mock factory can reference them.
const { THREE_UNAVAILABLE, mountModel3D } = vi.hoisted(() => ({
	THREE_UNAVAILABLE: {
		ok: false,
		resize: vi.fn(),
		setInteractive: vi.fn(),
		dispose: vi.fn(),
	},
	mountModel3D: vi.fn(),
}));

// Partial mock: the SFC's `element-style` composable pulls many real helpers
// from `pptx-viewer-shared`, so keep the original module and override only the
// 3D controller surface (so the optional `three` peer dep is never loaded).
vi.mock(import('pptx-viewer-shared'), async (importOriginal) => {
	const actual = await importOriginal<typeof import('pptx-viewer-shared')>();
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

function model3d(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'model3d',
		id: 'm3d 1',
		x: 0,
		y: 0,
		width: 320,
		height: 240,
		...overrides,
	} as PptxElement;
}

const GLB_DATA_URL = 'data:model/gltf-binary;base64,AAAA';

beforeEach(() => {
	mountModel3D.mockReset();
	mountModel3D.mockResolvedValue(okHandle());
	vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake');
	vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('model3DRenderer', () => {
	it('renders the poster image when posterImage is present (no model data)', () => {
		const src = 'data:image/png;base64,POSTER';
		const wrapper = mount(Model3DRenderer, {
			props: { element: model3d({ posterImage: src }), zIndex: 1 },
		});
		expect(wrapper.get('img').attributes('src')).toBe(src);
	});

	it('falls back to imageData when posterImage is absent (no model data)', () => {
		const src = 'data:image/png;base64,RASTER';
		const wrapper = mount(Model3DRenderer, {
			props: { element: model3d({ imageData: src }), zIndex: 0 },
		});
		expect(wrapper.get('img').attributes('src')).toBe(src);
	});

	it('renders a labelled placeholder when no poster/image is available', () => {
		const wrapper = mount(Model3DRenderer, { props: { element: model3d(), zIndex: 0 } });
		expect(wrapper.find('img').exists()).toBeFalsy();
		expect(wrapper.text()).toContain('3D Model');
	});

	it('mounts the interactive scene when modelData and three are present', async () => {
		const wrapper = mount(Model3DRenderer, {
			props: { element: model3d({ modelData: GLB_DATA_URL }), zIndex: 0 },
		});
		await nextTick();
		await Promise.resolve();
		await nextTick();

		expect(mountModel3D).toHaveBeenCalledOnce();
		// Poster is hidden once the scene mounts.
		expect(wrapper.find('img').exists()).toBeFalsy();
	});

	it('keeps the poster when three is unavailable (THREE_UNAVAILABLE)', async () => {
		mountModel3D.mockResolvedValue(THREE_UNAVAILABLE);
		const src = 'data:image/png;base64,POSTER';
		const wrapper = mount(Model3DRenderer, {
			props: { element: model3d({ modelData: GLB_DATA_URL, posterImage: src }), zIndex: 0 },
		});
		await nextTick();
		await Promise.resolve();
		await nextTick();

		expect(mountModel3D).toHaveBeenCalledOnce();
		expect(wrapper.get('img').attributes('src')).toBe(src);
	});

	it('disposes the handle and revokes the blob URL on unmount', async () => {
		const handle = okHandle();
		mountModel3D.mockResolvedValue(handle);
		const wrapper = mount(Model3DRenderer, {
			props: { element: model3d({ modelData: GLB_DATA_URL }), zIndex: 0 },
		});
		await nextTick();
		await Promise.resolve();
		await nextTick();

		wrapper.unmount();

		expect(handle.dispose).toHaveBeenCalledOnce();
		expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake');
	});
});
