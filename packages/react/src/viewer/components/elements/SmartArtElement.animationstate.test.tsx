// @vitest-environment happy-dom
/**
 * Regression test: `SmartArtElement` must forward `animationState` to the 3D
 * dispatch path too, not just the SVG one - otherwise a font-style emphasis
 * effect (Bold Flash, Underline, ...) targeting a SmartArt node caption would
 * apply in the SVG renderer but silently do nothing when `smartArt3D` is on.
 */
import type { PptxElement } from 'pptx-viewer-core';
import type { ElementAnimationState } from 'pptx-viewer-shared';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SmartArt3DContext } from './smart-art-3d-context';

const smartArt3DRendererSpy = vi.fn();
vi.mock(import('./SmartArt3DRenderer'), () => ({
	SmartArt3DRenderer: (props: Record<string, unknown>) => {
		smartArt3DRendererSpy(props);
		return React.createElement('div', { 'data-testid': 'smartart3d-stub' });
	},
}));
vi.mock(import('./SmartArtRenderer'), () => ({
	SmartArtRenderer: () => React.createElement('div', { 'data-testid': 'smartart-svg-stub' }),
}));

const { SmartArtElement } = await import('./SmartArtElement');

function makeElement(): PptxElement {
	return {
		id: 'sa1',
		type: 'smartArt',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		smartArtData: { nodes: [] },
	} as unknown as PptxElement;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
	smartArt3DRendererSpy.mockReset();
});

afterEach(() => {
	act(() => {
		root.unmount();
	});
	container.remove();
});

describe('smartArtElement 3D dispatch', () => {
	it('forwards animationState to SmartArt3DRenderer when smartArt3D is on', () => {
		const animationState: ElementAnimationState = {
			visible: true,
			cssAnimation: undefined,
			textStyle: { bold: true },
		};
		act(() => {
			root.render(
				React.createElement(
					SmartArt3DContext.Provider,
					{ value: true },
					React.createElement(SmartArtElement, { element: makeElement(), animationState }),
				),
			);
		});
		expect(container.querySelector('[data-testid="smartart3d-stub"]')).not.toBeNull();
		expect(smartArt3DRendererSpy).toHaveBeenCalledOnce();
		const props = smartArt3DRendererSpy.mock.calls[0]?.[0] as {
			animationState?: ElementAnimationState;
		};
		expect(props.animationState).toBe(animationState);
	});
});
