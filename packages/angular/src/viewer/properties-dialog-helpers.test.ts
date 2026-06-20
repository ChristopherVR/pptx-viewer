/**
 * properties-dialog-helpers.test.ts: Unit tests for the document-properties
 * helpers. Ports the Vue `PropertiesDialog.test.ts` coverage (prefill, change
 * diffing, read-only timestamps) against the pure helpers; no Angular TestBed.
 */

import type { PptxCoreProperties } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	buildPropertiesPatch,
	formatPropertyDate,
	seedPropertiesDraft,
} from './properties-dialog-helpers';
import type { DocumentProperties } from './properties-dialog-helpers';

function baseProperties(): DocumentProperties {
	return {
		title: 'Quarterly Review',
		creator: 'Ada Lovelace',
		subject: 'Finance',
		keywords: 'q4, budget',
		created: '2024-01-15T08:00:00Z',
		modified: '2024-06-01T12:30:00Z',
	};
}

describe('seedPropertiesDraft', () => {
	it('prefills editable fields from the properties', () => {
		const draft = seedPropertiesDraft(baseProperties());
		expect(draft).toStrictEqual({
			title: 'Quarterly Review',
			creator: 'Ada Lovelace',
			subject: 'Finance',
			keywords: 'q4, budget',
		});
	});

	it('coerces absent fields to empty strings', () => {
		const draft = seedPropertiesDraft({});
		expect(draft).toStrictEqual({ title: '', creator: '', subject: '', keywords: '' });
	});
});

describe('formatPropertyDate', () => {
	it('returns an em-dash for missing values', () => {
		expect(formatPropertyDate(undefined)).toBe('—');
		expect(formatPropertyDate('')).toBe('—');
	});

	it('formats a valid ISO timestamp via toLocaleString', () => {
		const value = '2024-01-15T08:00:00Z';
		expect(formatPropertyDate(value)).toBe(new Date(value).toLocaleString());
	});

	it('echoes an unparseable value unchanged', () => {
		expect(formatPropertyDate('not-a-date')).toBe('not-a-date');
	});
});

describe('buildPropertiesPatch', () => {
	it('emits only the edited fields', () => {
		const props = baseProperties();
		const patch = buildPropertiesPatch(props, {
			title: 'Updated Title',
			creator: props.creator ?? '',
			subject: props.subject ?? '',
			keywords: 'q4, budget, final',
		});
		const expected: Partial<PptxCoreProperties> = {
			title: 'Updated Title',
			keywords: 'q4, budget, final',
		};
		expect(patch).toStrictEqual(expected);
	});

	it('returns an empty patch when nothing changed', () => {
		const props = baseProperties();
		const patch = buildPropertiesPatch(props, seedPropertiesDraft(props));
		expect(patch).toStrictEqual({});
	});

	it('treats clearing a previously-set field as a change to empty string', () => {
		const patch = buildPropertiesPatch(baseProperties(), {
			title: '',
			creator: 'Ada Lovelace',
			subject: 'Finance',
			keywords: 'q4, budget',
		});
		expect(patch).toStrictEqual({ title: '' });
	});

	it('treats absent source fields as empty when diffing', () => {
		const patch = buildPropertiesPatch(
			{},
			{ title: 'New', creator: '', subject: '', keywords: '' },
		);
		expect(patch).toStrictEqual({ title: 'New' });
	});
});
