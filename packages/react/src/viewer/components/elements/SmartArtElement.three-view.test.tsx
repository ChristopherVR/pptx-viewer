// @vitest-environment happy-dom
/**
 * Unit tests for `SmartArtElement`/`SmartArt3DView`'s `<pptx-three-view>`
 * wiring: replaces `SmartArt3DRenderer.layout-source.test.tsx`,
 * `SmartArt3DScene.textstyle.test.tsx`, and `SmartArtElement.animationstate.test.tsx`.
 *
 * `resolveSmartArtThreeViewSpec` is mocked so these tests exercise the
 * DECISION and prop-forwarding this binding owns (does a `<pptx-three-view>`
 * mount, with which `interactive`/`textStyle`, and does the inline
 * node-text-edit overlay still layer on top), independent of the 3D model
 * builder's own geometry rules (covered at the shared layer).
 */
import type { PptxElement, PptxSmartArtData } from 'pptx-viewer-core';
import type { ElementAnimationState, ThreeViewSpec } from 'pptx-viewer-shared';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const resolveSmartArtThreeViewSpec = vi.hoisted(() => vi.fn());

vi.mock(import('pptx-viewer-shared'), async (importOriginal) => {
	const actual = await importOriginal();
	return { ...actual, resolveSmartArtThreeViewSpec };
});

const { SmartArtElement } = await import('./SmartArtElement');
const { DEFAULT_RENDERING_3D_FLAGS, Rendering3DFlagsContext } =
	await import('./rendering-3d-flags-context');

const SPEC = { kind: 'smartart', spec: {} } as unknown as ThreeViewSpec;

const smartArtData = {
	layoutType: 'list',
	nodes: [{ id: 'n1', text: 'One' }],
} as unknown as PptxSmartArtData;

function makeElement(): PptxElement {
	return {
		id: 'sa-1',
		type: 'smartArt',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		smartArtData,
	} as unknown as PptxElement;
}

function threeView(container: HTMLElement) {
	return container.querySelector<HTMLElement & { interactive: boolean; textStyle: unknown }>(
		'pptx-three-view',
	);
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	resolveSmartArtThreeViewSpec.mockReset();
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

function render(
	smartArt3D: boolean,
	props: {
		canEdit?: boolean;
		onUpdateElement?: (updates: Partial<PptxElement>) => void;
		animationState?: ElementAnimationState;
	} = {},
): void {
	act(() => {
		root.render(
			React.createElement(
				Rendering3DFlagsContext.Provider,
				{ value: { ...DEFAULT_RENDERING_3D_FLAGS, smartArt3D } },
				React.createElement(SmartArtElement, { element: makeElement(), ...props }),
			),
		);
	});
}

describe('smartArtElement - <pptx-three-view> gating', () => {
	it('mounts <pptx-three-view> when resolveSmartArtThreeViewSpec returns a spec', () => {
		resolveSmartArtThreeViewSpec.mockReturnValue(SPEC);
		render(true);
		expect(resolveSmartArtThreeViewSpec).toHaveBeenCalledWith(makeElement(), true);
		expect(threeView(container)).not.toBeNull();
	});

	it('reads the smartArt3D flag straight from Rendering3DFlagsContext', () => {
		resolveSmartArtThreeViewSpec.mockReturnValue(null);
		render(false);
		expect(resolveSmartArtThreeViewSpec).toHaveBeenCalledWith(makeElement(), false);
	});

	it('stays on the plain SVG path when resolveSmartArtThreeViewSpec returns null', () => {
		resolveSmartArtThreeViewSpec.mockReturnValue(null);
		render(true);
		expect(threeView(container)).toBeNull();
		expect(container.querySelector('svg')).not.toBeNull();
	});
});

describe('smartArtElement - <pptx-three-view> property wiring', () => {
	it('sets interactive from canEdit and forwards textStyle', () => {
		resolveSmartArtThreeViewSpec.mockReturnValue(SPEC);
		render(true, {
			canEdit: true,
			onUpdateElement: vi.fn(),
			animationState: { visible: true, cssAnimation: undefined, textStyle: { bold: true } },
		});
		const view = threeView(container);
		expect(view?.interactive).toBeTruthy();
		expect(view?.textStyle).toStrictEqual({ bold: true });
	});

	it('is non-interactive on a read-only mount', () => {
		resolveSmartArtThreeViewSpec.mockReturnValue(SPEC);
		render(true);
		expect(threeView(container)?.interactive).toBeFalsy();
	});
});

describe('smartArtElement - inline node-text-edit overlay', () => {
	it('layers the invisible SVG hit-test overlay on top when editable', () => {
		resolveSmartArtThreeViewSpec.mockReturnValue(SPEC);
		render(true, { canEdit: true, onUpdateElement: vi.fn() });
		// The overlay's invisible SVG copy, plus the scene's slotted fallback SVG.
		expect(container.querySelectorAll('svg').length).toBeGreaterThanOrEqual(2);
		expect(container.querySelector('.opacity-0')).not.toBeNull();
	});

	it('renders no edit overlay on a read-only mount', () => {
		resolveSmartArtThreeViewSpec.mockReturnValue(SPEC);
		render(true, { canEdit: false });
		expect(container.querySelector('.opacity-0')).toBeNull();
	});

	it('renders no edit overlay without a commit path (no onUpdateElement)', () => {
		resolveSmartArtThreeViewSpec.mockReturnValue(SPEC);
		render(true, { canEdit: true });
		expect(container.querySelector('.opacity-0')).toBeNull();
	});
});
