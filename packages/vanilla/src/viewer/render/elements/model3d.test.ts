import type { PptxElement } from 'pptx-viewer-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../i18n';
import { createElementRendererRegistry } from '../registry';
import type { ElementRenderContext } from '../types';
import { renderModel3dElement } from './model3d';

// Mock the shared 3D controller so the optional `three` peer dep is never
// loaded (same pattern as Vue's Model3DRenderer.test.ts). Defined via
// vi.hoisted so the hoisted vi.mock factory can reference it.
const { mountModel3D } = vi.hoisted(() => ({ mountModel3D: vi.fn() }));

// Partial mock: the renderer pulls real helpers (getContainerStyle) from
// `pptx-viewer-shared`, so keep the original module and override only the 3D
// controller surface.
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

function makeContext(): ElementRenderContext {
	const registry = createElementRendererRegistry();
	const context: ElementRenderContext = {
		document,
		slide: { id: 's1', rId: 'rId1', slideNumber: 1, elements: [] },
		canvasSize: { width: 1280, height: 720 },
		scale: 1,
		mediaDataUrls: new Map<string, string>(),
		t: createTranslator(),
		smartArt3D: false,
		surfaceChart3D: false,
		barChart3D: false,
		lineChart3D: false,
		areaChart3D: false,
		presenting: false,
		registry,
		renderElement: (el, z) => registry.resolve(el.type)(el, z, context),
	};
	return context;
}

function model3dElement(overrides: Record<string, unknown> = {}): PptxElement {
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

/** Flush the mount promise chain (mocked mountModel3D resolves + one .then). */
async function flushMount(): Promise<void> {
	await Promise.resolve();
	await Promise.resolve();
	await Promise.resolve();
}

beforeEach(() => {
	mountModel3D.mockReset();
	mountModel3D.mockResolvedValue(okHandle());
	vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake');
	vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('renderModel3dElement', () => {
	it('returns null for non-model3d elements', () => {
		const el = { type: 'text', id: 't1', x: 0, y: 0, width: 10, height: 10 } as PptxElement;
		expect(renderModel3dElement(el, 0, makeContext())).toBeNull();
	});

	it('renders the poster image without a view button when there is no model data', () => {
		const node = renderModel3dElement(
			model3dElement({ posterImage: POSTER_DATA_URL }),
			3,
			makeContext(),
		) as HTMLElement;
		expect(node.dataset.elementId).toBe('m3d-1');
		expect(node.style.left).toBe('20px');
		expect(node.style.zIndex).toBe('3');

		const img = node.querySelector<HTMLImageElement>('img.pptxv-model3d-poster');
		expect(img?.getAttribute('src')).toBe(POSTER_DATA_URL);
		expect(img?.alt).toBe('3D Model');
		expect(node.querySelector('button')).toBeNull();
	});

	it('falls back to imageData when posterImage is absent', () => {
		const node = renderModel3dElement(
			model3dElement({ imageData: POSTER_DATA_URL }),
			0,
			makeContext(),
		) as HTMLElement;
		expect(node.querySelector('img')?.getAttribute('src')).toBe(POSTER_DATA_URL);
	});

	it('renders a labelled placeholder box when no poster or image exists', () => {
		const node = renderModel3dElement(model3dElement(), 0, makeContext()) as HTMLElement;
		expect(node.querySelector('img')).toBeNull();
		const box = node.querySelector<HTMLElement>('.pptxv-model3d-placeholder');
		expect(box).toBeTruthy();
		expect(box?.querySelector('svg')).toBeTruthy();
		expect(box?.textContent).toContain('3D Model');
	});

	it('mounts the interactive scene on demand and swaps out the poster', async () => {
		const node = renderModel3dElement(
			model3dElement({ posterImage: POSTER_DATA_URL, modelData: GLB_DATA_URL }),
			0,
			makeContext(),
		) as HTMLElement;

		const button = node.querySelector<HTMLButtonElement>('button.pptxv-model3d-view');
		expect(button).toBeTruthy();
		expect(node.querySelector('.pptxv-model3d-scene')).toBeNull();

		button?.click();
		await flushMount();

		expect(mountModel3D).toHaveBeenCalledExactlyOnceWith(expect.anything(), 'blob:fake', {
			width: 320,
			height: 240,
			interactive: true,
		});
		expect(node.querySelector('.pptxv-model3d-scene')).toBeTruthy();
		expect(node.querySelector('img')).toBeNull();
		expect(node.querySelector('button')).toBeNull();
		expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake');
	});

	it('keeps the poster and drops the affordance when three is unavailable', async () => {
		mountModel3D.mockResolvedValue(okHandle(false));
		const node = renderModel3dElement(
			model3dElement({ posterImage: POSTER_DATA_URL, modelData: GLB_DATA_URL }),
			0,
			makeContext(),
		) as HTMLElement;

		node.querySelector('button')?.click();
		await flushMount();

		expect(mountModel3D).toHaveBeenCalledOnce();
		expect(node.querySelector('img')?.getAttribute('src')).toBe(POSTER_DATA_URL);
		expect(node.querySelector('.pptxv-model3d-scene')).toBeNull();
		expect(node.querySelector('button')).toBeNull();
	});

	it('drops the affordance without mounting when the model data URL is malformed', async () => {
		const node = renderModel3dElement(
			model3dElement({ posterImage: POSTER_DATA_URL, modelData: 'not-a-data-url' }),
			0,
			makeContext(),
		) as HTMLElement;

		node.querySelector('button')?.click();
		await flushMount();

		expect(mountModel3D).not.toHaveBeenCalled();
		expect(node.querySelector('button')).toBeNull();
		expect(node.querySelector('img')?.getAttribute('src')).toBe(POSTER_DATA_URL);
	});

	it('ignores repeat clicks while a mount is in flight', async () => {
		let resolveMount: ((handle: ReturnType<typeof okHandle>) => void) | undefined;
		mountModel3D.mockImplementation(
			() =>
				new Promise((resolve) => {
					resolveMount = resolve;
				}),
		);
		const node = renderModel3dElement(
			model3dElement({ posterImage: POSTER_DATA_URL, modelData: GLB_DATA_URL }),
			0,
			makeContext(),
		) as HTMLElement;

		const button = node.querySelector<HTMLButtonElement>('button');
		button?.click();
		button?.click();
		resolveMount?.(okHandle());
		await flushMount();

		expect(mountModel3D).toHaveBeenCalledOnce();
	});
});
