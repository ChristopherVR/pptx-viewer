import { describe, expect, it } from 'vitest';

import { createLazyActions } from './editor-lazy-actions';

interface Fake {
	greet(name: string): string;
}

describe('createLazyActions', () => {
	it('forwards calls to whatever getActions() currently returns', () => {
		let current: Fake = { greet: (name) => `v1:${name}` };
		const lazy = createLazyActions(() => current);
		expect(lazy.greet('a')).toBe('v1:a');

		current = { greet: (name) => `v2:${name}` };
		expect(lazy.greet('b')).toBe('v2:b');
	});

	it('reuses the same wrapper function across calls to the same method', () => {
		const target: Fake = { greet: (name) => name };
		const lazy = createLazyActions(() => target);
		const first = lazy.greet;
		const second = lazy.greet;
		expect(first).toBe(second);
	});
});
