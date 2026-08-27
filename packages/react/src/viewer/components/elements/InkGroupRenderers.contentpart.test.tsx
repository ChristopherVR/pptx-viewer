// @vitest-environment happy-dom
/**
 * `renderContentPart` paints `p:contentPart` ink strokes: a plain path by
 * default, pressure circles when a stroke carries varying per-point
 * pressure, and (since pen-tilt channel support landed) calligraphic nib
 * ellipses when a stroke carries tilt data, taking priority over pressure
 * circles.
 */
import type { ContentPartPptxElement } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { renderContentPart } from './InkGroupRenderers';

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

function contentPart(inkStrokes: ContentPartPptxElement['inkStrokes']): ContentPartPptxElement {
	return {
		type: 'contentPart',
		id: 'cp-1',
		x: 0,
		y: 0,
		width: 100,
		height: 80,
		inkStrokes,
	};
}

describe('renderContentPart', () => {
	it('renders a plain path when no pressure or tilt data is present', () => {
		const el = contentPart([{ path: 'M 0 0 L 10 10', color: '#000', width: 2, opacity: 1 }]);
		act(() => {
			root.render(renderContentPart(el));
		});
		expect(container.querySelectorAll('path')).toHaveLength(1);
		expect(container.querySelectorAll('ellipse')).toHaveLength(0);
	});

	it('renders pressure circles when pressures vary and no tilt data is present', () => {
		const el = contentPart([
			{
				path: 'M 0 0 L 10 0 L 20 0',
				color: '#000',
				width: 2,
				opacity: 1,
				pressures: [0.1, 0.9, 0.3],
			},
		]);
		act(() => {
			root.render(renderContentPart(el));
		});
		expect(container.querySelectorAll('path')).toHaveLength(0);
		expect(container.querySelectorAll('circle').length).toBeGreaterThan(0);
	});

	it('renders calligraphic nib ellipses, taking priority over pressure circles', () => {
		const el = contentPart([
			{
				path: 'M 0 0 L 10 0 L 20 0',
				color: '#123456',
				width: 3,
				opacity: 1,
				pressures: [0.1, 0.9, 0.3],
				tiltAngles: [0, Math.PI / 4, Math.PI / 2],
				tiltMagnitudes: [0.2, 0.6, 0.9],
			},
		]);
		act(() => {
			root.render(renderContentPart(el));
		});
		expect(container.querySelectorAll('path')).toHaveLength(0);
		expect(container.querySelectorAll('circle')).toHaveLength(0);
		const ellipses = container.querySelectorAll('ellipse');
		expect(ellipses.length).toBeGreaterThan(0);
		expect(ellipses[0].getAttribute('fill')).toBe('#123456');
	});

	it('falls back to the labelled placeholder when the part decoded no strokes', () => {
		const el = contentPart(undefined);
		act(() => {
			root.render(renderContentPart(el));
		});
		expect(container.querySelectorAll('svg')).toHaveLength(0);
		expect(container.textContent).toBeTruthy();
	});
});
