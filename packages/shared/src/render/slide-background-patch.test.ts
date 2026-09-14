import { describe, expect, it } from 'vitest';

import {
	clearBackgroundPatch,
	imageBackgroundPatch,
	solidBackgroundPatch,
} from './slide-background-patch';

describe('slide background patches', () => {
	it('solid fill clears the layers that would paint over the colour', () => {
		expect(solidBackgroundPatch('#112233')).toStrictEqual({
			backgroundColor: '#112233',
			backgroundImage: undefined,
			backgroundGradient: undefined,
			backgroundPattern: undefined,
		});
	});

	it('picture fill replaces gradient and pattern but keeps the fallback colour', () => {
		const patch = imageBackgroundPatch('data:image/png;base64,AAAA');
		expect(patch).toStrictEqual({
			backgroundImage: 'data:image/png;base64,AAAA',
			backgroundGradient: undefined,
			backgroundPattern: undefined,
		});
		expect('backgroundColor' in patch).toBeFalsy();
	});

	it('clear removes every slide-level facet', () => {
		expect(clearBackgroundPatch()).toStrictEqual({
			backgroundColor: undefined,
			backgroundImage: undefined,
			backgroundGradient: undefined,
			backgroundPattern: undefined,
		});
	});
});
