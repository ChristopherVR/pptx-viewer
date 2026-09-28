// @vitest-environment happy-dom
/**
 * `Model3DScene` hands the element's authored camera/transform/lights to the
 * shared `mountModel3D` controller (the controller itself is mocked: real
 * WebGL cannot run under happy-dom).
 */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Model3DScene from './Model3DScene';

const { mountModel3D } = vi.hoisted(() => ({ mountModel3D: vi.fn() }));

vi.mock(import('pptx-viewer-shared'), async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual,
		mountModel3D: (...args: unknown[]) => mountModel3D(...args),
	};
});

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	mountModel3D.mockReset();
	mountModel3D.mockResolvedValue({
		ok: true,
		resize: vi.fn(),
		setInteractive: vi.fn(),
		dispose: vi.fn(),
	});
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => {
		root.unmount();
	});
	container.remove();
});

describe('model3DScene', () => {
	it('passes the authored scene to mountModel3D', async () => {
		const scene = { camera: { projection: 'perspective' as const, fovDeg: 40 }, lights: [] };
		await act(async () => {
			root.render(
				<Model3DScene modelUrl='blob:m' interactive width={320} height={240} scene={scene} />,
			);
		});
		expect(mountModel3D).toHaveBeenCalledExactlyOnceWith(expect.anything(), 'blob:m', {
			width: 320,
			height: 240,
			interactive: true,
			scene,
		});
	});

	it('omits the scene when nothing is authored', async () => {
		await act(async () => {
			root.render(<Model3DScene modelUrl='blob:m' interactive={false} width={10} height={10} />);
		});
		expect(mountModel3D.mock.calls[0]?.[2]).toStrictEqual({
			width: 10,
			height: 10,
			interactive: false,
			scene: undefined,
		});
	});
});
