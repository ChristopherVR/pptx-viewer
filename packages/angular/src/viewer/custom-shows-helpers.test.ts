import { describe, expect, it } from 'vitest';

import { createCustomShow, generateCustomShowId } from './custom-shows-helpers';

describe('generateCustomShowId', () => {
	it('returns a string starting with "show-"', () => {
		const id = generateCustomShowId();
		expect(id).toMatch(/^show-/u);
	});

	it('returns unique ids on each call', () => {
		const ids = new Set(Array.from({ length: 20 }, () => generateCustomShowId()));
		expect(ids.size).toBe(20);
	});
});

describe('createCustomShow', () => {
	it('creates a show with the given name and slide ids', () => {
		const show = createCustomShow('My Show', ['slide-1', 'slide-2']);
		expect(show.name).toBe('My Show');
		expect(show.slideIds).toStrictEqual(['slide-1', 'slide-2']);
	});

	it('trims whitespace from the name', () => {
		const show = createCustomShow('  Trimmed  ', []);
		expect(show.name).toBe('Trimmed');
	});

	it('assigns a unique id', () => {
		const show1 = createCustomShow('A', []);
		const show2 = createCustomShow('B', []);
		expect(show1.id).not.toBe(show2.id);
		expect(show1.id).toMatch(/^show-/u);
	});

	it('creates a copy of the slideIds array', () => {
		const ids = ['slide-1', 'slide-2'];
		const show = createCustomShow('Test', ids);
		ids.push('slide-3');
		expect(show.slideIds).toHaveLength(2);
	});

	it('accepts readonly slideIds', () => {
		const ids: readonly string[] = ['slide-a'];
		const show = createCustomShow('Readonly Test', ids);
		expect(show.slideIds).toStrictEqual(['slide-a']);
	});
});
