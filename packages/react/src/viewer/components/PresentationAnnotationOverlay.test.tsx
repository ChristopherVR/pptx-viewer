// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PresentationAnnotationOverlay } from './PresentationAnnotationOverlay';
import type { PresentationAnnotationOverlayProps } from './PresentationAnnotationOverlay';

/**
 * Pins the repoint onto the shared `buildStrokePathD` / `cursorForTool`
 * (packages/shared/src/render/annotation-overlay.ts): the stroke path `d`
 * attribute and the overlay cursor must still match what the formerly-private
 * local copies produced.
 */

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
});

function baseProps(overrides: Partial<PresentationAnnotationOverlayProps> = {}) {
	return {
		canvasSize: { width: 960, height: 540 },
		editorScale: 1,
		presentationTool: 'pen',
		blackout: 'none',
		annotationStrokes: [
			{
				id: 's1',
				points: [
					{ x: 0, y: 0 },
					{ x: 10, y: 5 },
				],
				color: '#ff0000',
				width: 2,
				opacity: 1,
			},
		],
		currentStroke: null,
		laserPosition: null,
		onPointerDown: () => {},
		onPointerMove: () => {},
		onPointerUp: () => {},
		onLaserMove: () => {},
		onLaserLeave: () => {},
		onEraseAtPoint: () => {},
		...overrides,
	} as unknown as PresentationAnnotationOverlayProps;
}

describe('presentationAnnotationOverlay', () => {
	it('builds the stroke path d attribute via the shared buildStrokePathD', () => {
		act(() => root.render(<PresentationAnnotationOverlay {...baseProps()} />));
		const path = container.querySelector('path');
		expect(path?.getAttribute('d')).toBe('M 0 0 L 10 5');
	});

	it('resolves the cursor style via the shared cursorForTool', () => {
		act(() =>
			root.render(<PresentationAnnotationOverlay {...baseProps({ presentationTool: 'laser' })} />),
		);
		const overlay = container.querySelector('[data-pptx-annotation-overlay]') as HTMLElement;
		expect(overlay.style.cursor).toBe('none');

		act(() =>
			root.render(<PresentationAnnotationOverlay {...baseProps({ presentationTool: 'pen' })} />),
		);
		const overlayPen = container.querySelector('[data-pptx-annotation-overlay]') as HTMLElement;
		expect(overlayPen.style.cursor).toBe('crosshair');
	});
});
