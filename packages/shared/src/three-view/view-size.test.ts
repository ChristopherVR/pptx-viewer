import { describe, expect, it } from 'vitest';

import { MAX_VIEW_PIXELS } from './renderer-host';
import {
	computeThreeViewSize,
	matrixScale,
	measureThreeViewSize,
	parseComputedTransform,
	threeViewSizeChanged,
} from './view-size';

describe('computeThreeViewSize', () => {
	it('draws a thumbnail at its on-screen size, not its layout size', () => {
		// A 600x300 chart shown in a thumbnail scaled to 20%.
		const size = computeThreeViewSize(600, 300, 120, 60, 1);
		expect(size).toStrictEqual({ width: 600, height: 300, pixelWidth: 120, pixelHeight: 60 });
	});

	it('scales the backing store by the device pixel ratio, capped at 2', () => {
		expect(computeThreeViewSize(400, 200, 400, 200, 1.5).pixelWidth).toBe(600);
		expect(computeThreeViewSize(400, 200, 400, 200, 3).pixelWidth).toBe(800);
	});

	it('falls back to the layout size when the element has no on-screen box', () => {
		const size = computeThreeViewSize(300, 150, 0, 0, 1);
		expect(size.pixelWidth).toBe(300);
		expect(size.pixelHeight).toBe(150);
	});

	it('never produces a zero or oversized backing store', () => {
		expect(computeThreeViewSize(0, 0, 0, 0, 1)).toMatchObject({ pixelWidth: 1, pixelHeight: 1 });
		expect(computeThreeViewSize(1000, 1000, 20000, 20000, 2).pixelWidth).toBe(MAX_VIEW_PIXELS);
	});
});

describe('threeViewSizeChanged', () => {
	it('detects a zoom change even when the layout size is unchanged', () => {
		const a = computeThreeViewSize(600, 300, 600, 300, 1);
		const b = computeThreeViewSize(600, 300, 1200, 600, 1);
		expect(threeViewSizeChanged(a, b)).toBeTruthy();
		expect(threeViewSizeChanged(a, { ...a })).toBeFalsy();
	});
});

describe('parseComputedTransform', () => {
	it('reads matrix and matrix3d, and nothing else', () => {
		expect(parseComputedTransform('matrix(1, 2, 3, 4, 5, 6)')).toStrictEqual({
			a: 1,
			b: 2,
			c: 3,
			d: 4,
		});
		expect(
			parseComputedTransform('matrix3d(1, 2, 0, 0, 3, 4, 0, 0, 0, 0, 1, 0, 5, 6, 0, 1)'),
		).toStrictEqual({ a: 1, b: 2, c: 3, d: 4 });
		expect(parseComputedTransform('none')).toBeNull();
		expect(parseComputedTransform(undefined)).toBeNull();
	});
});

describe('matrixScale', () => {
	it('reads the scale of a turned matrix, not the size of its bounding box', () => {
		const angle = (30 * Math.PI) / 180;
		const { x, y } = matrixScale({
			a: 0.5 * Math.cos(angle),
			b: 0.5 * Math.sin(angle),
			c: -0.5 * Math.sin(angle),
			d: 0.5 * Math.cos(angle),
		});
		expect(x).toBeCloseTo(0.5);
		expect(y).toBeCloseTo(0.5);
	});
});

describe('measureThreeViewSize', () => {
	/** An element under `ancestors` (nearest first), each with a computed style. */
	function stubElement(
		layout: [number, number],
		styles: Array<{ transform?: string; scale?: string }>,
	): HTMLElement {
		const nodes: Array<Record<string, unknown>> = styles.map(() => ({}));
		const win = {
			devicePixelRatio: 1,
			getComputedStyle: (node: Record<string, unknown>) => ({
				transform: 'none',
				scale: 'none',
				...styles[nodes.indexOf(node)],
			}),
		};
		nodes.forEach((node, i) => {
			node.parentElement = nodes[i + 1] ?? null;
			node.getRootNode = () => node;
			node.ownerDocument = { defaultView: win };
		});
		Object.assign(nodes[0] as object, { clientWidth: layout[0], clientHeight: layout[1] });
		return nodes[0] as unknown as HTMLElement;
	}

	it('ignores the rotation of an ancestor (the turned bounding box is not the size)', () => {
		const angle = (50 * Math.PI) / 180;
		const cos = Math.cos(angle);
		const sin = Math.sin(angle);
		const el = stubElement(
			[1067, 560],
			[
				{},
				{ transform: `matrix(${cos}, ${sin}, ${-sin}, ${cos}, 10, 20)` },
				{ transform: 'matrix(0.5, 0, 0, 0.5, 0, 0)' },
			],
		);
		const size = measureThreeViewSize(el);
		expect(Math.abs(size.pixelWidth - 1067 * 0.5)).toBeLessThanOrEqual(1);
		expect(Math.abs(size.pixelHeight - 560 * 0.5)).toBeLessThanOrEqual(1);
	});

	it('applies the individual scale property', () => {
		const el = stubElement([400, 200], [{ scale: '2' }]);
		expect(measureThreeViewSize(el)).toMatchObject({ pixelWidth: 800, pixelHeight: 400 });
	});
});
