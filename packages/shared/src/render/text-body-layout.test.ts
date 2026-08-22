import type { PptxElement, TextStyle } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildTextBlockStyle } from './text-block-style';
import {
	buildTextBodyLayoutStyle,
	computeTabSize,
	getTextBodyRotationTransform,
	resolveTextBodyColumns,
	resolveTextOverflowClip,
	resolveVertOverflowEllipsisStyle,
} from './text-body-layout';

function textElement(textStyle: TextStyle, rotation?: number): PptxElement {
	return {
		id: 'e1',
		type: 'text',
		x: 0,
		y: 0,
		width: 200,
		height: 100,
		text: 'hello',
		textStyle,
		...(rotation !== undefined ? { rotation } : {}),
	} as PptxElement;
}

describe('resolveTextBodyColumns', () => {
	it('reports a single column when a:bodyPr declares none', () => {
		expect(resolveTextBodyColumns(undefined)).toStrictEqual({ count: 1 });
		expect(resolveTextBodyColumns({ columnCount: 1 })).toStrictEqual({ count: 1 });
	});

	it('clamps @numCol to the schema range 1..16', () => {
		expect(resolveTextBodyColumns({ columnCount: 30 }).count).toBe(16);
		expect(resolveTextBodyColumns({ columnCount: 0 }).count).toBe(1);
	});

	it('uses @spcCol as the gap, defaulting to the schema default of 0', () => {
		expect(resolveTextBodyColumns({ columnCount: 2, columnSpacing: 24 }).gap).toBe('24px');
		expect(resolveTextBodyColumns({ columnCount: 2 }).gap).toBe('0px');
	});
});

describe('computeTabSize', () => {
	it('falls back to @defTabSz when no stop is authored', () => {
		expect(computeTabSize(undefined, 48)).toBe('48px');
		expect(computeTabSize([], 48)).toBe('48px');
	});

	it('uses a single stop verbatim', () => {
		expect(computeTabSize([{ position: 96, align: 'l' }], 48)).toBe('96px');
	});

	it('averages the gaps between several stops', () => {
		expect(
			computeTabSize(
				[
					{ position: 40, align: 'l' },
					{ position: 100, align: 'l' },
					{ position: 200, align: 'r' },
				],
				48,
			),
		).toBe('80px');
	});

	it('returns undefined when nothing is authored at all', () => {
		expect(computeTabSize(undefined, undefined)).toBeUndefined();
	});
});

describe('resolveTextOverflowClip', () => {
	it('clips for @vertOverflow clip and ellipsis and @horzOverflow clip', () => {
		expect(resolveTextOverflowClip({ vertOverflow: 'clip' })).toBe('hidden');
		expect(resolveTextOverflowClip({ vertOverflow: 'ellipsis' })).toBe('hidden');
		expect(resolveTextOverflowClip({ hOverflow: 'clip' })).toBe('hidden');
	});

	it('does not clip for the explicit overflow values or an absent attribute', () => {
		expect(resolveTextOverflowClip({ vertOverflow: 'overflow' })).toBeUndefined();
		expect(resolveTextOverflowClip({ hOverflow: 'overflow' })).toBeUndefined();
		expect(resolveTextOverflowClip(undefined)).toBeUndefined();
	});
});

describe('buildTextBodyLayoutStyle', () => {
	it('is a flex column anchored by @anchor for a single-column body', () => {
		const style = buildTextBodyLayoutStyle(textElement({ vAlign: 'middle' }));
		expect(style.display).toBe('flex');
		expect(style.flexDirection).toBe('column');
		expect(style.justifyContent).toBe('center');
	});

	it('is a multi-column block for @numCol > 1, because multicol ignores flex', () => {
		const style = buildTextBodyLayoutStyle(
			textElement({ columnCount: 3, columnSpacing: 12, vAlign: 'bottom' }),
		);
		expect(style.display).toBe('block');
		expect(style.columnCount).toBe(3);
		expect(style.columnGap).toBe('12px');
		expect(style.justifyContent).toBeUndefined();
	});

	it('centres the text bounding box for @anchorCtr', () => {
		expect(buildTextBodyLayoutStyle(textElement({ anchorCenter: true })).alignItems).toBe('center');
		expect(buildTextBodyLayoutStyle(textElement({})).alignItems).toBeUndefined();
	});

	it('emits tab-size and the kinsoku rules', () => {
		const style = buildTextBodyLayoutStyle(
			textElement({ defaultTabSize: 64, latinLineBreak: true, hangingPunctuation: true }),
		);
		expect(style.tabSize).toBe('64px');
		expect(style.wordBreak).toBe('break-all');
		expect(style.hangingPunctuation).toBe('last');
	});

	it('is empty for an element with no text properties', () => {
		const picture = { id: 'p', type: 'picture', x: 0, y: 0, width: 10, height: 10 } as PptxElement;
		expect(buildTextBodyLayoutStyle(picture)).toStrictEqual({});
	});
});

