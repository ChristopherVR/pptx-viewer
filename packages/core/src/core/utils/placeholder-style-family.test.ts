import { describe, it, expect } from 'vitest';

import { placeholderStyleFamily } from './placeholder-style-family';

describe('placeholderStyleFamily', () => {
	it('treats an omitted type as body, per the schema default', () => {
		expect(placeholderStyleFamily(undefined)).toBe('body');
		expect(placeholderStyleFamily('')).toBe('body');
	});

	it('folds the title aliases together', () => {
		expect(placeholderStyleFamily('title')).toBe('title');
		expect(placeholderStyleFamily('ctrtitle')).toBe('title');
	});

	it('folds the body aliases together', () => {
		expect(placeholderStyleFamily('body')).toBe('body');
		expect(placeholderStyleFamily('obj')).toBe('body');
		expect(placeholderStyleFamily('subtitle')).toBe('body');
	});

	it('leaves the placeholder kinds with no aliases alone', () => {
		expect(placeholderStyleFamily('dt')).toBe('dt');
		expect(placeholderStyleFamily('ftr')).toBe('ftr');
		expect(placeholderStyleFamily('sldnum')).toBe('sldnum');
		expect(placeholderStyleFamily('pic')).toBe('pic');
		expect(placeholderStyleFamily('chart')).toBe('chart');
	});

	it('normalises the casing PowerPoint writes attributes in', () => {
		expect(placeholderStyleFamily('ctrTitle')).toBe('title');
		expect(placeholderStyleFamily(' subTitle ')).toBe('body');
		expect(placeholderStyleFamily('sldNum')).toBe('sldnum');
	});
});
