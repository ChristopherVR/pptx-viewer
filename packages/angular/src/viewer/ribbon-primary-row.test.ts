import { describe, expect, it } from 'vitest';

import { visibleOverflowItems } from './ribbon-primary-row.component';

describe('visibleOverflowItems', () => {
	it('includes the export rows when hiddenActions is omitted (backward-compatible default)', () => {
		const keys = visibleOverflowItems(undefined).map((item) => item.key);
		expect(keys).toStrictEqual(
			expect.arrayContaining(['png', 'pdf', 'video', 'gif', 'save', 'print', 'info', 'a11y']),
		);
	});

	it('drops the export rows when "export" is hidden, leaving unrelated rows', () => {
		const keys = visibleOverflowItems(['export']).map((item) => item.key);
		expect(keys).not.toContain('png');
		expect(keys).not.toContain('pdf');
		expect(keys).not.toContain('video');
		expect(keys).not.toContain('gif');
		expect(keys).toContain('save');
		expect(keys).toContain('print');
	});

	it('leaves the export rows when an unrelated action is hidden', () => {
		const keys = visibleOverflowItems(['share']).map((item) => item.key);
		expect(keys).toContain('png');
	});
});
