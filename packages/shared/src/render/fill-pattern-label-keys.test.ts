import { describe, expect, it } from 'vitest';

import { FILL_PATTERN_LABEL_KEYS, PATTERN_PRESET_OPTIONS } from './fill-pattern-label-keys';
import { OOXML_PATTERN_PRESETS } from './fill-style';

describe('fILL_PATTERN_LABEL_KEYS', () => {
	it('covers every OOXML pattern preset', () => {
		for (const preset of OOXML_PATTERN_PRESETS) {
			expect(FILL_PATTERN_LABEL_KEYS[preset]).toMatch(/^pptx\.fillPatterns\./);
		}
	});
});

describe('pATTERN_PRESET_OPTIONS', () => {
	it('has one entry per OOXML_PATTERN_PRESETS value, in the same order', () => {
		expect(PATTERN_PRESET_OPTIONS.map((o) => o.value)).toStrictEqual([...OOXML_PATTERN_PRESETS]);
	});

	it('pairs each value with its FILL_PATTERN_LABEL_KEYS entry', () => {
		for (const option of PATTERN_PRESET_OPTIONS) {
			expect(option.labelKey).toBe(FILL_PATTERN_LABEL_KEYS[option.value]);
		}
	});

	it('includes the 8 presets React previously omitted', () => {
		const values = PATTERN_PRESET_OPTIONS.map((o) => o.value);
		for (const missing of [
			'plaid',
			'sphere',
			'weave',
			'divot',
			'shingle',
			'wave',
			'trellis',
			'zigZag',
		]) {
			expect(values).toContain(missing);
		}
	});
});
