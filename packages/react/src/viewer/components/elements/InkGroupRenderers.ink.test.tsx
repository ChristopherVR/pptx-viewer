// @vitest-environment happy-dom
/**
 * `renderInk` paints a Draw-tab `InkPptxElement`: a plain path by default,
 * pressure circles when a path carries varying per-point pressure
 * (`inkPointPressures`), and calligraphic nib ellipses when a path carries
 * genuine pen-tilt data (`inkPointTiltX`/`inkPointTiltY`), taking priority
 * over pressure circles. Mirrors `InkGroupRenderers.contentpart.test.tsx`
 * (the loaded-`p:contentPart` counterpart of this element type).
 */
import type { InkPptxElement } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { renderInk } from './InkGroupRenderers';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
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

function inkElement(overrides: Partial<InkPptxElement>): InkPptxElement {
	return {
		type: 'ink',
		id: 'ink-1',
		x: 0,
		y: 0,
		width: 100,
		height: 80,
		inkPaths: ['M 0 0 L 10 10'],
		inkColors: ['#000'],
		inkWidths: [2],
		...overrides,
	};
}

describe('renderInk', () => {
	it('renders a plain path when no pressure or tilt data is present', () => {
		const el = inkElement({});
		act(() => {
			root.render(renderInk(el));
		});
		expect(container.querySelectorAll('path')).toHaveLength(1);
		expect(container.querySelectorAll('ellipse')).toHaveLength(0);
	});

	it('renders pressure circles when inkPointPressures genuinely varies', () => {
		const el = inkElement({
			inkPaths: ['M 0 0 L 10 0 L 20 0'],
			inkPointPressures: [[0.1, 0.9, 0.3]],
		});
		act(() => {
			root.render(renderInk(el));
		});
		expect(container.querySelectorAll('path')).toHaveLength(0);
		expect(container.querySelectorAll('circle').length).toBeGreaterThan(0);
	});

	it('renders calligraphic nib ellipses when inkPointTiltX/Y carry a genuine lean, taking priority over pressure circles', () => {
		const el = inkElement({
			inkPaths: ['M 0 0 L 10 0 L 20 0'],
			inkColors: ['#123456'],
			inkWidths: [3],
			inkPointPressures: [[0.1, 0.9, 0.3]],
			inkPointTiltX: [[10, 0, 0]],
			inkPointTiltY: [[0, 20, 0]],
		});
		act(() => {
			root.render(renderInk(el));
		});
		expect(container.querySelectorAll('path')).toHaveLength(0);
		expect(container.querySelectorAll('circle')).toHaveLength(0);
		const ellipses = container.querySelectorAll('ellipse');
		expect(ellipses.length).toBeGreaterThan(0);
		expect(ellipses[0].getAttribute('fill')).toBe('#123456');
	});

	// In practice `strokeToInkElement` (see ink-drawing.test.ts) never attaches
	// `inkPointTiltX/Y` for an all-flat stroke, so the renderer would not
	// normally see this input; this exercises it directly anyway to confirm
	// it degrades safely rather than distorting the stroke.
	it('a constant (0, 0) tilt reading degenerates to circular ellipses (rPerp === rTilt), not a distorted lean', () => {
		const el = inkElement({
			inkPaths: ['M 0 0 L 10 0'],
			inkPointTiltX: [[0, 0]],
			inkPointTiltY: [[0, 0]],
		});
		act(() => {
			root.render(renderInk(el));
		});
		const ellipses = container.querySelectorAll('ellipse');
		expect(ellipses.length).toBeGreaterThan(0);
		for (const ellipse of ellipses) {
			expect(ellipse.getAttribute('rx')).toBe(ellipse.getAttribute('ry'));
		}
	});
});
