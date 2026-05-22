import { describe, expect, it } from 'vitest';

import { resolveLayoutDisplayName } from './layout-display-name';

describe('resolveLayoutDisplayName', () => {
	it('returns the cSld name when it is human-friendly', () => {
		expect(
			resolveLayoutDisplayName({
				name: 'Title and Content',
				type: 'obj',
				path: 'ppt/slideLayouts/slideLayout2.xml',
			}),
		).toBe('Title and Content');
	});

	it('maps OOXML @type to a friendly label when name is missing', () => {
		expect(
			resolveLayoutDisplayName({
				name: '',
				type: 'title',
				path: 'ppt/slideLayouts/slideLayout1.xml',
			}),
		).toBe('Title Slide');
	});

	it('maps OOXML @type to a friendly label when name is just the ZIP path', () => {
		expect(
			resolveLayoutDisplayName({
				name: 'ppt/slideLayouts/slideLayout3.xml',
				type: 'secHead',
				path: 'ppt/slideLayouts/slideLayout3.xml',
			}),
		).toBe('Section Header');
	});

	it('handles all common OOXML layout types', () => {
		const cases: Array<[string, string]> = [
			['title', 'Title Slide'],
			['obj', 'Title and Content'],
			['secHead', 'Section Header'],
			['twoObj', 'Two Content'],
			['twoTxTwoObj', 'Comparison'],
			['titleOnly', 'Title Only'],
			['blank', 'Blank'],
			['objTx', 'Content with Caption'],
			['picTx', 'Picture with Caption'],
			['vertTitleAndTx', 'Vertical Title and Text'],
			['vertTx', 'Vertical Text'],
			['tx', 'Title and Text'],
		];
		for (const [type, expected] of cases) {
			expect(
				resolveLayoutDisplayName({
					name: '',
					type,
					path: 'ppt/slideLayouts/slideLayout9.xml',
				}),
			).toBe(expected);
		}
	});

	it('falls back to "Slide Layout N" parsed from the path', () => {
		expect(
			resolveLayoutDisplayName({
				name: '',
				path: 'ppt/slideLayouts/slideLayout17.xml',
			}),
		).toBe('Slide Layout 17');
	});

	it('falls back to "Slide Layout" when the path has no number', () => {
		expect(
			resolveLayoutDisplayName({
				name: '',
				path: 'ppt/slideLayouts/custom.xml',
			}),
		).toBe('Slide Layout');
	});

	it('trims whitespace from a usable name', () => {
		expect(
			resolveLayoutDisplayName({
				name: '  My Custom Layout  ',
				path: 'ppt/slideLayouts/slideLayout4.xml',
			}),
		).toBe('My Custom Layout');
	});

	it('treats an unknown type as missing and falls back to path', () => {
		expect(
			resolveLayoutDisplayName({
				name: '',
				type: 'someUnknownType',
				path: 'ppt/slideLayouts/slideLayout42.xml',
			}),
		).toBe('Slide Layout 42');
	});
});
