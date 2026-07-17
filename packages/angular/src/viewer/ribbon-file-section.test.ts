import { describe, expect, it } from 'vitest';

import { visibleMainNav } from './ribbon-file-section.component';

describe('visibleMainNav', () => {
	it('includes the Export entry when hiddenActions is omitted (backward-compatible default)', () => {
		const ids = visibleMainNav(undefined).map((item) => item.id);
		expect(ids).toContain('export');
	});

	it('drops the Export entry when "export" is hidden, leaving unrelated entries', () => {
		const ids = visibleMainNav(['export']).map((item) => item.id);
		expect(ids).not.toContain('export');
		expect(ids).toContain('home');
		expect(ids).toContain('save');
	});

	it('leaves the Export entry when an unrelated action is hidden', () => {
		const ids = visibleMainNav(['share']).map((item) => item.id);
		expect(ids).toContain('export');
	});
});