describe('getTextBodyRotationTransform', () => {
	it('maps a:bodyPr/@rot degrees straight onto a CSS rotation', () => {
		expect(getTextBodyRotationTransform(textElement({ textBodyRotation: 45 }))).toBe(
			'rotate(45deg)',
		);
		expect(getTextBodyRotationTransform(textElement({ textBodyRotation: -90 }))).toBe(
			'rotate(-90deg)',
		);
	});

	it('returns undefined for an absent or zero rotation', () => {
		expect(getTextBodyRotationTransform(textElement({}))).toBeUndefined();
		expect(getTextBodyRotationTransform(textElement({ textBodyRotation: 0 }))).toBeUndefined();
	});

	describe('@upright', () => {
		it('counter-rotates by the shape own rotation to stay screen-upright', () => {
			expect(getTextBodyRotationTransform(textElement({ upright: true }, 30))).toBe(
				'rotate(-30deg)',
			);
			expect(getTextBodyRotationTransform(textElement({ upright: true }, -15))).toBe(
				'rotate(15deg)',
			);
		});

		it('composes with an authored bodyPr @rot on the same transform', () => {
			expect(
				getTextBodyRotationTransform(textElement({ upright: true, textBodyRotation: 10 }, 30)),
			).toBe('rotate(-20deg)');
		});

		it('is a no-op without upright, or when the shape itself is unrotated', () => {
			expect(getTextBodyRotationTransform(textElement({}, 30))).toBeUndefined();
			expect(getTextBodyRotationTransform(textElement({ upright: true }, 0))).toBeUndefined();
			expect(getTextBodyRotationTransform(textElement({ upright: true }))).toBeUndefined();
		});
	});
});

describe('resolveVertOverflowEllipsisStyle', () => {
	it('is empty when @vertOverflow is not ellipsis', () => {
		expect(resolveVertOverflowEllipsisStyle({ vertOverflow: 'clip' }, 100, 20)).toStrictEqual({});
		expect(resolveVertOverflowEllipsisStyle(undefined, 100, 20)).toStrictEqual({});
	});

	it('estimates a line-clamp count from content height / line height', () => {
		expect(resolveVertOverflowEllipsisStyle({ vertOverflow: 'ellipsis' }, 100, 20)).toStrictEqual({
			display: '-webkit-box',
			WebkitBoxOrient: 'vertical',
			WebkitLineClamp: 5,
			overflow: 'hidden',
			textOverflow: 'ellipsis',
		});
	});

	it('clamps to at least one line, even for a non-positive content height', () => {
		expect(
			resolveVertOverflowEllipsisStyle({ vertOverflow: 'ellipsis' }, 5, 20).WebkitLineClamp,
		).toBe(1);
		expect(
			resolveVertOverflowEllipsisStyle({ vertOverflow: 'ellipsis' }, 0, 20).WebkitLineClamp,
		).toBe(1);
		expect(
			resolveVertOverflowEllipsisStyle({ vertOverflow: 'ellipsis' }, -10, 20).WebkitLineClamp,
		).toBe(1);
	});

	it('is empty when the line height is unusable, so the plain clip still wins', () => {
		expect(resolveVertOverflowEllipsisStyle({ vertOverflow: 'ellipsis' }, 100, 0)).toStrictEqual(
			{},
		);
	});
});

// The four bindings that fold the body box and the body typography onto one
// element get every decision above through `buildTextBlockStyle`; before wave 4
// its `bodyLayout` branch had no branch for any of them, so these are the
// assertions that keep vue / angular / svelte / vanilla at React's parity.
describe('buildTextBlockStyle bodyLayout', () => {
	it('renders a multi-column body as a column block', () => {
		const style = buildTextBlockStyle(textElement({ columnCount: 2, columnSpacing: 18 }), {
			bodyLayout: true,
			pxLengths: true,
		});
		expect(style.display).toBe('block');
		expect(style.columnCount).toBe(2);
		expect(style.columnGap).toBe('18px');
	});

	it('carries tab-size, anchorCtr and the body rotation', () => {
		const style = buildTextBlockStyle(
			textElement({ defaultTabSize: 48, anchorCenter: true, textBodyRotation: 30 }),
			{ bodyLayout: true, pxLengths: true },
		);
		expect(style.tabSize).toBe('48px');
		expect(style.alignItems).toBe('center');
		expect(style.transform).toBe('rotate(30deg)');
	});

	it('lets @vertOverflow="clip" beat the wrap="none" overflow rule', () => {
		const style = buildTextBlockStyle(textElement({ textWrap: 'none', vertOverflow: 'clip' }), {
			bodyLayout: true,
		});
		expect(style.whiteSpace).toBe('nowrap');
		expect(style.overflow).toBe('hidden');
	});

	it('leaves an ordinary body overflowing, as PowerPoint does', () => {
		expect(buildTextBlockStyle(textElement({}), { bodyLayout: true }).overflow).toBe('visible');
	});
});
