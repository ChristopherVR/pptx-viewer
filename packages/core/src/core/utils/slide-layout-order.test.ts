import { describe, it, expect } from 'vitest';

import type { XmlObject } from '../types';
import { resolveSlideLayoutOrder } from './slide-layout-order';

const LAYOUT_REL_TYPE =
	'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout';
const THEME_REL_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme';

function rel(id: string, target: string, type: string = LAYOUT_REL_TYPE): XmlObject {
	return { '@_Id': id, '@_Type': type, '@_Target': target };
}

function master(...relIds: string[]): XmlObject {
	return {
		'p:sldLayoutIdLst': {
			'p:sldLayoutId': relIds.map((id, index) => ({
				'@_id': String(2147483649 + index),
				'@_r:id': id,
			})),
		},
	};
}

/** Mirrors the runtime's `../slideLayouts/x.xml` -> `ppt/slideLayouts/x.xml`. */
const resolve = (target: string) => `ppt/${target.replace(/^\.\.\//u, '')}`;

describe('resolveSlideLayoutOrder', () => {
	it('follows p:sldLayoutIdLst rather than relationship order', () => {
		// The .rels bag is unordered and frequently sorted as text, which puts
		// rId10 ahead of rId2. The gallery must show the authored order instead.
		const rels = [
			rel('rId10', '../slideLayouts/slideLayout10.xml'),
			rel('rId2', '../slideLayouts/slideLayout2.xml'),
			rel('rId1', '../slideLayouts/slideLayout1.xml'),
		];

		const result = resolveSlideLayoutOrder(master('rId1', 'rId2', 'rId10'), rels, resolve);

		expect(result).toStrictEqual([
			'ppt/slideLayouts/slideLayout1.xml',
			'ppt/slideLayouts/slideLayout2.xml',
			'ppt/slideLayouts/slideLayout10.xml',
		]);
	});

	it('ignores non-layout relationships', () => {
		const rels = [
			rel('rId1', '../slideLayouts/slideLayout1.xml'),
			rel('rId9', '../theme/theme1.xml', THEME_REL_TYPE),
		];

		expect(resolveSlideLayoutOrder(master('rId1'), rels, resolve)).toStrictEqual([
			'ppt/slideLayouts/slideLayout1.xml',
		]);
	});

	it('appends layouts no sldLayoutId points at', () => {
		// A malformed deck still owns the layout part, so dropping it would hide
		// a layout the file genuinely contains.
		const rels = [
			rel('rId1', '../slideLayouts/slideLayout1.xml'),
			rel('rId2', '../slideLayouts/orphan.xml'),
		];

		expect(resolveSlideLayoutOrder(master('rId1'), rels, resolve)).toStrictEqual([
			'ppt/slideLayouts/slideLayout1.xml',
			'ppt/slideLayouts/orphan.xml',
		]);
	});

	it('handles a single sldLayoutId parsed as an object rather than an array', () => {
		const singleton: XmlObject = {
			'p:sldLayoutIdLst': { 'p:sldLayoutId': { '@_r:id': 'rId1' } },
		};

		expect(
			resolveSlideLayoutOrder(
				singleton,
				[rel('rId1', '../slideLayouts/slideLayout1.xml')],
				resolve,
			),
		).toStrictEqual(['ppt/slideLayouts/slideLayout1.xml']);
	});

	it('falls back to relationship order when the list is absent', () => {
		const rels = [rel('rId1', '../slideLayouts/a.xml'), rel('rId2', '../slideLayouts/b.xml')];

		expect(resolveSlideLayoutOrder({}, rels, resolve)).toStrictEqual([
			'ppt/slideLayouts/a.xml',
			'ppt/slideLayouts/b.xml',
		]);
		expect(resolveSlideLayoutOrder(undefined, rels, resolve)).toHaveLength(2);
	});

	it('lists a layout once even when two ids reference it', () => {
		const rels = [
			rel('rId1', '../slideLayouts/slideLayout1.xml'),
			rel('rId2', '../slideLayouts/slideLayout1.xml'),
		];

		expect(resolveSlideLayoutOrder(master('rId1', 'rId2'), rels, resolve)).toStrictEqual([
			'ppt/slideLayouts/slideLayout1.xml',
		]);
	});
});
