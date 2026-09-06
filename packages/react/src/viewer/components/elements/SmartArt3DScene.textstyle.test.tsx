// @vitest-environment happy-dom
/**
 * Regression test for SmartArt3DScene's text-style emphasis wiring: the
 * initial `textStyle` prop reaches `mountSmartArt3D`'s options at mount time,
 * and later changes are pushed onto the handle's `setTextStyle` without
 * re-mounting (the model identity, not the style, drives remounts).
 * `mountSmartArt3D` returns its handle synchronously (unlike the chart-3D
 * `mount*Chart3D` functions), so there is no async catch-up case to cover.
 */
import type { SmartArt3DHandle, SmartArt3DModel } from 'pptx-viewer-shared/smartart-3d';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mountSmartArt3D = vi.fn();

vi.mock(import('pptx-viewer-shared/smartart-3d'), () => ({
	mountSmartArt3D: (...args: unknown[]) => mountSmartArt3D(...args),
}));

const { default: SmartArt3DScene } = await import('./SmartArt3DScene');

function makeHandle(): SmartArt3DHandle {
	return {
		resize: vi.fn(),
		setInteractive: vi.fn(),
		setTextStyle: vi.fn(),
		dispose: vi.fn(),
	};
}

const model = { meshes: [], connectors: [] } as unknown as SmartArt3DModel;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
	mountSmartArt3D.mockReset();
});

afterEach(() => {
	act(() => {
		root.unmount();
	});
	container.remove();
});

describe('smartArt3DScene text-style wiring', () => {
	it('passes the initial textStyle in the mount options', () => {
		const handle = makeHandle();
		mountSmartArt3D.mockReturnValue(handle);

		act(() => {
			root.render(
				React.createElement(SmartArt3DScene, {
					model,
					width: 400,
					height: 300,
					interactive: false,
					textStyle: { bold: true },
				}),
			);
		});

		expect(mountSmartArt3D).toHaveBeenCalledOnce();
		const mountOptions = mountSmartArt3D.mock.calls[0]?.[4] as { textStyle?: unknown };
		expect(mountOptions.textStyle).toStrictEqual({ bold: true });
	});

	it('applies setTextStyle on prop change without re-mounting', () => {
		const handle = makeHandle();
		mountSmartArt3D.mockReturnValue(handle);

		act(() => {
			root.render(
				React.createElement(SmartArt3DScene, {
					model,
					width: 400,
					height: 300,
					interactive: false,
					textStyle: { bold: true },
				}),
			);
		});
		expect(mountSmartArt3D).toHaveBeenCalledOnce();

		act(() => {
			root.render(
				React.createElement(SmartArt3DScene, {
					model,
					width: 400,
					height: 300,
					interactive: false,
					textStyle: { italic: true },
				}),
			);
		});

		expect(mountSmartArt3D).toHaveBeenCalledOnce();
		expect(handle.setTextStyle).toHaveBeenLastCalledWith({ italic: true });
	});
});
