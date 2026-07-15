import { describe, expect, it } from 'vitest';

import { newFieldElement, resolveInsertedFieldText } from './editor-insert';

describe('inserted fields', () => {
	it('resolves canonical field display text', () => {
		expect(resolveInsertedFieldText('slidenum', 4)).toBe('4');
		expect(resolveInsertedFieldText('header', 4)).toBe('Header');
		expect(resolveInsertedFieldText('footer', 4)).toBe('Footer');
		expect(resolveInsertedFieldText('custom', 4, 'Custom value')).toBe('Custom value');
	});

	it('builds an OOXML field-bearing shape', () => {
		const element = newFieldElement('slidenum', '4');
		expect(element.type).toBe('shape');
		if (element.type !== 'shape') {
			throw new Error('expected shape field');
		}
		expect(element.text).toBe('4');
		expect(element.textSegments?.[0]).toMatchObject({ text: '4', fieldType: 'slidenum' });
		expect(element.textSegments?.[0]?.fieldGuid).toMatch(/^\{.+\}$/u);
	});
});
