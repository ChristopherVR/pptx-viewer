/** The Font strip adapter: the decoding of the shared intent. */
import { describe, expect, it } from 'vitest';

import { fontHomeAction } from './ribbon-font-home';

describe('ribbon font home helpers', () => {
	it('maps each intent id to the native edit', () => {
		expect(fontHomeAction('home.font.underline')).toStrictEqual({
			kind: 'toggle',
			flag: 'underline',
		});
		expect(fontHomeAction('home.font.shadow')).toStrictEqual({ kind: 'shadow' });
		expect(fontHomeAction('home.font.increaseFontSize')).toStrictEqual({
			kind: 'step',
			direction: 1,
		});
		expect(fontHomeAction('home.font.decreaseFontSize')).toStrictEqual({
			kind: 'step',
			direction: -1,
		});
		expect(fontHomeAction('home.font.clearFormatting')).toStrictEqual({ kind: 'clear' });
		expect(fontHomeAction('home.font.fontColor')).toBeUndefined();
	});
});
