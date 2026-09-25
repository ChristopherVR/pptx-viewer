import { describe, expect, it } from 'vitest';

import { splitCssList, splitCssTokens } from './css-top-level-split';

describe('css-top-level-split', () => {
	it('splits an animation list only at top-level commas', () => {
		expect(
			splitCssList('a 1ms linear(0, 0.2 40%, 1) 0ms, b 2ms cubic-bezier(0.1, 0, 0.9, 1) 5ms'),
		).toStrictEqual(['a 1ms linear(0, 0.2 40%, 1) 0ms', 'b 2ms cubic-bezier(0.1, 0, 0.9, 1) 5ms']);
	});

	it('splits a track into tokens without tearing a function apart', () => {
		expect(
			splitCssTokens('pptx-fadeIn 500ms linear(0, 0.2 40%, 1) 0ms 1 normal both'),
		).toStrictEqual([
			'pptx-fadeIn',
			'500ms',
			'linear(0, 0.2 40%, 1)',
			'0ms',
			'1',
			'normal',
			'both',
		]);
	});

	it('drops empty parts', () => {
		expect(splitCssList(' , a ,')).toStrictEqual(['a']);
		expect(splitCssTokens('  a   b ')).toStrictEqual(['a', 'b']);
	});
});
