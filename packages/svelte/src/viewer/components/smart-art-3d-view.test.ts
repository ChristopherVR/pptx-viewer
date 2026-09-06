import type { PptxElement } from 'pptx-viewer-core';
import type { ElementAnimationState } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PresentationElementStatesKey } from '../state/presentation-element-states-context';
import { SmartArt3DContextKey } from '../state/smart-art-3d-context';
import ElementRenderer from './ElementRenderer.svelte';

/**
 * SmartArt3DView tests: the `smartArt3D` opt-in dispatch (ElementRenderer
 * only routes to the WebGL renderer when the flag is set via context), the
 * on-init WebGL mount (success, `three`/mount unavailable, and the empty
 * diagram fallback), and scene disposal on unmount. Mirrors the Model3dView
 * test suite's mocking pattern for the shared three.js scene controller.
 */

// Mock the shared 3D controller so the optional `three` peer dep is never
// loaded (same pattern as Model3dView's test). Defined via vi.hoisted so the
// hoisted vi.mock factory can reference it.
const { mountSmartArt3D } = vi.hoisted(() => ({ mountSmartArt3D: vi.fn() }));

vi.mock(import('pptx-viewer-shared/smartart-3d'), async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual,
		mountSmartArt3D: (...args: Parameters<typeof actual.mountSmartArt3D>) =>
			mountSmartArt3D(...args),
	};
});

function okHandle() {
	return { resize: vi.fn(), setInteractive: vi.fn(), setTextStyle: vi.fn(), dispose: vi.fn() };
}

let cleanup: (() => void) | undefined;

function mountEl(element: PptxElement, smartArt3D: boolean): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(ElementRenderer, {
		target,
		props: { element, mediaDataUrls: new Map<string, string>(), zIndex: 2 },
		context: new Map([[SmartArt3DContextKey, () => smartArt3D]]),
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

function smartArtElement(overrides: Record<string, unknown> = {}): PptxElement {
	return {
		type: 'smartArt',
		id: 'sa3d-1',
		x: 10,
		y: 20,
		width: 400,
		height: 240,
		smartArtData: {
			nodes: [
				{ id: 'n1', text: 'One' },
				{ id: 'n2', text: 'Two' },
			],
		},
		...overrides,
	} as PptxElement;
}

/**
 * Flush the mount promise chain plus the Svelte state-update scheduler.
 *
 * The dynamic `import('pptx-viewer-shared/smartart-3d')` goes through
 * Vitest's SSR module loader even when the target module is mocked, which
 * needs real event-loop turns (macrotasks) to settle, not just drained
 * microtasks (a plain `Promise.resolve()` loop never observes it resolving).
 * 100 ticks (not 20): under a loaded CI runner (many test files/workers
 * sharing the same event loop) 20 ticks was occasionally too few, flaking
 * `mountSmartArt3D` as "never called" even though it settles a beat later.
 */
async function flushMount(): Promise<void> {
	for (let i = 0; i < 100; i++) {
		flushSync();
		// eslint-disable-next-line no-await-in-loop -- polling real macrotask
		// ticks until the dynamic import + `tick()` both settle.
		await new Promise<void>((resolve) => {
			setTimeout(resolve, 0);
		});
	}
	flushSync();
}

beforeEach(() => {
	mountSmartArt3D.mockReset();
	mountSmartArt3D.mockReturnValue(okHandle());
});

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
	vi.restoreAllMocks();
});

describe('smartArt3DView', () => {
	it('renders the SVG SmartArtView when smartArt3D is not enabled', async () => {
		const target = mountEl(smartArtElement(), false);
		await flushMount();
		expect(mountSmartArt3D).not.toHaveBeenCalled();
		expect(target.querySelector('.pptx-svelte-smartart')).toBeTruthy();
		expect(target.querySelector('.pptx-svelte-smartart-3d')).toBeNull();
	});

	it('mounts the WebGL scene on init when smartArt3D is enabled', async () => {
		const target = mountEl(smartArtElement(), true);
		await flushMount();

		expect(mountSmartArt3D).toHaveBeenCalledExactlyOnceWith(
			expect.anything(),
			expect.objectContaining({ meshes: expect.any(Array), connectors: expect.any(Array) }),
			400,
			240,
			{ textStyle: undefined },
		);
		const node = target.querySelector<HTMLElement>('[data-element-id="sa3d-1"]');
		expect(node?.getAttribute('style')).toContain('left: 10px');
		expect(node?.querySelector('canvas.pptx-svelte-smartart-3d-canvas')).toBeTruthy();
		expect(target.querySelector('.pptx-svelte-smartart')).toBeNull();
	});

	it('falls back to the SVG renderer when the mount call throws (three unavailable)', async () => {
		mountSmartArt3D.mockImplementationOnce(() => {
			throw new Error('three unavailable');
		});
		const target = mountEl(smartArtElement(), true);
		await flushMount();

		expect(target.querySelector('.pptx-svelte-smartart-3d')).toBeNull();
		expect(target.querySelector('.pptx-svelte-smartart')).toBeTruthy();
	});

	it('stays on the SVG fallback without mounting when there are no renderable nodes', async () => {
		const target = mountEl(smartArtElement({ smartArtData: { nodes: [] } }), true);
		await flushMount();

		expect(mountSmartArt3D).not.toHaveBeenCalled();
		expect(target.querySelector('.pptx-svelte-smartart-placeholder')).toBeTruthy();
	});

	it('disposes the scene handle on unmount', async () => {
		const handle = okHandle();
		mountSmartArt3D.mockReturnValue(handle);
		mountEl(smartArtElement(), true);
		await flushMount();

		cleanup?.();
		cleanup = undefined;
		expect(handle.dispose).toHaveBeenCalledOnce();
	});

	it('passes an active text-style emphasis override to the scene at mount', async () => {
		const element = smartArtElement();
		const states = new Map<string, ElementAnimationState>([
			[element.id, { visible: true, cssAnimation: undefined, textStyle: { bold: true } }],
		]);
		const target = document.createElement('div');
		document.body.appendChild(target);
		const instance = mount(ElementRenderer, {
			target,
			props: { element, mediaDataUrls: new Map<string, string>(), zIndex: 2 },
			context: new Map<symbol, unknown>([
				[SmartArt3DContextKey, () => true],
				[PresentationElementStatesKey, () => states],
			]),
		});
		flushSync();
		cleanup = () => {
			unmount(instance);
			target.remove();
		};
		await flushMount();

		expect(mountSmartArt3D).toHaveBeenCalledExactlyOnceWith(
			expect.anything(),
			expect.anything(),
			400,
			240,
			{ textStyle: { bold: true } },
		);
	});
});
