import { describe, expect, it } from 'vitest';

import { createInkLivePreviewOverlay } from './ink-live-preview-overlay';

const canvasSize = { width: 960, height: 540 };

describe('createInkLivePreviewOverlay', () => {
	it('mounts its root into the given stage element', () => {
		const overlay = createInkLivePreviewOverlay(document);
		const stage = document.createElement('div');
		overlay.mount(stage);
		expect(overlay.root.parentElement).toBe(stage);
	});

	it('detaches when mounted with null', () => {
		const overlay = createInkLivePreviewOverlay(document);
		const stage = document.createElement('div');
		overlay.mount(stage);
		overlay.mount(null);
		expect(overlay.root.parentElement).toBeNull();
	});

	it('renders nib-mark ellipses for a stroke view with tilt data', () => {
		const overlay = createInkLivePreviewOverlay(document);
		overlay.update(
			{
				d: 'M 0 0 L 10 0',
				color: '#000',
				width: 4,
				opacity: 1,
				circles: null,
				nibMarks: [{ cx: 0, cy: 0, rTilt: 2, rPerp: 3, rotationDeg: 45 }],
			},
			canvasSize,
		);
		expect(overlay.root.querySelectorAll('ellipse')).toHaveLength(1);
		expect(overlay.root.querySelector('path')).toBeNull();
	});

	it('renders a plain path for a stroke view with no pressure/tilt data', () => {
		const overlay = createInkLivePreviewOverlay(document);
		overlay.update(
			{ d: 'M 0 0 L 10 0', color: '#000', width: 4, opacity: 1, circles: null, nibMarks: null },
			canvasSize,
		);
		expect(overlay.root.querySelectorAll('ellipse')).toHaveLength(0);
		expect(overlay.root.querySelector('path')?.getAttribute('d')).toBe('M 0 0 L 10 0');
	});

	it('clears its content when updated with null', () => {
		const overlay = createInkLivePreviewOverlay(document);
		overlay.update(
			{ d: 'M 0 0 L 10 0', color: '#000', width: 4, opacity: 1, circles: null, nibMarks: null },
			canvasSize,
		);
		overlay.update(null, canvasSize);
		expect(overlay.root.childElementCount).toBe(0);
	});

	it('destroy() removes the root from its parent', () => {
		const overlay = createInkLivePreviewOverlay(document);
		const stage = document.createElement('div');
		overlay.mount(stage);
		overlay.destroy();
		expect(overlay.root.parentElement).toBeNull();
	});
});
