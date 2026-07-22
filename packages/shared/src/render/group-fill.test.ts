import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { getGroupChildParentFill, resolveGroupChildFill } from './group-fill';

function shape(shapeStyle?: ShapeStyle, overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'shape',
		id: 's1',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		shapeStyle,
		...overrides,
	} as PptxElement;
}

function group(groupFill: ShapeStyle | undefined, children: PptxElement[] = []): PptxElement {
	return {
		type: 'group',
		id: 'g1',
		x: 0,
		y: 0,
		width: 200,
		height: 200,
		children,
		groupFill,
	} as PptxElement;
}

describe('getGroupChildParentFill', () => {
	it('returns the group fill for a group element', () => {
		expect(getGroupChildParentFill(group({ fillColor: '#abcdef' }))).toStrictEqual({
			fillColor: '#abcdef',
		});
	});

	it('returns undefined for a group with no fill', () => {
		expect(getGroupChildParentFill(group(undefined))).toBeUndefined();
	});

	it('returns undefined for a non-group element', () => {
		expect(getGroupChildParentFill(shape({ fillColor: '#123456' }))).toBeUndefined();
	});
});

describe('resolveGroupChildFill', () => {
	it('resolves the parent group fill for a fillMode "group" child', () => {
		const result = resolveGroupChildFill(shape({ fillMode: 'group' }), { fillColor: '#abcdef' });
		expect(result?.backgroundColor).toBe('#abcdef');
	});

	it('resolves a parent group gradient fill for a grpFill child', () => {
		const result = resolveGroupChildFill(shape({ fillMode: 'group' }), {
			fillMode: 'gradient',
			fillGradientAngle: 90,
			fillGradientStops: [
				{ color: '#ff0000', position: 0 },
				{ color: '#0000ff', position: 100 },
			],
		});
		expect(result?.backgroundImage).toBe('linear-gradient(90deg, #ff0000 0%, #0000ff 100%)');
	});

	it('returns undefined for a child that does not use grpFill', () => {
		expect(
			resolveGroupChildFill(shape({ fillColor: '#00ff00' }), { fillColor: '#abcdef' }),
		).toBeUndefined();
	});

	it('returns undefined when no parent group fill is supplied', () => {
		expect(resolveGroupChildFill(shape({ fillMode: 'group' }), undefined)).toBeUndefined();
	});

	it('returns undefined for an element without shape properties', () => {
		const connector = { type: 'connector', id: 'c1', x: 0, y: 0, width: 10, height: 10 };
		expect(
			resolveGroupChildFill(connector as PptxElement, { fillColor: '#abcdef' }),
		).toBeUndefined();
	});
});
