import { describe, expect, it } from 'vitest';

import type { PptxData } from '../../types/presentation';
import {
	collectLayoutNames,
	collectMasterNames,
	uniqueDisplayName,
	uniquePrefixedName,
} from './master-layout-crud-names';

function dataWithMasters(masters: PptxData['slideMasters']): PptxData {
	return { slides: [], slideMasters: masters } as unknown as PptxData;
}

describe('master-layout-crud-names', () => {
	describe('collectLayoutNames', () => {
		it('gathers layout names across every master', () => {
			const data = dataWithMasters([
				{
					path: 'ppt/slideMasters/slideMaster1.xml',
					layouts: [
						{ path: 'ppt/slideLayouts/slideLayout1.xml', name: 'Title Slide' },
						{ path: 'ppt/slideLayouts/slideLayout2.xml', name: 'Blank' },
					],
				},
				{
					path: 'ppt/slideMasters/slideMaster2.xml',
					layouts: [{ path: 'ppt/slideLayouts/slideLayout3.xml', name: 'Custom' }],
				},
			]);
			expect(collectLayoutNames(data)).toStrictEqual(['Title Slide', 'Blank', 'Custom']);
		});

		it('skips layouts without a name and returns [] when there are no masters', () => {
			expect(
				collectLayoutNames(
					dataWithMasters([
						{
							path: 'ppt/slideMasters/slideMaster1.xml',
							layouts: [{ path: 'ppt/slideLayouts/slideLayout1.xml' }],
						},
					]),
				),
			).toStrictEqual([]);
			expect(collectLayoutNames(dataWithMasters(undefined))).toStrictEqual([]);
		});
	});

	describe('collectMasterNames', () => {
		it('gathers named masters and skips unnamed ones', () => {
			const data = dataWithMasters([
				{ path: 'ppt/slideMasters/slideMaster1.xml', name: 'Office Theme' },
				{ path: 'ppt/slideMasters/slideMaster2.xml' },
			]);
			expect(collectMasterNames(data)).toStrictEqual(['Office Theme']);
		});
	});

	describe('uniqueDisplayName', () => {
		it('returns the base name unchanged when it is free', () => {
			expect(uniqueDisplayName(['Title Slide'], 'Blank')).toBe('Blank');
		});

		it('appends a trailing counter when the base name is taken', () => {
			expect(uniqueDisplayName(['Title Slide'], 'Title Slide')).toBe('Title Slide 2');
		});

		it('increments an existing trailing counter rather than stacking a new one', () => {
			expect(uniqueDisplayName(['Title Slide', 'Title Slide 2'], 'Title Slide')).toBe(
				'Title Slide 3',
			);
			expect(uniqueDisplayName(['Title Slide 2'], 'Title Slide 2')).toBe('Title Slide 3');
		});

		it('skips over gaps to find the first free counter', () => {
			expect(
				uniqueDisplayName(['Title Slide', 'Title Slide 2', 'Title Slide 3'], 'Title Slide'),
			).toBe('Title Slide 4');
		});
	});

	describe('uniquePrefixedName', () => {
		it('prefixes an unused base name with 1_', () => {
			expect(uniquePrefixedName(['Office Theme'], 'Office Theme')).toBe('1_Office Theme');
		});

		it('increments an existing numeric prefix', () => {
			expect(uniquePrefixedName(['Office Theme', '1_Office Theme'], '1_Office Theme')).toBe(
				'2_Office Theme',
			);
		});

		it('skips over gaps to find the first free prefix', () => {
			expect(
				uniquePrefixedName(['Office Theme', '1_Office Theme', '2_Office Theme'], 'Office Theme'),
			).toBe('3_Office Theme');
		});
	});
});
