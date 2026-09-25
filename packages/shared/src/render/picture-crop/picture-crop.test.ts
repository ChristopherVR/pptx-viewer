import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { CROP_ASPECT_PRESETS, cropFill, cropFit, cropToAspectRatio } from './crop-aspect';
import {
	beginCropDrag,
	dragCropHandle,
	imageRectFromCrop,
	panCropImage,
	toElementAxes,
} from './crop-geometry';
import { buildCropOverlay } from './crop-overlay';
import {
	cancelCropUpdate,
	canCropElement,
	cropModeKeyAction,
	cropSessionChanged,
	startCropSession,
} from './crop-session';

function picture(extra: Record<string, unknown> = {}): PptxElement {
	return {
		id: 'pic',
		type: 'picture',
		x: 100,
		y: 100,
		width: 200,
		height: 100,
		...extra,
	} as PptxElement;
}

describe('crop geometry', () => {
	it('derives the whole image from the frame and the insets', () => {
		const image = imageRectFromCrop(
			{ x: 100, y: 100, width: 200, height: 100 },
			{ cropLeft: 0.2, cropTop: 0, cropRight: 0.2, cropBottom: 0.5 },
		);
		expect(image.width).toBeCloseTo(1000 / 3);
		expect(image.x).toBeCloseTo(100 - 0.2 * (1000 / 3));
		expect(image).toMatchObject({ y: 100, height: 200 });
	});

	it('moves only the dragged edge and keeps the image still', () => {
		const start = beginCropDrag(picture());
		const update = dragCropHandle(start, 'w', 50, 999);
		expect(update).toMatchObject({ x: 150, y: 100, width: 150, height: 100, cropLeft: 0.25 });
		expect(update.cropRight).toBe(0);
		expect(update.cropTop).toBe(0);
	});

	it('moves two edges from a corner and stops at the image and the minimum size', () => {
		const start = beginCropDrag(picture());
		const corner = dragCropHandle(start, 'se', -40, -30);
		expect(corner).toMatchObject({ width: 160, height: 70, cropRight: 0.2, cropBottom: 0.3 });
		// Outward past the image edge clamps at no crop.
		expect(dragCropHandle(start, 'e', 80, 0)).toMatchObject({ width: 200, cropRight: 0 });
		// Inward past the opposite edge clamps at the minimum frame.
		expect(dragCropHandle(start, 'n', 0, 500).height).toBe(8);
	});

	it('maps display sides back to source sides for a flipped picture', () => {
		const start = beginCropDrag(picture({ flipHorizontal: true }));
		const update = dragCropHandle(start, 'w', 50, 0);
		expect(update.cropRight).toBe(0.25);
		expect(update.cropLeft).toBe(0);
	});

	it('keeps the unmoved edge in place on a rotated picture', () => {
		const el = picture({ rotation: 90 });
		const update = dragCropHandle(beginCropDrag(el), 'e', -100, 0);
		// Rotated 90deg about (200,150): the w edge sits at screen y=50 and must stay.
		const cy = update.y + update.height / 2;
		expect(cy - update.width / 2).toBeCloseTo(50);
	});

	it('pans the image within the frame and stops at its edges', () => {
		const el = picture({ cropLeft: 0.25, cropRight: 0.25 });
		const update = panCropImage(beginCropDrag(el), 1000, 0);
		expect(update.cropLeft).toBe(0);
		expect(update.cropRight).toBe(0.5);
		expect(update.x).toBe(100);
	});

	it('rotates slide deltas into element axes', () => {
		const { dx, dy } = toElementAxes(10, 0, 90);
		expect(dx).toBeCloseTo(0);
		expect(dy).toBeCloseTo(-10);
	});
});

describe('crop to aspect ratio, fill and fit', () => {
	it('lists PowerPoint presets with their groups', () => {
		expect(CROP_ASPECT_PRESETS.map((p) => p.id)).toContain('16:9');
		expect(CROP_ASPECT_PRESETS[0]).toMatchObject({ id: '1:1', group: 'square' });
		expect(CROP_ASPECT_PRESETS.find((p) => p.id === '2:3')?.group).toBe('portrait');
	});

	it('crops to the largest centred frame of the ratio', () => {
		const update = cropToAspectRatio(picture(), 1, 1);
		expect(update).toMatchObject({ x: 150, y: 100, width: 100, height: 100 });
		expect(update.cropLeft).toBe(0.25);
		expect(update.cropRight).toBe(0.25);
	});

	it('fills and fits a frame by the natural aspect', () => {
		const square = { width: 500, height: 500 };
		const fill = cropFill(picture(), square);
		expect(fill).toMatchObject({
			x: 100,
			width: 200,
			cropLeft: 0,
			cropTop: 0.25,
			cropBottom: 0.25,
		});
		const fit = cropFit(picture(), square);
		expect(fit).toMatchObject({ cropTop: 0, cropLeft: -0.5, cropRight: -0.5 });
	});
});

describe('crop overlay', () => {
	it('describes the ghost, frame and eight handles', () => {
		const overlay = buildCropOverlay(picture({ cropLeft: 0.5 }), 2);
		expect(overlay.ghost).toMatchObject({ left: -200, top: 0, width: 400, height: 100 });
		expect(overlay.ghost.clipPath).toContain('evenodd');
		expect(overlay.handles.map((h) => h.id)).toStrictEqual([
			'nw',
			'n',
			'ne',
			'e',
			'se',
			's',
			'sw',
			'w',
		]);
		const se = overlay.handles.find((h) => h.id === 'se')!;
		expect(se.left + se.width).toBeCloseTo(200);
		expect(se.width).toBeCloseTo(9);
		expect(se.cursor).toBe('nwse-resize');
	});
});

describe('crop session', () => {
	it('only starts on a croppable picture and restores the snapshot on cancel', () => {
		expect(
			startCropSession({ id: 's', type: 'shape', x: 0, y: 0, width: 1, height: 1 }),
		).toBeNull();
		expect(canCropElement(picture({ locks: { noCrop: true } }))).toBeFalsy();
		const el = picture({ cropTop: 0.1 });
		const session = startCropSession(el)!;
		expect(cropSessionChanged(session, el)).toBeFalsy();
		expect(cropSessionChanged(session, { ...el, cropTop: 0.2 } as PptxElement)).toBeTruthy();
		expect(cancelCropUpdate(session)).toMatchObject({ x: 100, cropTop: 0.1, cropLeft: 0 });
	});

	it('maps Enter and Escape', () => {
		expect(cropModeKeyAction('Enter')).toBe('commit');
		expect(cropModeKeyAction('Escape')).toBe('cancel');
		expect(cropModeKeyAction('a')).toBeNull();
	});
});
