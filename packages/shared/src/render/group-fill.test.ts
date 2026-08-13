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

	// `a:grpFill` resolves against the nearest ANCESTOR group that has a fill,
	// so a fill-less group in the middle passes its own inherited fill down.
	// Before chaining, every binding asked the IMMEDIATE group only and a shape
	// two levels down painted transparent.
	it('passes the inherited fill through a group with no fill of its own', () => {
		expect(getGroupChildParentFill(group(undefined), { fillColor: '#abcdef' })).toStrictEqual({
			fillColor: '#abcdef',
		});
	});

	it('passes the inherited fill through a group whose own fill is itself grpFill', () => {
		expect(
			getGroupChildParentFill(group({ fillMode: 'group' }), { fillColor: '#abcdef' }),
		).toStrictEqual({ fillColor: '#abcdef' });
	});

	it('prefers the group own fill over the inherited one', () => {
		expect(
			getGroupChildParentFill(group({ fillColor: '#123456' }), { fillColor: '#abcdef' }),
		).toStrictEqual({ fillColor: '#123456' });
	});

	it('still returns undefined for a non-group element with an inherited fill', () => {
		expect(getGroupChildParentFill(shape(undefined), { fillColor: '#abcdef' })).toBeUndefined();
	});

	// End to end over a two-level tree, the way a binding walks it: outer group
	// filled, middle group empty, leaf painted with `a:grpFill`.
	it('paints a grpFill leaf under a fill-less nested group', () => {
		const leaf = shape({ fillMode: 'group' });
		const middle = group(undefined, [leaf]);
		const outer = group({ fillColor: '#ff0000' }, [middle]);

		const middleFill = getGroupChildParentFill(outer);
		const leafFill = getGroupChildParentFill(middle, middleFill);

		expect(resolveGroupChildFill(leaf, leafFill)?.backgroundColor).toBe('#ff0000');
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
		expect(result?.backgroundImage).toBe('linear-gradient(180deg, #ff0000 0%, #0000ff 100%)');
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
