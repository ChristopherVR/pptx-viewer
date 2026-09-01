import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { resolveSlideSizeRescaleTransform, scaleSlidesForSizeChange } from './slide-size-rescale';

// A 4:3 deck (9144000 x 6858000 EMU) going to 16:9 widescreen (12192000 x
// 6858000 EMU), the exact pair Design > Slide Size offers by default.
const FOUR_THREE = { widthEmu: 9144000, heightEmu: 6858000 };
const SIXTEEN_NINE = { widthEmu: 12192000, heightEmu: 6858000 };

describe('resolveSlideSizeRescaleTransform', () => {
	it('ensureFit scales by the smaller ratio and centres', () => {
		const t = resolveSlideSizeRescaleTransform(FOUR_THREE, SIXTEEN_NINE, 'ensureFit');
		// ratioX = 12192000/9144000 = 1.3333..., ratioY = 1. min = 1.
		expect(t.scale).toBeCloseTo(1, 10);
		expect(t.offsetX).toBeCloseTo((SIXTEEN_NINE.widthEmu - FOUR_THREE.widthEmu) / 2, 5);
		expect(t.offsetY).toBeCloseTo(0, 5);
	});

	it('maximize scales by the larger ratio and centres (content can overflow)', () => {
		const t = resolveSlideSizeRescaleTransform(FOUR_THREE, SIXTEEN_NINE, 'maximize');
		expect(t.scale).toBeCloseTo(12192000 / 9144000, 10);
		expect(t.offsetX).toBeCloseTo(0, 5);
		const scaledHeight = FOUR_THREE.heightEmu * t.scale;
		expect(t.offsetY).toBeCloseTo((SIXTEEN_NINE.heightEmu - scaledHeight) / 2, 5);
	});

	it('is a no-op transform for a degenerate old size', () => {
		const t = resolveSlideSizeRescaleTransform(
			{ widthEmu: 0, heightEmu: 0 },
			SIXTEEN_NINE,
			'maximize',
		);
		expect(t).toStrictEqual({ scale: 1, offsetX: 0, offsetY: 0 });
	});
});

function makeSlide(): PptxSlide {
	return {
		id: 's1',
		rId: 'rId1',
		elements: [
			{
				id: 'title',
				type: 'text',
				x: 100,
				y: 100,
				width: 500,
				height: 100,
				text: 'Hello',
				textStyle: { fontSize: 32 },
			},
			{
				id: 'grp',
				type: 'group',
				x: 50,
				y: 50,
				width: 200,
				height: 200,
				children: [
					{
						id: 'child',
						type: 'text',
						x: 10,
						y: 10,
						width: 80,
						height: 40,
						text: 'Nested',
						textStyle: { fontSize: 18 },
					},
				],
			},
		],
	} as unknown as PptxSlide;
}

describe('scaleSlidesForSizeChange', () => {
	it('scales top-level element frames and font sizes', () => {
		const [scaled] = scaleSlidesForSizeChange([makeSlide()], FOUR_THREE, SIXTEEN_NINE, 'ensureFit');
		const title = scaled.elements[0] as unknown as {
			x: number;
			y: number;
			width: number;
			height: number;
			textStyle: { fontSize: number };
		};
		// scale = 1 for ensureFit here, offsetX = (12192000-9144000)/2 = 1524000
		expect(title.x).toBeCloseTo(100 + 1524000, 5);
		expect(title.y).toBeCloseTo(100, 5);
		expect(title.width).toBeCloseTo(500, 5);
		expect(title.textStyle.fontSize).toBeCloseTo(32, 5);
	});

	it('scales only the group frame, not children coordinates, but scales nested font sizes', () => {
		const [scaled] = scaleSlidesForSizeChange([makeSlide()], FOUR_THREE, SIXTEEN_NINE, 'maximize');
		const scale = 12192000 / 9144000;
		const group = scaled.elements[1] as unknown as {
			x: number;
			y: number;
			width: number;
			height: number;
			children: Array<{ x: number; y: number; textStyle: { fontSize: number } }>;
		};
		expect(group.width).toBeCloseTo(200 * scale, 5);
		expect(group.height).toBeCloseTo(200 * scale, 5);
		// Child frame is untouched (relative to the group's own local space).
		expect(group.children[0].x).toBe(10);
		expect(group.children[0].y).toBe(10);
		// But the child's font size still scales.
		expect(group.children[0].textStyle.fontSize).toBeCloseTo(18 * scale, 5);
	});

	it('does not mutate the input slides', () => {
		const original = makeSlide();
		const originalX = (original.elements[0] as unknown as { x: number }).x;
		scaleSlidesForSizeChange([original], FOUR_THREE, SIXTEEN_NINE, 'maximize');
		expect((original.elements[0] as unknown as { x: number }).x).toBe(originalX);
	});
});
