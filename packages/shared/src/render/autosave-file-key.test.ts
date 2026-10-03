import { describe, expect, it } from 'vitest';

import { resolveAutosaveFileKey } from './autosave-file-key';

describe('autosave document identity', () => {
	it('keeps named presentations in separate recovery records', () => {
		expect(resolveAutosaveFileKey(undefined, 'first.pptx')).toBe('first.pptx');
		expect(resolveAutosaveFileKey(undefined, 'second.pptx')).toBe('second.pptx');
	});

	it('honors an explicit host identity and the unnamed default', () => {
		expect(resolveAutosaveFileKey('/documents/first.pptx', 'first.pptx')).toBe(
			'/documents/first.pptx',
		);
		expect(resolveAutosaveFileKey(undefined, undefined)).toBe('presentation.pptx');
	});
});
