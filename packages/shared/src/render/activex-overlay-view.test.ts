import type { PptxActiveXControl } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { getActiveXControlOverlayView } from './activex-overlay-view';

const SLIDE = { width: 960, height: 540 };

function control(overrides: Partial<PptxActiveXControl> = {}): PptxActiveXControl {
	return { relId: 'rId1', ...overrides };
}

describe('getActiveXControlOverlayView', () => {
	it('uses the control geometry when present', () => {
		const view = getActiveXControlOverlayView(
			control({ x: 10, y: 20, width: 100, height: 50, name: 'MyButton' }),
			SLIDE,
		);
		expect(view).toMatchObject({ left: 10, top: 20, width: 100, height: 50, label: 'MyButton' });
	});

	it('falls back to placeholder geometry when the control has no fallback picture', () => {
		const view = getActiveXControlOverlayView(control(), SLIDE);
		expect(view.left).toBe(8);
		expect(view.top).toBe(8);
		expect(view.width).toBe(120);
		expect(view.height).toBe(40);
	});

	it('stacks placeholder badges by index when there is no authored geometry', () => {
		const first = getActiveXControlOverlayView(control(), SLIDE, 0);
		const second = getActiveXControlOverlayView(control(), SLIDE, 1);
		expect(second.top).toBeGreaterThan(first.top);
	});

	it('uses a generic label when the control has no name', () => {
		const view = getActiveXControlOverlayView(control(), SLIDE);
		expect(view.label).toBe('ActiveX control');
	});

	it('clamps a fallback picture larger than the slide', () => {
		const view = getActiveXControlOverlayView(control({ width: 2000, height: 2000 }), SLIDE);
		expect(view.width).toBe(SLIDE.width);
		expect(view.height).toBe(SLIDE.height);
	});

	it('resolves the fallback image and sets className to image', () => {
		const view = getActiveXControlOverlayView(
			control({ fallbackImageRelId: 'rId5' }),
			SLIDE,
			0,
			(relId) => (relId === 'rId5' ? 'data:image/png;base64,xyz' : undefined),
		);
		expect(view.imageUrl).toBe('data:image/png;base64,xyz');
		expect(view.className).toBe('image');
	});

	it('renders the placeholder className when the resolver returns nothing', () => {
		const view = getActiveXControlOverlayView(
			control({ fallbackImageRelId: 'rId5' }),
			SLIDE,
			0,
			() => undefined,
		);
		expect(view.imageUrl).toBeUndefined();
		expect(view.className).toBe('placeholder');
	});

	it('renders the placeholder className when no resolver is given', () => {
		const view = getActiveXControlOverlayView(control({ fallbackImageRelId: 'rId5' }), SLIDE);
		expect(view.className).toBe('placeholder');
	});
});
