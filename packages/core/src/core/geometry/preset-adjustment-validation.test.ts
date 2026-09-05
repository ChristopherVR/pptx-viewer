import { describe, it, expect } from 'vitest';

import { filterValidShapeAdjustmentEntries } from './preset-adjustment-validation';

describe('filterValidShapeAdjustmentEntries', () => {
	it('keeps a homePlate `adj` entry (its one real ECMA-376 guide)', () => {
		const entries = filterValidShapeAdjustmentEntries('homePlate', { adj: 30000 });
		expect(entries).toStrictEqual([['adj', 30000]]);
	});

	it('drops a guide name that is not a real handle for the resolved preset', () => {
		// homePlate's real `avLst` has exactly `adj` - not `adj1`. COM-verified:
		// saving this unfiltered makes PowerPoint refuse to open the file
		// ("The file or directory is corrupted and unreadable", 0x80070570)
		// even though the XML is otherwise schema-valid.
		const entries = filterValidShapeAdjustmentEntries('homePlate', { adj1: 30000 });
		expect(entries).toStrictEqual([]);
	});

	it('keeps only the recognised names out of a mixed valid/invalid record', () => {
		const entries = filterValidShapeAdjustmentEntries('homePlate', {
			adj: 30000,
			adj1: 30000,
			adj2: 30000,
		});
		expect(entries).toStrictEqual([['adj', 30000]]);
	});

	it('drops every entry for a preset with zero real adjustment guides (rect)', () => {
		// `rect` is COM-verified to tolerate a bogus `<a:avLst>` (PowerPoint
		// silently ignores it, `Shape.Adjustments.Count` reads 0), but there is
		// no reason to keep emitting meaningless guides once we know that.
		const entries = filterValidShapeAdjustmentEntries('rect', {
			adj: 30000,
			adj1: 30000,
			adj2: 30000,
		});
		expect(entries).toStrictEqual([]);
	});

	it('keeps a correct adj1/adj2 pair for a two-handle preset (leftRightArrow)', () => {
		const entries = filterValidShapeAdjustmentEntries('leftRightArrow', {
			adj1: 30000,
			adj2: 30000,
		});
		expect(entries).toStrictEqual([
			['adj1', 30000],
			['adj2', 30000],
		]);
	});

	it('drops empty-name and non-finite-value entries regardless of preset', () => {
		const entries = filterValidShapeAdjustmentEntries('homePlate', {
			'': 30000,
			adj: Number.NaN,
		} as Record<string, number>);
		expect(entries).toStrictEqual([]);
	});

	it('passes entries through unfiltered for a preset the table does not resolve', () => {
		// Nothing to validate against - preserves the pre-existing permissive
		// behaviour rather than guessing.
		const entries = filterValidShapeAdjustmentEntries('notARealPreset', { anything: 1 });
		expect(entries).toStrictEqual([['anything', 1]]);
	});

	it('returns an empty array when no adjustments are supplied', () => {
		expect(filterValidShapeAdjustmentEntries('homePlate', undefined)).toStrictEqual([]);
	});
});
