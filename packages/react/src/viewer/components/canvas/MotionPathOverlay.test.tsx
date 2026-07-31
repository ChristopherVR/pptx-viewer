// @vitest-environment happy-dom
import type { PptxElement } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MotionPathOverlay } from './MotionPathOverlay';

vi.mock(import('react-i18next'), () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

const ELEMENT = {
	id: 'el-1',
	type: 'shape',
	x: 540,
	y: 300,
	width: 200,
	height: 120,
} as unknown as PptxElement;

const CANVAS = { width: 1280, height: 720 };

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
	globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

function render(path: string, onChangePath?: (p: string) => void, canEdit = true): void {
	act(() => {
		root.render(
			<MotionPathOverlay
				element={ELEMENT}
				path={path}
				canvasSize={CANVAS}
				scale={1}
				canEdit={canEdit}
				onChangePath={onChangePath}
			/>,
		);
	});
}

describe('motionPathOverlay', () => {
	it('draws the path from the element centre in slide pixels', () => {
		render('M 0 0 L 0.25 0');
		const d = container.querySelector('path')?.getAttribute('d');
		// Centre is (540 + 100, 300 + 60) = (640, 360); +0.25 * 1280 = 960.
		expect(d).toBe('M 640 360 L 640 360 L 960 360');
	});

	it('places the end handle at the path end', () => {
		render('M 0 0 L 0.25 0');
		const handle = container.querySelector('[data-pptx-motion-path-handle="end"]');
		expect(handle?.getAttribute('cx')).toBe('960');
		expect(handle?.getAttribute('cy')).toBe('360');
	});

	it('renders nothing for an unparseable path', () => {
		render('');
		expect(container.querySelector('svg')).toBeNull();
	});

	it('leaves the handle inert on a closed shape path (no free end)', () => {
		render('M 0 0 L 0.125 0 L 0.125 -0.2222 Z', vi.fn());
		const handle = container.querySelector('[data-pptx-motion-path-handle="end"]');
		expect(handle?.getAttribute('class') ?? '').not.toContain('pointer-events-auto');
	});

	it('commits a retargeted path while the end handle is dragged', () => {
		const onChangePath = vi.fn();
		render('M 0 0 L 0.25 0', onChangePath);
		const handle = container.querySelector(
			'[data-pptx-motion-path-handle="end"]',
		) as unknown as SVGCircleElement;
		(handle as unknown as { setPointerCapture: (id: number) => void }).setPointerCapture = () => {};
		act(() => {
			handle.dispatchEvent(
				new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 0, clientY: 0 }),
			);
			handle.dispatchEvent(
				new PointerEvent('pointermove', { bubbles: true, pointerId: 1, clientX: 128, clientY: 72 }),
			);
		});
		// +128px of 1280 == +0.1 fraction; +72px of 720 == +0.1 fraction.
		expect(onChangePath).toHaveBeenCalledWith('M 0 0 L 0.35 0.1');
	});
});
